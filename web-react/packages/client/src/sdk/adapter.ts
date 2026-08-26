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
import { monotonicFactory } from "ulid";

import { count } from "../dev/stats";
import { createEntityStore } from "../store/entities";
import { createEphemeralStore } from "../store/ephemeral";
import { client, conectado } from "./client";
import {
  baldeDe,
  type Balde,
  type ChannelSnapshot,
  type MemberSnapshot,
  type MessageSnapshot,
  type PresenceStatus,
  type SendState,
  type ServerSnapshot,
} from "./domain";
import { calcularLayout, type Layout } from "./agrupamento";
import { criarNotificadorDeDigitacao } from "./digitando";
import {
  ehCanalDeVoz,
  toChannelSnapshot,
  toMemberSnapshot,
  toMessageSnapshot,
  toPresence,
  toServerSnapshot,
} from "./map";

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
      messages.set(id, toMessageSnapshot(message, novo, estadoDeEnvioDe(id)));
    }
  }
}

/* ------------------------------------------------------- estado de envio */

/**
 * Estado de envio por mensagem.
 *
 * O protocolo não tem esse conceito: para o servidor, ou a mensagem existe ou
 * não existe. "Pendente" e "falhou" são estados do CLIENTE, e é exatamente o
 * tipo de coisa que a camada anticorrupção existe para comportar — o modelo do
 * Vortex é mais rico que o do Stoat, e essa diferença fica aqui, num Map, em
 * vez de virar um campo opcional espalhado pelo app.
 *
 * Vive fora do snapshot pelo mesmo motivo do layout: é derivação de escrita.
 * A linha continua assinando só a si mesma.
 */
const estadosDeEnvio = new Map<string, SendState>();

/** Mensagem que veio do servidor não está no Map — e "sent" é a verdade. */
function estadoDeEnvioDe(id: string): SendState {
  return estadosDeEnvio.get(id) ?? "sent";
}

