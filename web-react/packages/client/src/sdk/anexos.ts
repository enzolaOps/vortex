import { client } from "./client";
import { motivoDoErro } from "./erros";
import { formatarBytes } from "../lib/bytes";
import { lerTokenGuardado } from "../store/sessao";

/**
 * Subir arquivo ao servidor de mídia.
 *
 * ⚠ **O `autumn` NÃO passa pelo `stoat.js`** — é um serviço separado, com
 * endereço próprio, e o SDK não tem método para ele. O contrato foi lido da
 * fonte (`crates/services/autumn/src/api.rs` do fork da API), não adivinhado:
 *
 *     POST {url}/{tag}   multipart, campo `file`, header `X-Session-Token`
 *     200 → { id }
 *
 * As tags e os tetos são do próprio serviço:
 *
 *     attachments 20 MB · avatars 4 MB · backgrounds 6 MB
 *     icons 2,5 MB · banners 6 MB · emojis 500 KB
 *
 * ⚠ **A tabela acima é o default, e o teto real vem da CONFIGURAÇÃO da
 * instância** — `GET /api/` publica
 * `features.limits.<faixa>.file_upload_size_limits`. É de lá que
 * `tetoDeUpload` lê, então a checagem local não duplica número nenhum.
 * A razão de ela existir está dita em `subirAnexo`, e foi medida.
 *
 * ## Por que este módulo existe, em vez de um `fetch` no componente
 *
 * É a camada anticorrupção fazendo o que ela existe para fazer. O endereço do
 * `autumn` vem de `client.configuration`, que é forma de protocolo; se o
 * composer o montasse, o componente passaria a saber que existe um segundo
 * serviço, com que tag ele fala e que header ele quer. Entra `File`, sai ID.
 */

/** As tags do `autumn`. Fechada porque o serviço a valida e devolve 404. */
export type TagDeAnexo =
  | "attachments"
  | "avatars"
  | "backgrounds"
  | "icons"
  | "banners"
  | "emojis";

export type OpcoesDeUpload = {
  /**
   * De 0 a 1, ou `undefined` enquanto o total é desconhecido.
   *
   * ⚠ **É por isto que aqui é `XMLHttpRequest` e não `fetch`.** O `fetch` não
   * reporta progresso de ENVIO — `ReadableStream` no corpo resolveria, e não
   * é suportado sem HTTP/2 em todos os navegadores que este app aceita. O
   * design desenha uma barra de progresso no anexo; uma barra que só conhece
   * "começou" e "terminou" é uma animação sobre um número inventado, que é
   * exatamente o que este projeto recusou na qualidade de voz.
   */
  readonly aoProgredir?: (fracao: number) => void;
  /** Cancelar. O `autumn` não precisa saber: a conexão cai e ele descarta. */
  readonly sinal?: AbortSignal;
};

/** A falha, já traduzida — nunca o `type` cru nem a `location` do Rust. */
export class ErroDeUpload extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeUpload";
  }
}

/**
 * O endereço do serviço, ou nada quando a instância não o tem.
 *
 * ⚠ **`enabled` pode ser `false`**, e nesse caso o campo `url` vem vazio. Uma
 * instância sem servidor de mídia é configuração válida, não erro — o que não
 * pode acontecer é o botão de anexar existir e falhar contra uma URL vazia.
 * Ver `temServidorDeMidia`, que é o que a tela consulta.
 */
function enderecoDoAutumn(): string | undefined {
  const f = client.configuration?.features.autumn;
  if (f === undefined || !f.enabled) return undefined;
  const url = f.url.trim();
  return url === "" ? undefined : url.replace(/\/+$/, "");
}

/** A instância tem servidor de mídia. A tela usa isto para decidir se desenha. */
export function temServidorDeMidia(): boolean {
  return enderecoDoAutumn() !== undefined;
}

