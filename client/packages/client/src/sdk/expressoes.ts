/**
 * Figurinhas e efeitos sonoros de servidor.
 *
 * ⚠ **Conceitos do Vortex, não do Stoat** — o protocolo ganhou os dois no fork
 * de `delta`/`bonfire` (`/custom/sticker`, `/custom/sound`,
 * `/servers/{id}/stickers|sounds` e os eventos `Sticker*`/`SoundboardSound*`).
 * O `stoat.js` não os conhece e é submodule pinado, então tudo aqui passa por
 * `client.api` CRU e pelo evento CRU — o mesmo arranjo do `can_publish` em
 * `adapter.ts`. A forma do protocolo morre neste arquivo: entra `_id`,
 * `creator_id` e `filename`; sai `Figurinha` e `EfeitoSonoro`.
 *
 * ## As duas granularidades de sempre
 *
 *     lista do servidor → assinada pela página e pelo seletor
 *     figurinha por ID  → assinada pela LINHA de mensagem que a mostra
 *
 * A linha não assina a lista: uma figurinha renomeada acordaria toda mensagem
 * com figurinha daquele servidor, e editar a lista (subir mais uma) acordaria
 * todas. Por ID, cada linha acorda pela própria.
 */
import { client, conectado } from "./client";
import { subirAnexo, urlDoOriginal } from "./anexos";
import { motivoDoErro } from "./erros";
import { toast } from "../components/ui/toastStore";
import { createEntityStore, type EntityStore } from "../store/entities";

/* ------------------------------------------------------------ domínio */

export type Figurinha = {
  readonly id: string;
  readonly serverId: string;
  readonly nome: string;
  readonly descricao: string | undefined;
  /** O emoji relacionado — é o que a busca usa e o rodapé do seletor mostra. */
  readonly emoji: string | undefined;
  /** `undefined` quando a instância não tem servidor de mídia. */
  readonly url: string | undefined;
  readonly autorId: string;
  /** Resolvido na tradução; ausente quando a sessão não conhece a pessoa. */
  readonly autorNome: string | undefined;
};

export type EfeitoSonoro = {
  readonly id: string;
  readonly serverId: string;
  readonly nome: string;
  readonly emoji: string | undefined;
  /** Volume de ORIGEM, 0 a 100 — o que todo mundo ouve. */
  readonly volume: number;
  readonly url: string | undefined;
  readonly autorId: string;
  /** Resolvido na tradução; ausente quando a sessão não conhece a pessoa. */
  readonly autorNome: string | undefined;
};

/**
 * Uma lista de servidor, com o estado de quem a buscou.
 *
 * ⚠ **Três estados e não `[]`, e é a lição de `listarConvites`.** Uma lista
 * vazia por falha de rede afirmaria "este servidor não tem figurinha" — e
 * alguém subiria a mesma figurinha outra vez acreditando nisso.
 */
export type ListaDeExpressoes<T> =
  | { readonly estado: "carregando" }
  | { readonly estado: "falhou" }
  | { readonly estado: "pronta"; readonly itens: readonly T[] };

/* --------------------------------------------------- tradução do protocolo */

type Bruto = Record<string, unknown>;

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function nomeDe(userId: string | undefined): string | undefined {
  if (userId === undefined) return undefined;
  const u = client.users.get(userId);
  return u?.displayName ?? u?.username;
}

/** Exportada para teste: é ela que quebra em silêncio se o protocolo mudar. */
export function paraFigurinha(bruto: unknown): Figurinha | undefined {
  const b = bruto as Bruto | null;
  const id = texto(b?._id);
  const serverId = texto(b?.server);
  const nome = texto(b?.name);
  if (!b || id === undefined || serverId === undefined || nome === undefined) {
    return undefined;
  }
  return {
    id,
    serverId,
    nome,
    descricao: texto(b.description),
    emoji: texto(b.emoji),
    url: urlDoOriginal(id, texto(b.filename) ?? ""),
    autorId: texto(b.creator_id) ?? "",
    autorNome: nomeDe(texto(b.creator_id)),
  };
}

export function paraEfeitoSonoro(bruto: unknown): EfeitoSonoro | undefined {
  const b = bruto as Bruto | null;
  const id = texto(b?._id);
  const serverId = texto(b?.server);
  const nome = texto(b?.name);
  if (!b || id === undefined || serverId === undefined || nome === undefined) {
    return undefined;
  }
  const volume = typeof b.volume === "number" ? b.volume : 100;
  return {
    id,
    serverId,
    nome,
    emoji: texto(b.emoji),
    volume: Math.min(100, Math.max(0, volume)),
    url: urlDoOriginal(id, texto(b.filename) ?? ""),
    autorId: texto(b.creator_id) ?? "",
    autorNome: nomeDe(texto(b.creator_id)),
  };
}

