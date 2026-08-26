/**
 * A ponte stoat.js → React. A peça mais crítica do projeto.
 *
 * Não é overhead de migração: é a camada onde a granularidade de update é
 * decidida, e portanto onde a performance do app é definida.
 *
 * Duas granularidades, e a separação entre elas é o ponto:
 *
 *   coleção  → assina lista de IDs, alimentada por evento do Client em O(1)
 *   entidade → assina a si mesma, via efeito Solid sobre os getters do SDK
 *
 * Editar uma mensagem toca uma linha. Mensagem nova toca a lista, mas a lista
 * só renderiza IDs — as linhas existentes têm as mesmas keys e não remontam.
 *
 * Este é o ÚNICO módulo, junto de `map.ts` e `client.ts`, que importa
 * `stoat.js`. O lint de boundary garante isso.
 */
import { createEffect, createRoot } from "solid-js";

import { count } from "../dev/stats";
import { createEntityStore } from "../store/entities";
import { createEphemeralStore } from "../store/ephemeral";
import { client } from "./client";
import type { MessageSnapshot, PresenceStatus } from "./domain";
import { calcularLayout, type Layout } from "./agrupamento";
import { toMessageSnapshot, toPresence } from "./map";

/* ----------------------------------------------------------- layout */

/**
 * Agrupamento e divisor de data por mensagem.
 *
 * Depende do VIZINHO, e a lei nº 1 diz que a linha assina só a si mesma —
 * então a dependência é resolvida aqui, na escrita, e chega ao componente já
 * como campo do snapshot.
 *
 * O que torna isso barato: `authorId` e `createdAt` são imutáveis depois da
 * criação. Editar uma mensagem, reagir a ela ou resolver um upload NÃO mexem
 * no layout de ninguém. Só inserção e remoção mexem — e aí só nos vizinhos
 * imediatos, não na lista.
 */
const layouts = new Map<string, Layout>();

const PADRAO: Layout = { iniciaGrupo: true, dia: undefined };

export function layoutDe(id: string): Layout {
  return layouts.get(id) ?? PADRAO;
}

/** Dados que o agrupamento precisa, lidos do SDK. */
function vizinho(id: string | undefined) {
  if (!id) return null;
  const m = client.messages.get(id);
  if (!m) return null;
  return { authorId: m.authorId, createdAt: m.createdAt.getTime() };
}

/**
 * Recalcula o layout de um trecho e re-emite os snapshots que mudaram.
 *
 * Re-emitir só quem mudou é o que preserva o `memo` da linha: publicar um
 * snapshot novo para toda a lista faria as 25 linhas visíveis re-renderizarem
 * a cada mensagem que chega.
 */
function recalcularLayout(channelId: string, de: number, ate: number) {
  const ids = idsOf(channelId);
  const inicio = Math.max(0, de);
  const fim = Math.min(ids.length - 1, ate);

  for (let i = inicio; i <= fim; i++) {
    const id = ids[i];
    if (!id) continue;

    const atual = vizinho(id);
    if (!atual) continue;

    const novo = calcularLayout(atual, vizinho(ids[i - 1]));
    const velho = layouts.get(id);
    if (velho && velho.iniciaGrupo === novo.iniciaGrupo && velho.dia === novo.dia) {
      continue;
    }

    layouts.set(id, novo);

    // Só re-emite o que alguém está olhando. Snapshot de mensagem fora da
    // janela é recalculado quando a linha montar.
    const message = client.messages.get(id);
    if (message && messages.subscriberCount(id) > 0) {
      messages.set(id, toMessageSnapshot(message, novo));
    }
  }
}

/* -------------------------------------------------------------- entidade */

/**
 * Efeito Solid por mensagem assinada. Os getters do SDK são backed por store
 * Solid, então ler `content` aqui dentro rastreia AQUELE campo: o efeito só
 * re-roda quando aquela mensagem muda.
 *
 * O teardown volta para o store, que o chama quando o último assinante sai.
 * Sem isso, uma sessão de 8h acumula um efeito por mensagem já vista.
 */
export const messages = createEntityStore<MessageSnapshot>((id) => {
  // Resolve JÁ, não no próximo tick. O efeito Solid é agendado, e uma linha
  // que monta antes dele roda um render com `undefined` — que numa lista
  // virtualizada vira altura zero e realimenta a medição.
  const initial = client.messages.get(id);
  if (initial) messages.set(id, toMessageSnapshot(initial, layoutDe(id)));

  return createRoot((dispose) => {
    createEffect(() => {
      const message = client.messages.get(id);
      if (message) {
        messages.set(id, toMessageSnapshot(message, layoutDe(id)));
        count("snapshots");
      }
    });
    return dispose;
  });
});

/* ---------------------------------------------------------------- coleção */

/**
 * O SDK não tem índice por canal — `client.messages` é um Map plano e o canal
 * só conhece `lastMessageId`. Então o índice é do app, e é mantido por evento,
 * nunca por varredura da coleção.
 */
export const channelMessageIds = createEntityStore<readonly string[]>();

const index = new Map<string, string[]>();

function idsOf(channelId: string): string[] {
  let ids = index.get(channelId);
  if (!ids) {
    ids = [];
    index.set(channelId, ids);
  }
  return ids;
}

