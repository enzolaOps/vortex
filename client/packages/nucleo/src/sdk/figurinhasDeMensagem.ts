/**
 * Qual figurinha cada mensagem carrega.
 *
 * ⚠ **O `stoat.js` DESCARTA `Message.stickers`**, como descarta `can_publish`:
 * a hidratação de mensagem só copia as chaves que conhece, e o objeto `Message`
 * que chega ao adapter não tem o campo. Patchar o SDK é fork de submodule; a
 * saída é a mesma de `adapter.ts` — ler o protocolo CRU antes de ele virar
 * objeto, e guardar o que o SDK jogaria fora num mapa próprio.
 *
 * Duas portas de entrada, porque o dado chega por dois caminhos:
 *
 *  - **Evento** (`Message` no socket) — mensagem nova.
 *  - **REST** (`GET /channels/{id}/messages`, busca, fixadas, `POST`) —
 *    histórico e confirmação do envio. Não há evento para ouvir aqui, então
 *    `client.api.get`/`post` são embrulhados UMA vez para anotar a resposta
 *    antes de o SDK hidratá-la.
 *
 * O mapa só cresce com mensagens QUE TÊM figurinha — raras —, então não precisa
 * de teto: é proporcional às figurinhas que a sessão viu, não às mensagens.
 */
import { client } from "./client";

const figurinhaPorMensagem = new Map<string, string>();

type Bruto = { _id?: unknown; nonce?: unknown; stickers?: unknown };

/**
 * Anota uma mensagem crua. Devolve os IDs que ganharam figurinha.
 *
 * A figurinha é guardada pelo `_id` E pelo `nonce`: a confirmação de uma
 * mensagem minha chega com o ID do servidor, e a linha na lista continua
 * chaveada pelo ID local, que é o nonce. Sem as duas chaves a linha
 * confirmada perderia a figurinha no instante em que deixasse de ser otimista.
 */
function anotarUma(bruto: Bruto): string[] {
  if (!Array.isArray(bruto.stickers)) return [];
  const primeira: unknown = bruto.stickers[0];
  if (typeof primeira !== "string" || primeira === "") return [];
  const ids: string[] = [];
  for (const chave of [bruto._id, bruto.nonce]) {
    if (typeof chave === "string" && chave !== "") {
      figurinhaPorMensagem.set(chave, primeira);
      ids.push(chave);
    }
  }
  return ids;
}

/**
 * Anota qualquer forma que carregue mensagens: uma mensagem, uma lista, ou o
 * envelope `{ messages }` de `include_users`. Exportada para teste.
 */
export function anotarFigurinhas(bruto: unknown): string[] {
  if (bruto === null || typeof bruto !== "object") return [];
  if (Array.isArray(bruto)) return bruto.flatMap((b) => anotarFigurinhas(b));
  const b = bruto as Bruto & { messages?: unknown };
  if (Array.isArray(b.messages)) return anotarFigurinhas(b.messages);
  return anotarUma(b);
}

/** A figurinha da mensagem, por qualquer um dos dois IDs dela. */
export function figurinhaDaMensagem(
  id: string,
  nonce?: string,
): string | undefined {
  return (
    figurinhaPorMensagem.get(id) ??
    (nonce === undefined ? undefined : figurinhaPorMensagem.get(nonce))
  );
}

/** A otimista nasce sabendo — a resposta do servidor só confirma. */
export function registrarFigurinhaLocal(messageId: string, figurinhaId: string): void {
  figurinhaPorMensagem.set(messageId, figurinhaId);
}

/** Para teste. */
export function limparFigurinhasDeMensagem(): void {
  figurinhaPorMensagem.clear();
}

let instalado = false;

/**
 * Liga as duas portas. Idempotente — o adapter chama no `startAdapter`.
 *
 * @param republicar recebe o ID de uma mensagem anotada DEPOIS de o adapter já
 *   ter montado o snapshot dela. Acontece no evento: o ouvinte do SDK foi
 *   registrado no construtor do `Client`, antes deste, então o `messageCreate`
 *   dispara e o snapshot sai sem figurinha antes de a anotação chegar. Injetado
 *   para este módulo não importar o adapter (que importa `map.ts`, que importa
 *   este) — um ciclo de módulos que só funcionaria por ordem de avaliação.
 */
export function instalarFigurinhasDeMensagem(republicar: (id: string) => void): void {
  if (instalado) return;
  instalado = true;

  client.events.on("event", (evento: unknown) => {
    const desdobrar = (e: unknown): void => {
      const x = e as { type?: string; v?: unknown };
      if (x?.type === "Bulk" && Array.isArray(x.v)) {
        for (const item of x.v) desdobrar(item);
        return;
      }
      if (x?.type !== "Message") return;
      for (const id of anotarFigurinhas(x)) republicar(id);
    };
    desdobrar(evento);
  });

  /*
    ⚠ **Embrulhar o método da instância, e não o protótipo.** Só este `client`
    é afetado, e a assinatura continua a mesma — quem chama não percebe. A
    resposta é anotada e devolvida INTACTA: nada aqui muda o que o SDK recebe.
  */
  const api = client.api as unknown as Record<"get" | "post", (...a: unknown[]) => Promise<unknown>>;
  for (const metodo of ["get", "post"] as const) {
    const original = api[metodo].bind(client.api);
    api[metodo] = async (...args: unknown[]) => {
      const resposta = await original(...args);
      anotarFigurinhas(resposta);
      return resposta;
    };
  }
}
