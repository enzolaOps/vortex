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
  /**
   * O nome do tópico — o título, num post.
   *
   * Guardado AQUI e não lido do `Channel` do SDK: o evento cru chega ANTES da
   * hidratação, e ler o SDK neste momento daria o nome anterior à mudança.
   */
  readonly nome: string;
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
  /**
   * Fixado no topo do fórum. Só post tem: o servidor recusa fixar tópico de
   * canal comum, e um tópico antigo sem o campo é "não fixado", não "não sei".
   */
  readonly fixado: boolean;
  /**
   * "Em análise" — o estado de um post que a moderação do fórum está olhando
   * (D-CANAIS-09). Campo do fork (`in_review`); ausente é "não", como `pinned`.
   */
  readonly emAnalise: boolean;
  readonly tags: readonly string[];
  readonly seguidores: readonly string[];
  /** A última mensagem de dentro — é dela que sai a última atividade. */
  readonly ultimaMensagemId: string | undefined;
  /** Quem escreveu a última — só conhecido depois de uma mensagem ao vivo. */
  readonly ultimoAutorId: string | undefined;
};

/**
 * O que um post mostra da mensagem de abertura: texto e a primeira mídia.
 *
 * Crua de propósito — sem URL. O endereço do servidor de mídia vem da
 * configuração, que só existe depois da conexão; quem monta a URL é o store
 * de tópicos, na leitura.
 */
export type AberturaCrua = {
  readonly id: string;
  readonly autorId: string;
  readonly texto: string;
  readonly midia:
    | {
        readonly id: string;
        readonly tag: string;
        readonly nome: string;
        readonly tipo: "imagem" | "video" | "gif";
        readonly largura: number | undefined;
        readonly altura: number | undefined;
        /** `SPOILER_` no nome do arquivo — a convenção que o protocolo usa. */
        readonly spoiler: boolean;
        /** Bytes — o "2,4 GB" da barra da galeria. */
        readonly tamanho: number | undefined;
      }
    | undefined;
  /** A reação com mais gente — o `🎯 4` do rodapé do card. */
  readonly reacao: { readonly emoji: string; readonly total: number } | undefined;
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
  nome = "",
  ultimaMensagemId: string | undefined = undefined,
): MetaDeTopico | undefined {
  if (bruto === null || typeof bruto !== "object") return undefined;
  const t = bruto as {
    parent?: unknown;
    owner?: unknown;
    message?: unknown;
    archived?: unknown;
    pinned?: unknown;
    in_review?: unknown;
    tags?: unknown;
    followers?: unknown;
  };
  const paiId = texto(t.parent);
  const donoId = texto(t.owner);
  // Sem pai não há tópico: é o campo que diz de onde ele é.
  if (paiId === undefined || donoId === undefined) return undefined;
  return {
    nome,
    paiId,
    serverId,
    donoId,
    aberturaId: texto(t.message),
    arquivado: t.archived === true,
    fixado: t.pinned === true,
    emAnalise: t.in_review === true,
    tags: textos(t.tags),
    seguidores: textos(t.followers),
    ultimaMensagemId,
    ultimoAutorId: undefined,
  };
}

/**
 * A mensagem de abertura, reduzida ao que o card desenha.
 *
 * `undefined` para o que não é mensagem. Mídia é só a PRIMEIRA imagem ou vídeo:
 * um post com três anexos mostra um na miniatura, como o design.
 */
