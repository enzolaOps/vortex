/**
 * Os campos de canal que só o Vortex conhece — `forum` e `thread`.
 *
 * ⚠ **Lidos do payload CRU, e é a única forma.** O servidor deste fork manda os
 * dois em `TextChannel`, e a hidratação do `stoat.js` DESCARTA toda chave que
 * não está no mapa dela: o `Channel` do SDK nunca tem `forum` nem `thread`, nem
 * atrás de `getUnderlyingObject`. É a mesma situação do `can_publish` do
 * membro, resolvida do mesmo jeito — o adapter ouve `client.events.on("event")`
 * e traduz aqui. Patchar o submodule criaria um fork do SDK para manter.
 *
 * Módulo FOLHA de propósito: não importa o adapter nem o `client`. O adapter
 * alimenta e lê, o store de tópicos lê, e os testes exercitam a tradução sem
 * SDK nenhum.
 *
 * **Compatibilidade, dita uma vez:** tópico e fórum continuam sendo
 * `TextChannel` no fio. Um cliente Stoat antigo vê o fórum como canal de texto
 * comum e nunca lista um tópico, porque tópico não entra em `server.channels`.
 */

/** Uma tag de fórum. `cor` só existe quando o servidor mandou `#rrggbb`. */
export type TagDeForum = {
  readonly id: string;
  readonly nome: string;
  readonly cor: string | undefined;
};

export type MetaDeForum = {
  /** Galeria de mídia em vez de fórum de texto. */
  readonly midia: boolean;
  readonly tags: readonly TagDeForum[];
};

export type MetaDeTopico = {
  readonly paiId: string;
  readonly serverId: string | undefined;
  readonly donoId: string;
  /**
   * A mensagem de abertura. No tópico aberto a partir de uma mensagem, é ela
   * (e mora no canal pai); no post, é a primeira mensagem de dentro — e fica
   * `undefined` até ela ser enviada.
   */
  readonly aberturaId: string | undefined;
  readonly arquivado: boolean;
  readonly tags: readonly string[];
  readonly seguidores: readonly string[];
};

