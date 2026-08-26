/**
 * SDK → domínio. A única tradução do projeto.
 *
 * Tudo o que o resto do app enxerga passa por aqui. Derivação acontece nesta
 * escrita — uma vez, quando a entidade muda — e nunca no `getSnapshot`.
 */
import type { Message } from "stoat.js";

import type { Layout } from "./agrupamento";
import type { MessageSnapshot, PresenceStatus } from "./domain";

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
 * O layout entra por parâmetro, não é calculado aqui.
 *
 * Este módulo traduz UMA entidade e não conhece vizinho — quem sabe a ordem
 * da lista é o adapter. Passar o layout de fora mantém a tradução pura e
 * deixa a única parte que depende de posição num lugar só.
 */
export function toMessageSnapshot(
  message: Message,
  layout: Layout,
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
    // O protocolo não carrega isto. Default no adapter — é a camada
    // anticorrupção fazendo o trabalho para o qual existe.
    sendState: "sent",
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