export function traduzirAbertura(bruto: unknown): AberturaCrua | undefined {
  if (bruto === null || typeof bruto !== "object") return undefined;
  const m = bruto as {
    _id?: unknown;
    author?: unknown;
    content?: unknown;
    attachments?: unknown;
    reactions?: unknown;
  };
  const id = texto(m._id);
  const autorId = texto(m.author);
  if (id === undefined || autorId === undefined) return undefined;

  let midia: AberturaCrua["midia"];
  if (Array.isArray(m.attachments)) {
    for (const a of m.attachments as {
      _id?: unknown;
      tag?: unknown;
      filename?: unknown;
      content_type?: unknown;
      size?: unknown;
      metadata?: { type?: unknown; width?: unknown; height?: unknown };
    }[]) {
      const tipoMeta = a?.metadata?.type;
      if (tipoMeta !== "Image" && tipoMeta !== "Video") continue;
      const aid = texto(a._id);
      if (aid === undefined) continue;
      const nomeDoArquivo = texto(a.filename) ?? aid;
      midia = {
        id: aid,
        tag: texto(a.tag) ?? "attachments",
        nome: nomeDoArquivo,
        tipo:
          tipoMeta === "Video" ? "video" : a.content_type === "image/gif" ? "gif" : "imagem",
        largura: typeof a.metadata?.width === "number" ? a.metadata.width : undefined,
        altura: typeof a.metadata?.height === "number" ? a.metadata.height : undefined,
        spoiler: nomeDoArquivo.startsWith("SPOILER_"),
        tamanho: typeof a.size === "number" && a.size >= 0 ? a.size : undefined,
      };
      break;
    }
  }

  return {
    id,
    autorId,
    texto: typeof m.content === "string" ? m.content : "",
    midia,
    reacao: reacaoPrincipal(m.reactions),
  };
}

/**
 * A reação com mais gente, do mapa cru `emoji → IDs`.
 *
 * Empate fica com a que o protocolo listou primeiro — a ordem do mapa é a de
 * chegada, então é a mais antiga, e o card não troca de emoji a cada
 * republicação. IDs repetidos contam uma vez: o total é de PESSOAS.
 */
export function reacaoPrincipal(v: unknown): AberturaCrua["reacao"] {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return undefined;
  let melhor: AberturaCrua["reacao"];
  for (const [emoji, quem] of Object.entries(v as Record<string, unknown>)) {
    const total = new Set(textos(quem)).size;
    if (emoji === "" || total === 0) continue;
    if (melhor === undefined || total > melhor.total) melhor = { emoji, total };
  }
  return melhor;
}

/* ------------------------------------------------------------ o registro */

const foruns = new Map<string, MetaDeForum>();
const topicos = new Map<string, MetaDeTopico>();
const servidorDoCanal = new Map<string, string>();
/**
 * Mensagens de dentro de cada tópico.
 *
 * Semeado pela listagem (`message_counts`) e somado a cada `Message` que
 * chega. Um tópico que a listagem nunca trouxe começa em `undefined` — "não
 * sei" —, e não em zero: zero seria afirmar que ninguém respondeu.
 */
const contagens = new Map<string, number>();
/** Keyed pelo TÓPICO: a abertura de um tópico de mensagem mora no canal pai. */
const aberturas = new Map<string, AberturaCrua>();

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

export function lerContagem(channelId: string): number | undefined {
  return contagens.get(channelId);
}