/* ------------------------------------------------------------- stores */

export const figurinhasDoServidor = createEntityStore<ListaDeExpressoes<Figurinha>>(
  (serverId) => {
    void carregarFigurinhas(serverId);
  },
);

export const sonsDoServidor = createEntityStore<ListaDeExpressoes<EfeitoSonoro>>(
  (serverId) => {
    void carregarSons(serverId);
  },
);

/**
 * Figurinha por ID — o que a linha de mensagem assina.
 *
 * Busca sozinha no primeiro assinante quando não conhece: a mensagem pode ter
 * vindo de um servidor cuja lista ninguém abriu nesta sessão.
 */
export const figurinhas = createEntityStore<Figurinha>((id) => {
  if (figurinhas.peek(id) === undefined) void buscarFigurinha(id);
});

/** Quem já foi pedido — evita a mesma busca por cada linha que monta. */
const pedidas = new Set<string>();

function publicarFigurinhas(serverId: string, itens: readonly Figurinha[]): void {
  figurinhasDoServidor.set(serverId, { estado: "pronta", itens });
  for (const f of itens) figurinhas.set(f.id, f);
}

function publicarSons(serverId: string, itens: readonly EfeitoSonoro[]): void {
  sonsDoServidor.set(serverId, { estado: "pronta", itens });
}

/**
 * Semeia sem rede — para o arnês e para teste.
 *
 * Mesmo arranjo de `definirEnquete`: sem isto as superfícies ficariam
 * construídas e inalcançáveis fora de uma instância de verdade.
 */
export function semearExpressoes(
  serverId: string,
  dados: { figurinhas?: readonly Figurinha[]; sons?: readonly EfeitoSonoro[] },
): void {
  if (dados.figurinhas) publicarFigurinhas(serverId, dados.figurinhas);
  if (dados.sons) publicarSons(serverId, dados.sons);
}

/* ----------------------------------------------------------- leitura */

export async function carregarFigurinhas(serverId: string): Promise<void> {
  if (!serverId || !conectado()) return;
  if (figurinhasDoServidor.peek(serverId) === undefined) {
    figurinhasDoServidor.set(serverId, { estado: "carregando" });
  }
  try {
    const bruto = await client.api.get(`/servers/${serverId}/stickers` as never);
    const itens = (Array.isArray(bruto) ? bruto : [])
      .map(paraFigurinha)
      .filter((f): f is Figurinha => f !== undefined);
    publicarFigurinhas(serverId, itens);
  } catch {
    figurinhasDoServidor.set(serverId, { estado: "falhou" });
  }
}

export async function carregarSons(serverId: string): Promise<void> {
  if (!serverId || !conectado()) return;
  if (sonsDoServidor.peek(serverId) === undefined) {
    sonsDoServidor.set(serverId, { estado: "carregando" });
  }
  try {
    const bruto = await client.api.get(`/servers/${serverId}/sounds` as never);
    const itens = (Array.isArray(bruto) ? bruto : [])
      .map(paraEfeitoSonoro)
      .filter((s): s is EfeitoSonoro => s !== undefined);
    publicarSons(serverId, itens);
  } catch {
    sonsDoServidor.set(serverId, { estado: "falhou" });
  }
}

export async function buscarFigurinha(id: string): Promise<void> {
  if (pedidas.has(id) || !conectado()) return;
  pedidas.add(id);
  try {
    const f = paraFigurinha(await client.api.get(`/custom/sticker/${id}` as never));
    if (f) figurinhas.set(f.id, f);
  } catch {
    /*
      Figurinha apagada (404): a linha mostra a vaga de "figurinha removida".
      O arquivo ainda existe no `autumn`, mas o nome dele — sem o qual a URL
      do original não se monta — morreu com a figurinha. Sem toast: é uma
      linha do histórico, não uma ação de quem olha.
    */
  }
}

/* ----------------------------------------------------------- limites */

type Limites = {
  readonly figurinhas: number;
  readonly sons: number;
  readonly bytesDeFigurinha: number;
  readonly bytesDeSom: number;
};

/**
 * Os tetos que a instância publica, com os padrões do servidor.
 *
 * Lidos de `features.limits.global` com narrowing manual, como `tetoDeUpload`:
 * o `RevoltConfig` do SDK não conhece os campos do Vortex.
 */
export function limitesDeExpressoes(): Limites {
  const g = (
    client.configuration as
      | { features?: { limits?: { global?: Record<string, unknown> } } }
      | undefined
  )?.features?.limits?.global;
  const n = (v: unknown, padrao: number) =>
    typeof v === "number" && v > 0 ? v : padrao;
  return {
    figurinhas: n(g?.server_stickers, 15),
    sons: n(g?.server_sounds, 8),
    bytesDeFigurinha: n(g?.sticker_size, 512_000),
    bytesDeSom: n(g?.sound_size, 512_000),
  };
}

