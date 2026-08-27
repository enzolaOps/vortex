/**
 * SDK → domínio. A única tradução do projeto.
 *
 * Tudo o que o resto do app enxerga passa por aqui. Derivação acontece nesta
 * escrita — uma vez, quando a entidade muda — e nunca no `getSnapshot`.
 */
import type {
  Channel,
  ChannelRenamedSystemMessage,
  Message,
  Server,
  ServerMember,
  TextSystemMessage,
  User,
  UserModeratedSystemMessage,
  UserSystemMessage,
} from "stoat.js";

import type { Layout } from "./agrupamento";
import type {
  ChannelSnapshot,
  MemberSnapshot,
  AnexoSnapshot,
  MessageSnapshot,
  ParteDeMensagem,
  PresenceStatus,
  SendState,
  ReacaoSnapshot,
  ServerSnapshot,
  SistemaSnapshot,
} from "./domain";

/**
 * `reactions` chega como ReactiveMap<emoji, ReactiveSet<userId>>. Achatar aqui
 * é deliberado: o componente recebe contagem pronta e não itera Set no render.
 */
function flattenReactions(
  message: Message,
  euId: string | undefined,
): readonly ReacaoSnapshot[] {
  const out: ReacaoSnapshot[] = [];
  for (const [emoji, users] of message.reactions) {
    // Reação sem ninguém não é reação: o SDK pode deixar a chave com Set
    // vazio depois da última remoção, e um chip com "0" seria pior que nada.
    if (users.size === 0) continue;
    out.push({
      emoji,
      total: users.size,
      minha: euId !== undefined && users.has(euId),
    });
  }
  return out.length === 0 ? SEM_REACOES : out;
}

/** Referência compartilhada: a maioria das mensagens não tem reação nenhuma. */
const SEM_REACOES: readonly ReacaoSnapshot[] = [];

// Um formatter por sessão, não um por chamada — criar Intl.DateTimeFormat é
// caro; usar é barato.
/**
 * Um array vazio COMPARTILHADO.
 *
 * `?? []` alocaria um array novo a cada tradução, e o snapshot precisa ser
 * comparável por referência — é a armadilha nº 1 do briefing, na sua forma
 * mais fácil de escrever sem perceber.
 */
const VAZIO: readonly string[] = [];

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * Tipos do protocolo que este cliente ainda não estrutura.
 *
 * Rotulados em português aqui, e não deixados vazar como `"message_pinned"`:
 * string de protocolo na interface é vazamento da forma do Stoat para dentro
 * do produto, que é exatamente o que esta camada existe para impedir.
 */
const ROTULO_BRUTO: Record<string, string> = {
  channel_description_changed: "mudou a descrição do canal",
  channel_icon_changed: "mudou o ícone do canal",
  channel_ownership_changed: "transferiu o canal",
  message_pinned: "fixou uma mensagem",
  message_unpinned: "desafixou uma mensagem",
  call_started: "iniciou uma chamada",
};

/**
 * SDK → domínio, para linha de sistema.
 *
 * As cinco estruturadas cobrem o que um servidor produz o dia inteiro. O resto
 * cai em `texto`, com rótulo em português — e o `type` cru no fim é a última
 * defesa, para um tipo novo do upstream aparecer como algo em vez de nada.
 */
function toSistema(message: Message): SistemaSnapshot | undefined {
  const sm = message.systemMessage;
  if (!sm) return undefined;

  switch (sm.type) {
    case "user_joined":
      return { tipo: "entrou", userId: (sm as UserSystemMessage).userId };
    case "user_left":
      return { tipo: "saiu", userId: (sm as UserSystemMessage).userId };
    case "user_added":
      return {
        tipo: "adicionou",
        userId: (sm as UserModeratedSystemMessage).userId,
        porId: (sm as UserModeratedSystemMessage).byId,
      };
    case "user_remove":
      return {
        tipo: "removeu",
        userId: (sm as UserModeratedSystemMessage).userId,
        porId: (sm as UserModeratedSystemMessage).byId,
      };
    case "channel_renamed":
      return {
        tipo: "renomeou",
        porId: (sm as ChannelRenamedSystemMessage).byId,
        nome: (sm as ChannelRenamedSystemMessage).name,
      };
    case "text":
      return { tipo: "texto", texto: (sm as TextSystemMessage).content };
    default:
      return {
        tipo: "texto",
        texto: ROTULO_BRUTO[sm.type] ?? "evento do sistema",
      };
  }
}

/**
 * O layout e o estado de envio entram por parâmetro, não são calculados aqui.
 *
 * Este módulo traduz UMA entidade e não conhece vizinho nem histórico de
 * envio — quem sabe a ordem da lista e o que já chegou no servidor é o
 * adapter. Passar os dois de fora mantém a tradução pura e deixa as únicas
 * partes que dependem de contexto num lugar só.
 */