export function lerAbertura(channelId: string): AberturaCrua | undefined {
  return aberturas.get(channelId);
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
  const c = bruto as {
    _id?: unknown;
    server?: unknown;
    name?: unknown;
    last_message_id?: unknown;
    forum?: unknown;
    thread?: unknown;
  };
  const id = texto(c._id);
  if (id === undefined) return false;
  const serverId = texto(c.server);
  if (serverId !== undefined) servidorDoCanal.set(id, serverId);

  const forum = traduzirForum(c.forum);
  const traduzido = traduzirTopico(
    c.thread,
    serverId,
    typeof c.name === "string" ? c.name : "",
    texto(c.last_message_id),
  );
  // O autor da última não viaja no objeto do canal: preserva o que o socket disse.
  const topico = traduzido && { ...traduzido, ultimoAutorId: topicos.get(id)?.ultimoAutorId };
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
 * Semeia contagens e aberturas vindas da listagem de tópicos.
 *
 * As mensagens chegam soltas; quem diz de qual tópico cada uma é a abertura é
 * o próprio tópico — por isso o cruzamento percorre os tópicos, e não as
 * mensagens.
 */
export function semearListagem(
  contagensDaRede: Readonly<Record<string, number>>,
  mensagens: readonly unknown[],
): void {
  const mudaram = new Set<string>();
  for (const [id, n] of Object.entries(contagensDaRede)) {
    if (typeof n !== "number" || contagens.get(id) === n) continue;
    contagens.set(id, n);
    mudaram.add(id);
  }
  const porMensagem = new Map<string, AberturaCrua>();
  for (const m of mensagens) {
    const a = traduzirAbertura(m);
    if (a) porMensagem.set(a.id, a);
  }
  for (const [id, meta] of topicos) {
    const a = meta.aberturaId ? porMensagem.get(meta.aberturaId) : undefined;
    if (a && aberturas.get(id) !== a) {
      aberturas.set(id, a);
      mudaram.add(id);
    }
  }
  avisar([...mudaram]);
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
    channel?: unknown;
    _id?: unknown;
    data?: { forum?: unknown; thread?: unknown; name?: unknown };
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
      if (anotar(e)) mudaram.push(String(e._id));
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
      const antes = topicos.get(id);
      const nome = typeof e.data.name === "string" ? e.data.name : undefined;
      if (e.data.thread !== undefined) {
        const topico = traduzirTopico(
          e.data.thread,
          servidorDoCanal.get(id),
          nome ?? antes?.nome ?? "",
          antes?.ultimaMensagemId,
        );
        if (topico && !mesmoTopico(antes, topico)) {
          topicos.set(id, { ...topico, ultimoAutorId: antes?.ultimoAutorId });
          mudou = true;
        }
      } else if (antes && nome !== undefined && nome !== antes.nome) {
        // Renomear sem mexer no resto chega só com `name`.
        topicos.set(id, { ...antes, nome });
        mudou = true;
      }
      if (mudou) mudaram.push(id);
      return;
    }
    case "Message": {
      /*
        Uma mensagem dentro de um tópico move três coisas: a contagem, a última
        atividade e — no post recém-criado — a abertura, que É a primeira
        mensagem de dentro.

        Sob o firehose isto roda 500 vezes por segundo contra canais que não
        são tópico: o `get` é a única coisa que acontece nesses casos.
      */
      const canal = texto(e.channel);
      const meta = canal === undefined ? undefined : topicos.get(canal);
      if (canal === undefined || meta === undefined) return;
      const mid = texto(e._id);
      if (mid === undefined || mid === meta.ultimaMensagemId) return;
      const n = contagens.get(canal);
      if (n !== undefined) contagens.set(canal, n + 1);
      if (meta.aberturaId === undefined || meta.aberturaId === mid) {
        const a = traduzirAbertura(evento);
        if (a) aberturas.set(canal, a);
      }
      topicos.set(canal, {
        ...meta,
        ultimaMensagemId: mid,
        ultimoAutorId: texto((evento as { author?: unknown }).author),
        aberturaId: meta.aberturaId ?? mid,
      });
      mudaram.push(canal);
      return;
    }
    case "ChannelDelete": {
      const id = texto(e.id);
      if (id === undefined) return;
      // Os dois `delete` sempre rodam: `||` pararia no primeiro.
      const tinhaForum = foruns.delete(id);
      const tinhaTopico = topicos.delete(id);
      const tinha = tinhaForum || tinhaTopico;
      contagens.delete(id);
      aberturas.delete(id);
      servidorDoCanal.delete(id);
      if (tinha) mudaram.push(id);
      return;
    }
    default:
      return;
  }
}

/**
 * Escreve a meta de um tópico sem esperar o eco do servidor.
 *
 * Existe para seguir e arquivar: a rota de seguir responde vazio, e o
 * `ChannelUpdate` que confirma chega pelo socket. Sem isto o botão ficaria um
 * instante afirmando o estado anterior ao clique.
 */
export function escreverTopico(channelId: string, meta: MetaDeTopico): void {
  if (mesmoTopico(topicos.get(channelId), meta)) return;
  topicos.set(channelId, meta);
  avisar([channelId]);
}

/** Só para testes e para o fim da sessão. */
export function limparMetaDeCanal(): void {
  foruns.clear();
  topicos.clear();
  servidorDoCanal.clear();
  contagens.clear();
  aberturas.clear();
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
    a.nome === b.nome &&
    a.ultimaMensagemId === b.ultimaMensagemId &&
    a.ultimoAutorId === b.ultimoAutorId &&
    a.paiId === b.paiId &&
    a.donoId === b.donoId &&
    a.aberturaId === b.aberturaId &&
    a.arquivado === b.arquivado &&
    a.fixado === b.fixado &&
    a.emAnalise === b.emAnalise &&
    a.serverId === b.serverId &&
    mesmaLista(a.tags, b.tags) &&
    mesmaLista(a.seguidores, b.seguidores)
  );
}