/**
 * Publicação coalescida por frame.
 *
 * A versão ingênua publicava por evento. O firehose mostrou o custo real disso,
 * e ele não aparece no regime permanente — aparece na CARGA: semear um canal
 * emite um `messageCreate` por mensagem, e publicar em cada um significa N
 * cópias do array de IDs e N renders do React. Em 10k mensagens isso é
 * quadrático, e é exatamente o caminho que a app percorre ao abrir um canal ou
 * paginar histórico.
 *
 * Coalescer no frame resolve os dois casos com o mesmo mecanismo: uma
 * publicação por frame, independente de quantos eventos chegaram. O
 * `followOnAppend` do virtualizador continua correto — ele reancora por frame,
 * não por evento.
 */
const dirty = new Set<string>();
let flushHandle: number | undefined;

function flushPublications() {
  flushHandle = undefined;
  const started = performance.now();
  for (const channelId of dirty) {
    channelMessageIds.set(channelId, [...idsOf(channelId)]);
    count("publishes");
  }
  dirty.clear();
  count("publishMs", performance.now() - started);
}

function publish(channelId: string) {
  dirty.add(channelId);
  flushHandle ??= requestAnimationFrame(flushPublications);
}

/** Publicação imediata, para setup — não há frame para esperar. */
function publishNow(channelId: string) {
  dirty.delete(channelId);
  channelMessageIds.set(channelId, [...idsOf(channelId)]);
}

/* --------------------------------------------------------------- efêmero */

export const presence = createEphemeralStore<PresenceStatus>();
export const typing = createEphemeralStore<readonly string[]>();

const typingByChannel = new Map<string, Set<string>>();

/* ----------------------------------------------------------- subscrições */

let started = false;

/**
 * Idempotente de propósito. `StrictMode` invoca effects duas vezes em dev e
 * numa app 100% websocket isso geraria listener duplicado e mensagem dobrada.
 * A defesa é estrutural: a subscrição vive aqui, module-level, não num
 * `useEffect` por componente.
 */
export function startAdapter() {
  if (started) return;
  started = true;

  client.on("messageCreate", (message) => {
    const ids = idsOf(message.channelId);
    ids.push(message.id);
    // Só a recém-chegada muda de layout: ela olha para trás, e ninguém
    // olha para ela. É o caminho quente, e é O(1).
    recalcularLayout(message.channelId, ids.length - 1, ids.length - 1);
    publish(message.channelId);
  });

  client.on("messageDelete", (message) => {
    const channelId = message.channelId;
    if (!channelId) return;
    const ids = idsOf(channelId);
    const at = ids.indexOf(message.id);
    if (at === -1) return;
    ids.splice(at, 1);
    // A que vinha depois passa a olhar para outro vizinho — pode deixar de
    // continuar um grupo, ou passar a abrir um dia.
    recalcularLayout(channelId, at, at);
    publish(channelId);
  });

  client.on("userUpdate", (user) => {
    // Presença vai para o store efêmero, com throttle na fronteira do adapter.
    // Nunca para o store de mensagens: um servidor grande emite centenas
    // destes por segundo e a lista inteira acordaria a cada piscada.
    presence.set(user.id, toPresence(user.status?.presence));
  });

  client.on("channelStartTyping", (channel, user) => {
    if (!user) return;
    let set = typingByChannel.get(channel.id);
    if (!set) {
      set = new Set();
      typingByChannel.set(channel.id, set);
    }
    set.add(user.id);
    typing.set(channel.id, [...set]);
  });

  client.on("channelStopTyping", (channel, user) => {
    if (!user) return;
    const set = typingByChannel.get(channel.id);
    if (!set) return;
    set.delete(user.id);
    typing.set(channel.id, [...set]);
  });
}

/** SONDA: o id está assinado? o snapshot acompanhou o SDK? */
export function diagnostico(id: string) {
  return {
    assinado: messages.subscriberCount(id) > 0,
    assinantes: messages.subscriberCount(id),
    noStore: messages.getSnapshot(id)?.content,
    noSdk: client.messages.get(id)?.content,
  };
}

/** Semeia o canal sem passar por evento — é setup, não carga medida. */
export function seedChannel(channelId: string, ids: readonly string[]) {
  const target = idsOf(channelId);
  target.length = 0;
  target.push(...ids);
  recalcularLayout(channelId, 0, target.length - 1);
  publishNow(channelId);
}

/**
 * Histórico: mensagens ANTIGAS entram na frente da lista.
 *
 * É o contrato invertido da virtualização normal, e a razão de o virtualizador
 * rodar em modo chat. O usuário está lendo algo no meio do histórico; carregar
 * uma página anterior aumenta o total acima do viewport, e se nada compensar,
 * o conteúdo que ele está lendo desce e ele perde o lugar.
 *
 * Quem compensa é o TanStack: ao ver as chaves de borda mudarem, ele guarda a
 * chave do item sob o scroll e o offset relativo, e depois de remedir devolve
 * o scroll para o mesmo ponto daquele item. Por isso `getItemKey` precisa ser
 * ID de entidade — com índice, a chave sob o viewport muda de significado a
 * cada prepend e a âncora aponta para outra mensagem.
 *
 * Vai pelo mesmo `publish` coalescido do append: paginação dispara em rajada
 * quando o usuário rola rápido para cima, e uma publicação por página seria o
 * mesmo custo quadrático da carga.
 */
export function prependHistory(channelId: string, antigas: readonly string[]) {
  if (antigas.length === 0) return;
  const target = idsOf(channelId);
  target.unshift(...antigas);
  // A página nova, mais a primeira que já existia: ela deixou de ser a
  // primeira, então perde o divisor de dia que só tinha por ser o topo.
  // É o único caso em que uma linha muda de layout sem mudar de conteúdo.
  recalcularLayout(channelId, 0, antigas.length);
  publish(channelId);
}