/**
 * Parte o texto em trechos, separando as menções.
 *
 * Devolve o texto inteiro num array de um elemento quando não há menção
 * nenhuma, que é o caso comum — assim quem renderiza tem um caminho só.
 *
 * O nome do usuário NÃO é resolvido aqui. Quem sabe o nome é a member list, e
 * puxá-la para dentro do mapeamento de mensagem acoplaria as duas coleções por
 * uma linha de texto. O componente resolve, porque ele já assina o membro.
 */
export function fatiarMencoes(texto: string): readonly ParteDeMensagem[] {
  if (!texto.includes("<@")) return [{ tipo: "texto", valor: texto }];

  const out: ParteDeMensagem[] = [];
  const padrao = /<@([0-9A-Za-z]+)>/g;
  let ultimo = 0;
  for (const m of texto.matchAll(padrao)) {
    const i = m.index;
    if (i > ultimo) out.push({ tipo: "texto", valor: texto.slice(ultimo, i) });
    out.push({ tipo: "mencao", valor: m[1]!, de: i });
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) {
    out.push({ tipo: "texto", valor: texto.slice(ultimo) });
  }
  return out;
}

const SEM_ANEXOS: readonly AnexoSnapshot[] = [];

/**
 * Os anexos, reduzidos ao que a linha precisa.
 *
 * A dimensão é o que importa aqui e é o que o protocolo dá: `Metadata` carrega
 * `width` e `height` para imagem e vídeo. Sem eles a linha só descobre a
 * altura quando o arquivo carrega — e aí ela já foi medida com a altura
 * errada, num container ancorado.
 *
 * `type` do protocolo tem cinco valores e o app tem três. "Text" e "Audio"
 * caem em `arquivo` porque a interface faz com eles a mesma coisa: uma caixa
 * de altura fixa com nome e tamanho. Colapsar aqui é o trabalho da camada
 * anticorrupção — o componente não deve conhecer cinco casos para desenhar
 * três.
 */
function toAnexos(message: Message): readonly AnexoSnapshot[] {
  const arquivos = message.attachments;
  if (!arquivos || arquivos.length === 0) return SEM_ANEXOS;

  return arquivos.map((f) => {
    const m = f.metadata;
    const dimensionado = m.type === "Image" || m.type === "Video";
    return {
      id: f.id,
      nome: f.filename ?? f.id,
      // `originalUrl` e não `previewUrl`: a miniatura é decisão de
      // apresentação, e ela entra quando houver servidor para servi-la.
      url: f.originalUrl,
      tipo:
        m.type === "Image" ? "imagem" : m.type === "Video" ? "video" : "arquivo",
      largura: dimensionado ? m.width : undefined,
      altura: dimensionado ? m.height : undefined,
    } as const;
  });
}

export function toMessageSnapshot(
  message: Message,
  layout: Layout,
  sendState: SendState,
  /** Quem sou eu — para saber quais reações são minhas. Vem de fora, como tudo. */
  euId: string | undefined,
): MessageSnapshot {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    content: message.content,
    /*
      Fatiado UMA VEZ, na escrita — nunca no render.

      Uma menção é `<@id>` no texto cru, e transformar isso em `@nome` exige
      partir a string. Fazer isso no render seria refazer o mesmo trabalho a
      cada re-render da linha mais quente do app — o mesmo erro que fez
      `toLocaleTimeString` sair do render e virar `createdAtText`.

      A esmagadora maioria das mensagens não menciona ninguém, e para elas o
      custo é um `includes` que falha e um array de um elemento.
    */
    partes: fatiarMencoes(message.content),
    anexos: toAnexos(message),
    /** Menciona VOCÊ — a linha inteira se destaca por isso. */
    mencionaVoce: euId !== undefined && message.content.includes(`<@${euId}>`),
    createdAt: message.createdAt.getTime(),
    createdAtText: HORA.format(message.createdAt),
    editedAt: message.editedAt?.getTime(),
    sistema: toSistema(message),
    respostas: message.replyIds ?? VAZIO,
    fixada: message.pinned,
    reactions: flattenReactions(message, euId),
    // O protocolo não carrega isto: quem mantém é o adapter, e mensagem que
    // veio do servidor nasce "sent". É a camada anticorrupção fazendo o
    // trabalho para o qual existe.
    sendState,
    iniciaGrupo: layout.iniciaGrupo,
    dia: layout.dia,
    primeiraNaoLida: layout.primeiraNaoLida,
  };
}

const PRESENCE: Record<string, PresenceStatus> = {
  Online: "online",
  Idle: "idle",
  Busy: "dnd",
  Focus: "idle",
  Invisible: "offline",
  Offline: "offline",
};

export function toPresence(raw: string | null | undefined): PresenceStatus {
  return (raw && PRESENCE[raw]) || "offline";
}

/* ------------------------------------------------------- colunas laterais */