/**
 * A pessoa pode administrar as expressões do servidor?
 *
 * `ManageCustomisation`, a mesma do emoji — o servidor confere a mesma. Sem
 * sessão, `true`, pela mesma exceção estreita de `permissoes.ts`.
 */
export function podeGerenciarExpressoes(serverId: string): boolean {
  if (client.user === undefined) return true;
  try {
    return client.servers.get(serverId)?.havePermission("ManageCustomisation") ?? false;
  } catch {
    return false;
  }
}

/* ----------------------------------------------------------- escrita */

function falhou(titulo: string, e: unknown): void {
  toast({ tipo: "erro", titulo, descricao: motivoDoErro(e) });
}

/**
 * Sobe e cria. O ID da figurinha É o do arquivo, como no emoji.
 *
 * ⚠ **Tag `attachments`**, e não uma tag própria: o `autumn` que roda é o do
 * upstream. Quem valida tipo e tamanho é o `delta` — e aqui também, antes de
 * gastar a banda, com os tetos que a instância publica.
 */
export async function criarFigurinha(
  serverId: string,
  arquivo: File,
  dados: { nome: string; descricao?: string; emoji?: string },
): Promise<Figurinha | undefined> {
  const { bytesDeFigurinha } = limitesDeExpressoes();
  if (!arquivo.type.startsWith("image/")) {
    toast({ tipo: "erro", titulo: "Figurinha precisa ser imagem.", descricao: "PNG ou APNG." });
    return undefined;
  }
  if (arquivo.size > bytesDeFigurinha) {
    toast({
      tipo: "erro",
      titulo: "Imagem grande demais.",
      descricao: `O limite é ${Math.round(bytesDeFigurinha / 1000)} KB.`,
    });
    return undefined;
  }
  try {
    const id = await subirAnexo(arquivo, "attachments");
    const f = paraFigurinha(
      await client.api.put(
        `/custom/sticker/${id}` as never,
        {
          server: serverId,
          name: dados.nome,
          description: dados.descricao || undefined,
          emoji: dados.emoji || undefined,
        } as never,
      ),
    );
    if (f) {
      inserir(figurinhasDoServidor, serverId, f);
      figurinhas.set(f.id, f);
    }
    return f;
  } catch (e) {
    falhou("Não deu para enviar a figurinha.", e);
    return undefined;
  }
}

export async function editarFigurinha(
  id: string,
  dados: { nome?: string; descricao?: string; emoji?: string },
): Promise<boolean> {
  try {
    const f = paraFigurinha(
      await client.api.patch(
        `/custom/sticker/${id}` as never,
        { name: dados.nome, description: dados.descricao, emoji: dados.emoji } as never,
      ),
    );
    if (f) {
      inserir(figurinhasDoServidor, f.serverId, f);
      figurinhas.set(f.id, f);
    }
    return true;
  } catch (e) {
    falhou("Não deu para salvar a figurinha.", e);
    return false;
  }
}

export async function apagarFigurinha(f: Figurinha): Promise<boolean> {
  try {
    await client.api.delete(`/custom/sticker/${f.id}` as never);
    remover(figurinhasDoServidor, f.serverId, f.id);
    return true;
  } catch (e) {
    falhou("Não deu para apagar a figurinha.", e);
    return false;
  }
}

/**
 * Sobe e cria um efeito sonoro.
 *
 * ⚠ **A DURAÇÃO é conferida aqui, e só aqui.** O servidor não tem decodificador
 * de áudio para medi-la; o teto de bytes é o que ele garante. Quem chama passa
 * a duração já medida (`duracaoDoAudio`), para este módulo não depender de
 * `HTMLAudioElement` e continuar testável.
 */