/**
 * O endereço da imagem de um emoji personalizado.
 *
 * ⚠ **Resolvido no RENDER e não na escrita, ao contrário de `avatarUrl` e
 * `iconeUrl`.** Aqueles são derivados no snapshot; a árvore de markdown é
 * CACHEADA por conteúdo, e assar a URL nela a congelaria — o endereço do
 * `autumn` vem da configuração, que só existe depois da conexão, e a mesma
 * mensagem pode ser analisada antes dela. Duas mensagens iguais compartilham
 * a árvore; uma URL vazia gravada ali ficaria vazia para sempre.
 *
 * Custa uma concatenação por emoji visível, e a linha só re-renderiza quando
 * o snapshot muda. É barato o bastante para o componente mais quente do app.
 *
 * `undefined` quando a instância não tem servidor de mídia — aí a linha mostra
 * o código escrito, que é a verdade sobre o que a pessoa digitou.
 */
export function urlDeEmoji(id: string): string | undefined {
  const base = enderecoDoAutumn();
  return base === undefined ? undefined : `${base}/emojis/${id}`;
}

/**
 * O maior teto publicado para esta tag, ou nada.
 *
 * Lê `features.limits` com narrowing manual porque `RevoltConfig` do SDK não
 * tipa o campo. É trabalho da camada anticorrupção: a forma do protocolo
 * morre aqui, e quem chama recebe um número.
 */
function tetoDeUpload(tag: TagDeAnexo): number | undefined {
  const limites = (
    client.configuration as
      | { features?: { limits?: Record<string, unknown> } }
      | undefined
  )?.features?.limits;
  if (limites === undefined) return undefined;

  let maior: number | undefined;
  for (const faixa of Object.values(limites)) {
    const v = (faixa as { file_upload_size_limits?: Record<string, unknown> })
      ?.file_upload_size_limits?.[tag];
    if (typeof v === "number" && (maior === undefined || v > maior)) maior = v;
  }
  return maior;
}