/**
 * Iniciais para o avatar sem imagem.
 *
 * Uma letra por palavra, no máximo duas. `Intl.Segmenter` seria o correto para
 * emoji e escrita complexa; `[...nome]` já resolve par substituto, que é o caso
 * que quebra `charAt` em nome com emoji.
 */
function sigla(nome: string): string {
  const partes = nome.trim().split(/[\s_.-]+/).filter(Boolean);
  const letras = partes.slice(0, 2).map((parte) => [...parte][0] ?? "");
  return letras.join("").toUpperCase() || "?";
}

/**
 * As contagens entram por parâmetro pelo mesmo motivo de `sendState`: elas não
 * existem no protocolo, quem as mantém é o adapter, e este módulo traduz uma
 * entidade sem saber o que aconteceu antes dela.
 */
export function toServerSnapshot(
  server: Server,
  naoLidas: number,
  mencoes: number,
): ServerSnapshot {
  return {
    id: server.id,
    name: server.name,
    sigla: sigla(server.name),
    naoLidas,
    mencoes,
  };
}

/**
 * Canal de voz.
 *
 * O protocolo NÃO tem `channel_type: "VoiceChannel"` — a união é
 * `SavedMessages | DirectMessage | Group | TextChannel`. Canal de voz é um
 * TextChannel que carrega um objeto `voice` ("voice chats v2"), e é isso que
 * `isVoice` detecta.
 *
 * Descoberto verificando em navegador: o arnês criava `"VoiceChannel"`, a
 * hidratação aceitava calada (o campo entra como string qualquer) e o canal
 * aparecia entre os de texto. Nenhum erro, nenhum aviso — só a seção errada.
 *
 * A restrição a DM e Grupo é deliberada: para eles `isVoice` é `true` no
 * sentido de "pode ter chamada", não de "é um canal de voz". O snapshot é do
 * domínio e vale em toda parte, então a diferença fica explícita aqui em vez
 * de virar surpresa na primeira tela de DMs.
 */
export function ehCanalDeVoz(channel: Channel): boolean {
  return (
    channel.isVoice &&
    channel.type !== "DirectMessage" &&
    channel.type !== "Group"
  );
}

export function toChannelSnapshot(
  channel: Channel,
  naoLidas: number,
  mencoes: number,
): ChannelSnapshot {
  return {
    id: channel.id,
    // `serverId` é string no SDK mesmo para canal de DM, onde vem vazia. O
    // domínio prefere `undefined` — "não pertence a servidor" é ausência, não
    // string vazia, e é o que impede um `if (serverId)` errado lá na frente.
    serverId: channel.serverId || undefined,
    name: channel.name,
    tipo: ehCanalDeVoz(channel) ? "voz" : "texto",
    topico: channel.description || undefined,
    naoLidas,
    mencoes,
    /*
      Lido do MODELO, não do store.

      O store é a fonte, mas quem responde é `channel.muted` — e ele passa pela
      opção `channelIsMuted` que o cliente registrou. Ler do modelo é o que
      garante uma verdade só: no dia em que silêncio herdar do servidor, a
      regra muda numa função e o snapshot continua certo.
    */
    silenciado: channel.muted,
  };
}

/**
 * O apelido do servidor ganha do username — é o nome que a pessoa escolheu
 * naquele lugar.
 *
 * O `ServerMember` entra por parâmetro, e não é buscado aqui, porque este
 * módulo traduz uma entidade de cada vez: quem sabe de qual servidor se fala é
 * o adapter, que é dono da chave composta.
 *
 * `membro` é opcional porque nem todo usuário renderizado é membro de servidor
 * — autor de DM não é. Sem ele, cai no username e em nenhum cargo, que é a
 * resposta certa e não um estado degradado.
 */
export function toMemberSnapshot(
  user: User,
  membro: ServerMember | undefined,
): MemberSnapshot {
  const displayName = membro?.nickname || user.username;

  // `roleColour` pode vir `null` do protocolo — sem cargo colorido. `null` e
  // `undefined` significam a mesma coisa para o domínio, e carregar os dois
  // faria todo consumidor testar duas ausências diferentes.
  const cor = membro?.roleColour ?? undefined;

  // `getTime()` aqui, e não o `Date`: o snapshot precisa ser comparável por
  // valor. Guardar o objeto faria toda republicação parecer mudança.
  const silenciadoAte = membro?.timeout?.getTime();

  return {
    id: user.id,
    displayName,
    sigla: sigla(displayName),
    username: user.username,
    // Pronomes do MEMBRO ganham dos do usuário: o protocolo permite declarar
    // diferente por servidor, e quem faz isso está dizendo algo naquele lugar.
    pronomes: membro?.pronouns || user.pronouns || undefined,
    statusTexto: user.status?.text || undefined,
    cor,
    silenciadoAte,
  };
}