export async function criarEfeitoSonoro(
  serverId: string,
  arquivo: File,
  dados: { nome: string; emoji?: string; volume: number; duracaoS: number | undefined },
): Promise<EfeitoSonoro | undefined> {
  const { bytesDeSom } = limitesDeExpressoes();
  if (!arquivo.type.startsWith("audio/")) {
    toast({ tipo: "erro", titulo: "Efeito sonoro precisa ser áudio.", descricao: "MP3 ou OGG." });
    return undefined;
  }
  if (arquivo.size > bytesDeSom) {
    toast({
      tipo: "erro",
      titulo: "Arquivo grande demais.",
      descricao: `O limite é ${Math.round(bytesDeSom / 1000)} KB.`,
    });
    return undefined;
  }
  if (dados.duracaoS !== undefined && dados.duracaoS > DURACAO_MAXIMA_S) {
    toast({
      tipo: "erro",
      titulo: "Som longo demais.",
      descricao: `Até ${DURACAO_MAXIMA_S} segundos — este tem ${dados.duracaoS.toFixed(1)}.`,
    });
    return undefined;
  }
  try {
    const id = await subirAnexo(arquivo, "attachments");
    const s = paraEfeitoSonoro(
      await client.api.put(
        `/custom/sound/${id}` as never,
        {
          server: serverId,
          name: dados.nome,
          emoji: dados.emoji || undefined,
          volume: Math.round(dados.volume),
        } as never,
      ),
    );
    if (s) inserir(sonsDoServidor, serverId, s);
    return s;
  } catch (e) {
    falhou("Não deu para enviar o som.", e);
    return undefined;
  }
}

export const DURACAO_MAXIMA_S = 5;

export async function editarEfeitoSonoro(
  id: string,
  dados: { nome?: string; emoji?: string; volume?: number },
): Promise<boolean> {
  try {
    const s = paraEfeitoSonoro(
      await client.api.patch(
        `/custom/sound/${id}` as never,
        {
          name: dados.nome,
          emoji: dados.emoji,
          volume: dados.volume === undefined ? undefined : Math.round(dados.volume),
        } as never,
      ),
    );
    if (s) inserir(sonsDoServidor, s.serverId, s);
    return true;
  } catch (e) {
    falhou("Não deu para salvar o som.", e);
    return false;
  }
}

export async function apagarEfeitoSonoro(s: EfeitoSonoro): Promise<boolean> {
  try {
    await client.api.delete(`/custom/sound/${s.id}` as never);
    remover(sonsDoServidor, s.serverId, s.id);
    return true;
  } catch (e) {
    falhou("Não deu para apagar o som.", e);
    return false;
  }
}

/* ----------------------------------------------------- listas imutáveis */

type ComId = { readonly id: string };

/**
 * Insere ou troca na lista do servidor — sempre um ARRAY NOVO.
 *
 * Só mexe em lista já pronta: inserir numa que ainda está carregando
 * inventaria uma lista de um item que a resposta da rede sobrescreveria.
 */
function inserir<T extends ComId>(
  store: EntityStore<ListaDeExpressoes<T>>,
  serverId: string,
  item: T,
): void {
  const atual = store.peek(serverId);
  if (atual?.estado !== "pronta") return;
  const i = atual.itens.findIndex((x) => x.id === item.id);
  const itens =
    i === -1
      ? [...atual.itens, item]
      : atual.itens.map((x, j) => (j === i ? item : x));
  store.set(serverId, { estado: "pronta", itens });
}

function remover<T extends ComId>(
  store: EntityStore<ListaDeExpressoes<T>>,
  serverId: string,
  id: string,
): void {
  const atual = store.peek(serverId);
  if (atual?.estado !== "pronta") return;
  if (!atual.itens.some((x) => x.id === id)) return;
  store.set(serverId, {
    estado: "pronta",
    itens: atual.itens.filter((x) => x.id !== id),
  });
}

/* ------------------------------------------------------------ eventos */

/**
 * Aplica um evento cru do protocolo às listas.
 *
 * Exportada para teste e chamada pelo ouvinte de `instalarExpressoes`. Devolve
 * se o evento era deste módulo — o `Bulk` é desdobrado por quem chama.
 */
export function aplicarEventoDeExpressao(evento: unknown): boolean {
  const e = evento as Bruto | null;
  switch (e?.type) {
    case "StickerCreate":
    case "StickerUpdate": {
      const f = paraFigurinha(e);
      if (!f) return true;
      inserir(figurinhasDoServidor, f.serverId, f);
      /* Só atualiza por ID quem alguém já conhece — senão todo servidor com
         figurinhas enche o mapa de quem nunca vai aparecer numa linha. */
      if (figurinhas.peek(f.id) !== undefined) figurinhas.set(f.id, f);
      return true;
    }
    case "StickerDelete": {
      const id = texto(e.id);
      const serverId = texto(e.server);
      if (id && serverId) remover(figurinhasDoServidor, serverId, id);
      return true;
    }
    case "SoundboardSoundCreate":
    case "SoundboardSoundUpdate": {
      const s = paraEfeitoSonoro(e);
      if (s) inserir(sonsDoServidor, s.serverId, s);
      return true;
    }
    case "SoundboardSoundDelete": {
      const id = texto(e.id);
      const serverId = texto(e.server);
      if (id && serverId) remover(sonsDoServidor, serverId, id);
      return true;
    }
    default:
      return false;
  }
}