/* -------------------------------------------------------------- tradução */

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function textos(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/**
 * `#rrggbb` e nada mais.
 *
 * ⚠ **A cor vai para `style`, e ela é escrita por quem administra o servidor.**
 * O servidor deste fork valida o mesmo formato, mas o cliente não confia no
 * fio: um `var(--…)` ou `url(…)` que passasse aqui leria os tokens do app ou
 * buscaria um endereço na máquina de quem abrisse o fórum. É a mesma régua do
 * gradiente de cargo.
 */
export function corDeTag(v: unknown): string | undefined {
  return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : undefined;
}

export function traduzirForum(bruto: unknown): MetaDeForum | undefined {
  if (bruto === null || typeof bruto !== "object") return undefined;
  const f = bruto as { media?: unknown; tags?: unknown };
  const tags: TagDeForum[] = [];
  if (Array.isArray(f.tags)) {
    for (const t of f.tags as { id?: unknown; name?: unknown; colour?: unknown }[]) {
      const id = texto(t?.id);
      const nome = texto(t?.name);
      if (id === undefined || nome === undefined) continue;
      tags.push({ id, nome, cor: corDeTag(t.colour) });
    }
  }
  return { midia: f.media === true, tags };
}

export function traduzirTopico(
  bruto: unknown,
  serverId: string | undefined,
): MetaDeTopico | undefined {
  if (bruto === null || typeof bruto !== "object") return undefined;
  const t = bruto as {
    parent?: unknown;
    owner?: unknown;
    message?: unknown;
    archived?: unknown;
    tags?: unknown;
    followers?: unknown;
  };
  const paiId = texto(t.parent);
  const donoId = texto(t.owner);
  // Sem pai não há tópico: é o campo que diz de onde ele é.
  if (paiId === undefined || donoId === undefined) return undefined;
  return {
    paiId,
    serverId,
    donoId,
    aberturaId: texto(t.message),
    arquivado: t.archived === true,
    tags: textos(t.tags),
    seguidores: textos(t.followers),
  };
}

/* ------------------------------------------------------------ o registro */

const foruns = new Map<string, MetaDeForum>();
const topicos = new Map<string, MetaDeTopico>();
const servidorDoCanal = new Map<string, string>();

type Ouvinte = (ids: readonly string[]) => void;
const ouvintes = new Set<Ouvinte>();

/** Avisado com os IDs que MUDARAM — o adapter reemite só esses. */
export function assinarMetaDeCanal(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

function avisar(ids: readonly string[]): void {
  if (ids.length === 0) return;
  for (const o of ouvintes) o(ids);
}

export function lerForum(channelId: string): MetaDeForum | undefined {
  return foruns.get(channelId);
}

export function lerTopico(channelId: string): MetaDeTopico | undefined {
  return topicos.get(channelId);
}

/** Os tópicos conhecidos pela sessão — ativos do `Ready`, e o que a rede trouxe. */
export function topicosConhecidos(): IterableIterator<[string, MetaDeTopico]> {
  return topicos.entries();
}

/**
 * Anota um objeto de canal do protocolo. Devolve se algo mudou.
 *
 * Canal que perdeu os campos também é anotação: `forum` ausente APAGA o que
 * havia, porque o objeto inteiro é a verdade sobre ele.
 */
function anotar(bruto: unknown): boolean {
  if (bruto === null || typeof bruto !== "object") return false;
  const c = bruto as { _id?: unknown; server?: unknown; forum?: unknown; thread?: unknown };
  const id = texto(c._id);
  if (id === undefined) return false;
  const serverId = texto(c.server);
  if (serverId !== undefined) servidorDoCanal.set(id, serverId);

  const forum = traduzirForum(c.forum);
  const topico = traduzirTopico(c.thread, serverId);
  const mudou =
    !mesmoForum(foruns.get(id), forum) || !mesmoTopico(topicos.get(id), topico);

  if (forum) foruns.set(id, forum);
  else foruns.delete(id);
  if (topico) topicos.set(id, topico);
  else topicos.delete(id);
  return mudou;
}

/** Anota objetos de canal vindos da REDE (resposta de REST), fora de evento. */
export function anotarCanais(brutos: readonly unknown[]): void {
  const mudaram: string[] = [];
  for (const b of brutos) {
    if (anotar(b)) mudaram.push((b as { _id: string })._id);
  }
  avisar(mudaram);
}

/**
 * Traduz um evento cru do socket. `Bulk` é aberto aqui, porque o SDK também o
 * abre — e um `ChannelCreate` dentro de um `Bulk` é o caso comum ao recalcular
 * permissões de um servidor.
 */
export function aplicarEventoCru(evento: unknown): void {
  const mudaram: string[] = [];
  aplicar(evento, mudaram);
  avisar(mudaram);
}

function aplicar(evento: unknown, mudaram: string[]): void {
  if (evento === null || typeof evento !== "object") return;
  const e = evento as {
    type?: unknown;
    v?: unknown;
    channels?: unknown;
    id?: unknown;
    data?: { forum?: unknown; thread?: unknown };
  };

  switch (e.type) {
    case "Bulk":
      if (Array.isArray(e.v)) for (const item of e.v) aplicar(item, mudaram);
      return;
    case "Ready":
      if (Array.isArray(e.channels)) {
        for (const c of e.channels) if (anotar(c)) mudaram.push((c as { _id: string })._id);
      }
      return;
    case "ChannelCreate":
      if (anotar(e)) mudaram.push(String((e as { _id?: unknown })._id));
      return;
    case "ChannelUpdate": {
      const id = texto(e.id);
      if (id === undefined || e.data === undefined) return;
      /*
        Parcial: só o que veio muda. `thread` e `forum` chegam INTEIROS quando
        chegam — o servidor substitui o objeto, não o funde —, então trocar
        aqui é o mesmo que o SDK faz com os campos que ele conhece.
      */
      let mudou = false;
      if (e.data.forum !== undefined) {
        const forum = traduzirForum(e.data.forum);
        if (forum && !mesmoForum(foruns.get(id), forum)) {
          foruns.set(id, forum);
          mudou = true;
        }
      }
      if (e.data.thread !== undefined) {
        const topico = traduzirTopico(e.data.thread, servidorDoCanal.get(id));
        if (topico && !mesmoTopico(topicos.get(id), topico)) {
          topicos.set(id, topico);
          mudou = true;
        }
      }
      if (mudou) mudaram.push(id);
      return;
    }
    case "ChannelDelete": {
      const id = texto(e.id);
      if (id === undefined) return;
      // Os dois `delete` sempre rodam: `||` pararia no primeiro.
      const tinhaForum = foruns.delete(id);
      const tinhaTopico = topicos.delete(id);
      const tinha = tinhaForum || tinhaTopico;
      servidorDoCanal.delete(id);
      if (tinha) mudaram.push(id);
      return;
    }
    default:
      return;
  }
}

/** Só para testes e para o fim da sessão. */
export function limparMetaDeCanal(): void {
  foruns.clear();
  topicos.clear();
  servidorDoCanal.clear();
}

/* ---------------------------------------------------------- comparação */

function mesmaLista(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function mesmoForum(a: MetaDeForum | undefined, b: MetaDeForum | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.midia === b.midia &&
    a.tags.length === b.tags.length &&
    a.tags.every(
      (t, i) => t.id === b.tags[i]!.id && t.nome === b.tags[i]!.nome && t.cor === b.tags[i]!.cor,
    )
  );
}

function mesmoTopico(a: MetaDeTopico | undefined, b: MetaDeTopico | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  return (
    a.paiId === b.paiId &&
    a.donoId === b.donoId &&
    a.aberturaId === b.aberturaId &&
    a.arquivado === b.arquivado &&
    a.serverId === b.serverId &&
    mesmaLista(a.tags, b.tags) &&
    mesmaLista(a.seguidores, b.seguidores)
  );
}