export function subirAnexo(
  arquivo: File,
  tag: TagDeAnexo = "attachments",
  opcoes: OpcoesDeUpload = {},
): Promise<string> {
  const base = enderecoDoAutumn();
  if (base === undefined) {
    return Promise.reject(
      new ErroDeUpload("Este servidor não tem onde guardar arquivos."),
    );
  }

  const token = lerTokenGuardado()?.token;
  if (token === undefined) {
    return Promise.reject(new ErroDeUpload("Sua sessão expirou. Entre de novo."));
  }

  /*
    Arquivo vazio é recusado pelo `autumn` (`FileTooSmall`), e recusar aqui
    poupa uma ida ao servidor para dizer o óbvio. Não duplica número nenhum:
    zero é zero em qualquer configuração.
  */
  if (arquivo.size === 0) {
    return Promise.reject(new ErroDeUpload("Esse arquivo está vazio."));
  }

  /*
    ⚠ **A checagem de tamanho voltou, e o comentário acima defendia não
    tê-la.** O argumento era bom — o teto vem de `user.limits()` e um número
    duplicado no cliente diverge da configuração — mas medir mostrou duas
    coisas que ele não previa.

    Primeiro: o teto é PUBLICADO. `GET /api/` traz
    `features.limits.<faixa>.file_upload_size_limits`, então não é duplicação,
    é leitura da mesma fonte.

    Segundo, e decisivo: a recusa do servidor NÃO é traduzível. Medido contra
    a instância local com 21 MB — `413` com o corpo `request body is malformed
    (failed to read stream)`, texto puro. A camada `DefaultBodyLimit` do axum
    corta antes do handler que emitiria `FileTooLarge { max }`, então o
    envelope do Revolt nunca chega e o teto exato se perde. Sem a checagem,
    a pessoa espera 21 MB subirem para ler "o servidor recusou o pedido".

    ⚠ **O MAIOR teto entre as faixas, e nunca o menor.** O protocolo tem duas
    (`new_user` abaixo de 72h e `default`), e o cliente não sabe em qual está.
    Com o maior, só é recusado aqui o que NENHUMA faixa aceitaria — o resto
    segue para o servidor, que é quem decide. Com o menor, o app recusaria
    arquivo que o servidor aceita, e não haveria como descobrir por quê.
  */
  const teto = tetoDeUpload(tag);
  if (teto !== undefined && arquivo.size > teto) {
    return Promise.reject(
      new ErroDeUpload(
        `Esse arquivo passa do limite de ${formatarBytes(teto) ?? "envio"}.`,
      ),
    );
  }

  return new Promise<string>((resolver, rejeitar) => {
    const xhr = new XMLHttpRequest();
    const corpo = new FormData();
    corpo.append("file", arquivo, arquivo.name);

    xhr.open("POST", `${base}/${tag}`);
    xhr.setRequestHeader("X-Session-Token", token);

    if (opcoes.aoProgredir !== undefined) {
      xhr.upload.addEventListener("progress", (e) => {
        /*
          `lengthComputable` é falso enquanto o navegador não sabe o total.
          Dividir por `e.total` ali daria `Infinity`, e a barra saltaria para
          o fim antes de o primeiro byte sair.
        */
        if (e.lengthComputable && e.total > 0) {
          opcoes.aoProgredir?.(e.loaded / e.total);
        }
      });
    }

    /*
      O cancelamento remove o próprio ouvinte no fim. Sem isso, um sinal de
      vida longa — o de um componente que sobrevive a vários envios —
      acumularia um ouvinte por arquivo: o erro nº 5 do briefing, que só
      aparece na sexta hora de sessão.
    */
    const cancelar = () => xhr.abort();
    opcoes.sinal?.addEventListener("abort", cancelar);
    const soltar = () => opcoes.sinal?.removeEventListener("abort", cancelar);

    xhr.addEventListener("load", () => {
      soltar();
      if (xhr.status >= 200 && xhr.status < 300) {
        const id = idDaResposta(xhr.responseText);
        if (id === undefined) {
          rejeitar(new ErroDeUpload("O servidor de arquivos respondeu errado."));
          return;
        }
        resolver(id);
        return;
      }
      rejeitar(new ErroDeUpload(motivoDoErro(corpoDoErro(xhr))));
    });

    xhr.addEventListener("error", () => {
      soltar();
      rejeitar(new ErroDeUpload("Não deu para falar com o servidor de arquivos."));
    });

    xhr.addEventListener("abort", () => {
      soltar();
      rejeitar(new ErroDeUpload("Envio cancelado."));
    });

    xhr.send(corpo);
  });
}

/**
 * O `id` da resposta, ou nada.
 *
 * Nunca confia na forma: um proxy mal configurado devolve HTML com 200, e
 * `JSON.parse` num `<!doctype html>` lança dentro de um `load` — que é onde
 * uma exceção some, porque não há `catch` em volta de um ouvinte.
 */
function idDaResposta(texto: string): string | undefined {
  try {
    const v: unknown = JSON.parse(texto);
    const id = (v as { id?: unknown } | null)?.id;
    return typeof id === "string" && id !== "" ? id : undefined;
  } catch {
    return undefined;
  }
}

/**
 * O corpo da falha, no formato que `motivoDoErro` entende.
 *
 * O `autumn` responde com o mesmo envelope do resto do Revolt
 * (`{type, location}`), então a tradução é a mesma e não há uma segunda tabela
 * de frases para manter em dia. Quando o corpo não é JSON, o status ainda diz
 * alguma coisa — e `motivoDoErro` já sabe ler `status`.
 */
function corpoDoErro(xhr: XMLHttpRequest): unknown {
  try {
    const v: unknown = JSON.parse(xhr.responseText);
    if (v !== null && typeof v === "object") return { ...v, status: xhr.status };
  } catch {
    /* Cai no status. */
  }
  return { status: xhr.status };
}