function marcarEnvio(id: string, estado: SendState) {
  if (estadoDeEnvioDe(id) === estado) return;

  if (estado === "sent") estadosDeEnvio.delete(id);
  else estadosDeEnvio.set(id, estado);

  const message = client.messages.get(id);
  if (message && messages.subscriberCount(id) > 0) {
    messages.set(id, toMessageSnapshot(message, layoutDe(id), estado));
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
  if (initial) {
    messages.set(id, toMessageSnapshot(initial, layoutDe(id), estadoDeEnvioDe(id)));
  }

  return createRoot((dispose) => {
    createEffect(() => {
      const message = client.messages.get(id);
      if (message) {
        messages.set(
          id,
          toMessageSnapshot(message, layoutDe(id), estadoDeEnvioDe(id)),
        );
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
/**
 * Servidores cuja member list precisa reordenar.
 *
 * Mesmo frame, mesmo flush. Duas filas de rAF concorrentes publicariam a lista
 * de mensagens e a de membros em frames diferentes — dois relayouts onde um
 * basta, e num painel que divide o mesmo grid do shell.
 */
const membrosSujos = new Set<string>();
let flushHandle: number | undefined;

function flushPublications() {
  flushHandle = undefined;
  const started = performance.now();
  for (const channelId of dirty) {
    channelMessageIds.set(channelId, [...idsOf(channelId)]);
    count("publishes");
  }
  dirty.clear();
  for (const serverId of membrosSujos) {
    publicarMembros(serverId);
    count("publishes");
  }
  membrosSujos.clear();
  count("publishMs", performance.now() - started);
}

function agendarFlush() {
  flushHandle ??= requestAnimationFrame(flushPublications);
}

/**
 * SONDA: o que está esperando o próximo frame?
 *
 * Fica porque respondeu a uma pergunta que o DOM não responde e que custou
 * caro: "a lista está vazia porque o dado não chegou, ou porque a publicação
 * ainda não foi liberada?" — os dois casos renderizam nada.
 *
 * O caso real: numa aba sem composição estável, o `requestAnimationFrame`
 * dispara com intervalos de segundos. A publicação coalescida ficava
 * pendurada, e o sintoma — lista vazia, contador de não-lida correto — parecia
 * exatamente um bug de escopo no adapter. Era o ambiente. Esta sonda é a
 * diferença entre ver `canaisSujos: []` (nada aconteceu) e
 * `canaisSujos: [id], frameAgendado: 4` (aconteceu, o frame é que não veio).
 */
export function estadoDaFila() {
  return {
    canaisSujos: [...dirty],
    membrosSujos: [...membrosSujos],
    frameAgendado: flushHandle ?? "nenhum",
    adapterLigado: started,
  };
}

function publish(channelId: string) {
  dirty.add(channelId);
  agendarFlush();
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
    // Depois do publish, não antes: contabilizar é trabalho da coluna
    // lateral, e o caminho quente da lista não deve esperar por ele.
    contabilizarNaoLida(message.channelId, message.content);
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
    const status = toPresence(user.status?.presence);
    presence.set(user.id, status);
    // A member list só reordena se o BALDE mudou — online↔idle↔dnd não move
    // ninguém, e é a esmagadora maioria destes eventos.
    atualizarBalde(user.id, status);
  });

  client.on("serverCreate", (server) => {
    const lista = serverIds.peek(RAIZ) ?? [];
    if (lista.includes(server.id)) return;
    serverIds.set(RAIZ, [...lista, server.id]);
    canaisPorServidor.set(server.id, [...server.channelIds]);
    publicarCanais(server.id);
  });

  client.on("channelCreate", (channel) => {
    const serverId = channel.serverId;
    if (!serverId) return;
    const ids = canaisPorServidor.get(serverId) ?? [];
    if (ids.includes(channel.id)) return;
    ids.push(channel.id);
    canaisPorServidor.set(serverId, ids);
    publicarCanais(serverId);
  });

  client.on("channelDelete", (channel) => {
    const serverId = channel.serverId;
    if (!serverId) return;
    const ids = canaisPorServidor.get(serverId);
    const at = ids?.indexOf(channel.id) ?? -1;
    if (!ids || at === -1) return;
    ids.splice(at, 1);
    publicarCanais(serverId);
  });

  // Entrada e saída de membro passam pelo flush coalescido: um servidor
  // sincronizando membros emite estes em rajada, e reordenar por evento seria
  // o mesmo custo quadrático que a carga de mensagens já ensinou.
  client.on("serverMemberJoin", (member) => {
    registrarMembro(member.id.server, member.id.user);
    agendarFlush();
  });

  client.on("serverMemberLeave", (member) => {
    removerMembro(member.id.server, member.id.user);
    agendarFlush();
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

/* ------------------------------------------------------------------ envio */

/**
 * Identidade local.
 *
 * Placeholder honesto: não existe sessão ainda, e a mensagem enviada precisa
 * de autor. Um `undefined` silencioso aqui produziria mensagem sem autor, que
 * é bug difícil de ver — a linha renderiza, só fica sem cabeçalho.
 */
let usuarioLocal: string | undefined;

export function definirUsuarioLocal(id: string): void {
  usuarioLocal = id;
}

const proximoId = monotonicFactory();

/**
 * Simulação de round-trip. Temporária, e nomeada para não passar despercebida.
 *
 * Existe porque o caminho de rede NÃO está escrito, e não está por decisão:
 * `Channel.sendMessage` é round-trip completo — POST, o servidor atribui o
 * `_id`, e o SDK só materializa a mensagem quando a resposta volta. Não há
 * inserção otimista nenhuma no SDK.
 *
 * Escrever esse caminho agora seria escrever código que nunca rodou (não há
 * backend conectado), e ele carrega o problema real: a mensagem otimista tem
 * ID local e a que volta tem ID do servidor. Numa lista virtualizada com
 * `getItemKey` por ID de entidade, isso é a chave da linha mudando debaixo do
 * virtualizador. A reconciliação por nonce é pendência aberta e resolve-se
 * AQUI, no adapter, sem o componente saber.
 */
export type SimulacaoDeEnvio = {
  falhar?: boolean;
  latenciaMs?: number;
};

let simulacao: SimulacaoDeEnvio = {};

export function configurarSimulacaoDeEnvio(nova: SimulacaoDeEnvio): void {
  simulacao = nova;
}

/**
 * Envia uma mensagem. Devolve o ID otimista, ou `undefined` se não deu.
 *
 * `undefined` em vez de exceção porque isto roda num handler de tecla: quebrar
 * a árvore do React por causa de um canal que ainda não carregou seria trocar
 * um problema por outro pior. Quem chama mantém o rascunho e a pessoa não
 * perde o que escreveu.
 */
export function enviarMensagem(
  channelId: string,
  conteudo: string,
): string | undefined {
  const texto = conteudo.trim();
  if (!texto) return undefined;

  if (!usuarioLocal || !client.channels.get(channelId)) {
    if (import.meta.env.DEV) {
      console.error(
        "[vortex] envio recusado: " +
          (usuarioLocal ? `canal ${channelId} não carregado` : "sem usuário local") +
          ". O rascunho foi preservado.",
      );
    }
    return undefined;
  }

  const id = proximoId();

  // Pendente ANTES de criar: o `messageCreate` já vai construir o snapshot, e
  // marcar depois faria a linha nascer "enviada" e piscar para pendente.
  estadosDeEnvio.set(id, "pending");

  client.messages.getOrCreate(
    id,
    { _id: id, channel: channelId, author: usuarioLocal, content: texto },
    true,
  );

  digitacao.aoParar(channelId);

  setTimeout(
    () => marcarEnvio(id, simulacao.falhar ? "failed" : "sent"),
    simulacao.latenciaMs ?? 600,
  );

  return id;
}

/* -------------------------------------------------------------- digitação */

/**
 * O lado de saída do estado efêmero, com o transporte injetado.
 *
 * O guard de conexão não é defensivo por hábito: `EventClient.send` LANÇA
 * quando não há socket, e digitar num app desconectado é o caso mais comum
 * que existe — é o que a pessoa faz enquanto espera a reconexão. Um throw
 * dentro do `onChange` do campo derrubaria a digitação inteira.
 */
export const digitacao = criarNotificadorDeDigitacao({
  iniciar: (channelId) => {
    if (conectado()) client.channels.get(channelId)?.startTyping();
  },
  parar: (channelId) => {
    if (conectado()) client.channels.get(channelId)?.stopTyping();
  },
});

/* ==========================================================================
   Colunas laterais — servidores, canais e membros
   ==========================================================================

   Mesmas duas granularidades da lista de mensagens, pelas mesmas razões:

     coleção  → lista de IDs, publicada coalescida por frame
     entidade → assina a si mesma, via efeito Solid sobre os getters do SDK

   O que muda é o volume. Um servidor grande tem dezenas de milhares de
   membros, e a presença — o evento mais volumoso que existe — encosta
   justamente na member list. Por isso a ordenação usa dois baldes e não
   quatro: `online → idle → dnd` não move ninguém de lugar, então a lista não
   republica e só o pontinho de presença acorda.
   ========================================================================== */

/**
 * A lista de servidores é uma coleção só, não uma por chave.
 *
 * Reusar o `EntityStore` com uma chave constante evita um segundo tipo de
 * store só para guardar um array — e mantém a mesma disciplina de referência
 * cacheada que o `useSyncExternalStore` exige.
 */
export const RAIZ = "@raiz";

export const serverIds = createEntityStore<readonly string[]>();
export const membrosOnline = createEntityStore<readonly string[]>();
export const membrosOffline = createEntityStore<readonly string[]>();

/**
 * Canais publicados JÁ SEPARADOS por tipo, e não numa lista só.
 *
 * A tentação é publicar um array e deixar a coluna dividir no render. Não dá,
 * e o motivo é a lei nº 1: a lista de canais assina IDs, não entidades — quem
 * conhece o tipo de um canal é a linha, que assina a si mesma. Para partir no
 * render, a lista teria que ler o snapshot de cada canal sem assinar nenhum,
 * que é ler dado por fora do mecanismo que garante que ele está atualizado.
 *
 * A saída é a mesma dos baldes de presença: quem sabe, publica. A separação
 * acontece na ESCRITA, uma vez, e cada seção é uma referência cacheada que o
 * `useSyncExternalStore` pode comparar.
 */
export const canaisDeTexto = createEntityStore<readonly string[]>();
export const canaisDeVoz = createEntityStore<readonly string[]>();

/* ------------------------------------------------------------- não-lidas */

type Contagem = { naoLidas: number; mencoes: number };

const ZERO: Contagem = { naoLidas: 0, mencoes: 0 };

const contagemPorCanal = new Map<string, Contagem>();
const contagemPorServidor = new Map<string, Contagem>();

function contagemDe(mapa: Map<string, Contagem>, id: string): Contagem {
  return mapa.get(id) ?? ZERO;
}

/**
 * O canal aberto nunca acumula não-lidas.
 *
 * Vive aqui, e não no store de navegação, porque quem decide é o caminho de
 * ESCRITA: perguntar ao React "qual canal está aberto?" de dentro do handler
 * de `messageCreate` inverteria a direção do dado. A navegação empurra para cá.
 */
let canalAberto: string | undefined;

export function definirCanalAberto(channelId: string | undefined): void {
  if (canalAberto === channelId) return;
  canalAberto = channelId;
  if (channelId) marcarCanalLido(channelId);
}

export function marcarCanalLido(channelId: string): void {
  const atual = contagemPorCanal.get(channelId);
  if (!atual) return;

  contagemPorCanal.delete(channelId);

  const serverId = client.channels.get(channelId)?.serverId;
  if (serverId) {
    const servidor = contagemDe(contagemPorServidor, serverId);
    const restante = {
      naoLidas: Math.max(0, servidor.naoLidas - atual.naoLidas),
      mencoes: Math.max(0, servidor.mencoes - atual.mencoes),
    };
    if (restante.naoLidas === 0 && restante.mencoes === 0) {
      contagemPorServidor.delete(serverId);
    } else {
      contagemPorServidor.set(serverId, restante);
    }
    reemitirServidor(serverId);
  }

  reemitirCanal(channelId);
}

/**
 * Menção é do app, não do protocolo.
 *
 * O Stoat carrega `mentions` na mensagem; o Vortex decide o que conta como
 * menção SUA. Hoje é o teu ID no texto — quando existirem menção de cargo e
 * `@everyone`, a regra muda AQUI e nenhum componente fica sabendo.
 */
function ehMencao(conteudo: string): boolean {
  return usuarioLocal !== undefined && conteudo.includes(`<@${usuarioLocal}>`);
}

function contabilizarNaoLida(channelId: string, conteudo: string): void {
  if (channelId === canalAberto) return;

  const canal = contagemDe(contagemPorCanal, channelId);
  const mencao = ehMencao(conteudo) ? 1 : 0;
  contagemPorCanal.set(channelId, {
    naoLidas: canal.naoLidas + 1,
    mencoes: canal.mencoes + mencao,
  });
  reemitirCanal(channelId);

  const serverId = client.channels.get(channelId)?.serverId;
  if (!serverId) return;
  const servidor = contagemDe(contagemPorServidor, serverId);
  contagemPorServidor.set(serverId, {
    naoLidas: servidor.naoLidas + 1,
    mencoes: servidor.mencoes + mencao,
  });
  reemitirServidor(serverId);
}

/* -------------------------------------------------------------- entidades */

/** Só re-emite o que alguém está olhando — a mesma regra do `recalcularLayout`. */
function reemitirCanal(channelId: string): void {
  if (channels.subscriberCount(channelId) === 0) return;
  const canal = client.channels.get(channelId);
  if (!canal) return;
  const c = contagemDe(contagemPorCanal, channelId);
  channels.set(channelId, toChannelSnapshot(canal, c.naoLidas, c.mencoes));
}

function reemitirServidor(serverId: string): void {
  if (servers.subscriberCount(serverId) === 0) return;
  const servidor = client.servers.get(serverId);
  if (!servidor) return;
  const c = contagemDe(contagemPorServidor, serverId);
  servers.set(serverId, toServerSnapshot(servidor, c.naoLidas, c.mencoes));
}

export const servers = createEntityStore<ServerSnapshot>((id) => {
  const inicial = client.servers.get(id);
  if (inicial) {
    const c = contagemDe(contagemPorServidor, id);
    servers.set(id, toServerSnapshot(inicial, c.naoLidas, c.mencoes));
  }

  return createRoot((dispose) => {
    createEffect(() => {
      const servidor = client.servers.get(id);
      if (!servidor) return;
      const c = contagemDe(contagemPorServidor, id);
      servers.set(id, toServerSnapshot(servidor, c.naoLidas, c.mencoes));
    });
    return dispose;
  });
});

export const channels = createEntityStore<ChannelSnapshot>((id) => {
  const inicial = client.channels.get(id);
  if (inicial) {
    const c = contagemDe(contagemPorCanal, id);
    channels.set(id, toChannelSnapshot(inicial, c.naoLidas, c.mencoes));
  }

  return createRoot((dispose) => {
    createEffect(() => {
      const canal = client.channels.get(id);
      if (!canal) return;
      const c = contagemDe(contagemPorCanal, id);
      channels.set(id, toChannelSnapshot(canal, c.naoLidas, c.mencoes));
    });
    return dispose;
  });
});

/**
 * Membro, keyed por ID de USUÁRIO.
 *
 * Pendência conhecida e deliberada: apelido é por servidor (`ServerMember`), e
 * uma chave de usuário não sabe de qual servidor se fala. `toMemberSnapshot`
 * já aceita o apelido — a costura existe; no dia em que a chave virar
 * composta, só este bloco muda.
 */
export const members = createEntityStore<MemberSnapshot>((id) => {
  const inicial = client.users.get(id);
  if (inicial) members.set(id, toMemberSnapshot(inicial, undefined));

  return createRoot((dispose) => {
    createEffect(() => {
      const user = client.users.get(id);
      if (user) members.set(id, toMemberSnapshot(user, undefined));
    });
    return dispose;
  });
});

/* -------------------------------------------------------------- canais */

const canaisPorServidor = new Map<string, string[]>();

/**
 * Publica imediatamente, sem passar pelo flush por frame.
 *
 * A coalescência existe para eventos que chegam aos milhares — mensagem e
 * presença. Canal criado e canal apagado são raros e vêm um de cada vez;
 * enfileirar num rAF só adiaria um frame o que já é barato, e esconderia o
 * efeito de quem estivesse depurando.
 */
function publicarCanais(serverId: string): void {
  const ids = canaisPorServidor.get(serverId) ?? [];
  const texto: string[] = [];
  const voz: string[] = [];
  for (const id of ids) {
    // Mesma função que o snapshot usa. Partir aqui por um critério e rotular
    // a linha por outro daria uma seção "voz" cheia de ícones de `#`.
    const canal = client.channels.get(id);
    (canal && ehCanalDeVoz(canal) ? voz : texto).push(id);
  }
  canaisDeTexto.set(serverId, texto);
  canaisDeVoz.set(serverId, voz);
}

/* ----------------------------------------------------- baldes de presença */

const membrosPorServidor = new Map<string, Set<string>>();
const servidoresDoUsuario = new Map<string, Set<string>>();
/** Em qual balde cada usuário está HOJE — a comparação que evita o re-sort. */
const baldePorUsuario = new Map<string, Balde>();

function conjunto(mapa: Map<string, Set<string>>, chave: string): Set<string> {
  let set = mapa.get(chave);
  if (!set) {
    set = new Set();
    mapa.set(chave, set);
  }
  return set;
}

/**
 * Semeia a presença inicial de um usuário.
 *
 * Existe porque presença chega por EVENTO (`userUpdate`), e na carga inicial
 * não houve evento nenhum — sem isto, um servidor recém-carregado mostra os
 * 40 membros offline até a primeira piscada de cada um.
 *
 * Recebe o tipo de DOMÍNIO, não o do protocolo: quem chama é o arnês, que não
 * pode conhecer `stoat.js`. Quando existir login, quem chama isto é o
 * `ready` do SDK, e a assinatura não muda.
 */
export function semearPresenca(userId: string, status: PresenceStatus): void {
  presence.set(userId, status);
  baldePorUsuario.set(userId, baldeDe(status));
}

export function registrarMembro(serverId: string, userId: string): void {
  const membros = conjunto(membrosPorServidor, serverId);
  if (membros.has(userId)) return;
  membros.add(userId);
  conjunto(servidoresDoUsuario, userId).add(serverId);
  baldePorUsuario.set(userId, baldeDe(presence.getSnapshot(userId) ?? "offline"));
  membrosSujos.add(serverId);
}

export function removerMembro(serverId: string, userId: string): void {
  const membros = membrosPorServidor.get(serverId);
  if (!membros?.delete(userId)) return;
  servidoresDoUsuario.get(userId)?.delete(serverId);
  baldePorUsuario.delete(userId);
  membrosSujos.add(serverId);
}

/**
 * Presença mudou — a lista só reordena se o BALDE mudou.
 *
 * É a decisão que faz a member list sobreviver ao firehose. Presença é 55% da
 * mistura, e a esmagadora maioria é `online ↔ idle ↔ dnd`, que não troca de
 * balde. Sem esta comparação a lista republicaria a cada frame, pagando
 * `n log n` num painel onde nada mudou de lugar — e as linhas visíveis
 * re-renderizariam junto.
 *
 * O pontinho continua correto: ele assina `usePresence` sozinho, um nível
 * abaixo da linha, exatamente como no `MessageRow`.
 */
function atualizarBalde(userId: string, status: PresenceStatus): void {
  const servidores = servidoresDoUsuario.get(userId);
  if (!servidores || servidores.size === 0) return;

  const novo = baldeDe(status);
  if (baldePorUsuario.get(userId) === novo) return;

  baldePorUsuario.set(userId, novo);
  for (const serverId of servidores) membrosSujos.add(serverId);
  agendarFlush();
}

// Um colator por sessão, não um por comparação — mesma razão do DateTimeFormat.
const COLATOR = new Intl.Collator("pt-BR", { sensitivity: "base" });

function nomeDe(userId: string): string {
  return client.users.get(userId)?.username ?? userId;
}

function publicarMembros(serverId: string): void {
  const membros = membrosPorServidor.get(serverId);
  if (!membros) {
    membrosOnline.set(serverId, []);
    membrosOffline.set(serverId, []);
    return;
  }

  const online: string[] = [];
  const offline: string[] = [];
  for (const id of membros) {
    (baldePorUsuario.get(id) === "offline" ? offline : online).push(id);
  }

  const comparar = (a: string, b: string) =>
    COLATOR.compare(nomeDe(a), nomeDe(b));
  membrosOnline.set(serverId, online.sort(comparar));
  membrosOffline.set(serverId, offline.sort(comparar));
}

/* ---------------------------------------------------------------- registro */

/**
 * Registra servidor, canais e membros SEM passar pelo caminho de evento.
 *
 * É a mesma separação do `seedChannel`, pela mesma razão: carga em massa e
 * chegada incremental são caminhos diferentes, e misturá-los dá duas fontes
 * competindo pela mesma lista. Publica na hora — não há frame para esperar
 * durante o setup.
 */
export function registrarServidor(
  serverId: string,
  membros: readonly string[],
): void {
  const servidor = client.servers.get(serverId);
  if (!servidor) return;

  const lista = serverIds.peek(RAIZ) ?? [];
  if (!lista.includes(serverId)) serverIds.set(RAIZ, [...lista, serverId]);

  canaisPorServidor.set(serverId, [...servidor.channelIds]);
  publicarCanais(serverId);

  for (const userId of membros) registrarMembro(serverId, userId);
  membrosSujos.delete(serverId);
  publicarMembros(serverId);
}

/** Canal de texto preferido ao entrar num servidor — voz não abre sozinha. */
export function primeiroCanalDe(serverId: string): string | undefined {
  return canaisDeTexto.peek(serverId)?.[0] ?? canaisDeVoz.peek(serverId)?.[0];
}
