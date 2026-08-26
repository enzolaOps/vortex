/**
 * SDK → domínio. A única tradução do projeto.
 *
 * Tudo o que o resto do app enxerga passa por aqui. Derivação acontece nesta
 * escrita — uma vez, quando a entidade muda — e nunca no `getSnapshot`.
 */
import type { Channel, Message, Server, ServerMember, User } from "stoat.js";

import type { Layout } from "./agrupamento";
import type {
  ChannelSnapshot,
  MemberSnapshot,
  MessageSnapshot,
  PresenceStatus,
  SendState,
  ServerSnapshot,
} from "./domain";

/**
 * `reactions` chega como ReactiveMap<emoji, ReactiveSet<userId>>. Achatar aqui
 * é deliberado: o componente recebe contagem pronta e não itera Set no render.
 */
function flattenReactions(message: Message): ReadonlyMap<string, number> {
  const out = new Map<string, number>();
  for (const [emoji, users] of message.reactions) {
    out.set(emoji, users.size);
  }
  return out;
}

// Um formatter por sessão, não um por chamada — criar Intl.DateTimeFormat é
// caro; usar é barato.
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/**
 * O layout e o estado de envio entram por parâmetro, não são calculados aqui.
 *
 * Este módulo traduz UMA entidade e não conhece vizinho nem histórico de
 * envio — quem sabe a ordem da lista e o que já chegou no servidor é o
 * adapter. Passar os dois de fora mantém a tradução pura e deixa as únicas
 * partes que dependem de contexto num lugar só.
 */
export function toMessageSnapshot(
  message: Message,
  layout: Layout,
  sendState: SendState,
): MessageSnapshot {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    content: message.content,
    createdAt: message.createdAt.getTime(),
    createdAtText: HORA.format(message.createdAt),
    editedAt: message.editedAt?.getTime(),
    reactions: flattenReactions(message),
    // O protocolo não carrega isto: quem mantém é o adapter, e mensagem que
    // veio do servidor nasce "sent". É a camada anticorrupção fazendo o
    // trabalho para o qual existe.
    sendState,
    iniciaGrupo: layout.iniciaGrupo,
    dia: layout.dia,
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
    naoLidas,
    mencoes,
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
    cor,
    silenciadoAte,
  };
}
