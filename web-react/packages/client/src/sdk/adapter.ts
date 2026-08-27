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
import { VoiceParticipant } from "stoat.js";
/**
 * `ReactiveSet` do SDK, construído aqui.
 *
 * Dependência DIRETA acrescentada de propósito, e a justificativa é a mesma
 * que já vale para `VoiceParticipant`: esta camada constrói coleções reativas
 * com a forma que o `stoat.js` espera, e é o único lugar do app autorizado a
 * conhecer essa forma.
 *
 * A alternativa era um `Set` comum. Ele passaria no typecheck e funcionaria
 * para a MINHA reação otimista — e falharia calado depois: uma reação de
 * outra pessoa naquele mesmo emoji não dispararia o efeito, porque `Set` não
 * é reativo. Um chip que para de contar sem erro é exatamente o tipo de bug
 * que este projeto persegue.
 *
 * Já estava no lockfile como transitiva do SDK: não há superfície nova.
 */
import { ReactiveSet } from "@solid-primitives/set";

import { count } from "../dev/stats";
import { createEntityStore } from "../store/entities";
import { createEphemeralStore } from "../store/ephemeral";
import { client, conectado } from "./client";
import {
  baldeDe,
  SEM_CARGO,
  usuarioDaChave,
  type Balde,
  type ChannelSnapshot,
  CATEGORIA_PADRAO,
  type CategoriaDeCanais,
  type ChaveDeMembro,
  type EstadoDeVoz,
  type MemberSnapshot,
  type ParticipanteDeVoz,
  type SecaoDeMembros,
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

const PADRAO: Layout = {
  iniciaGrupo: true,
  dia: undefined,
  primeiraNaoLida: false,
};

export function layoutDe(id: string): Layout {
  return layouts.get(id) ?? PADRAO;
}

/* -------------------------------------------------------- cursor de leitura */

/**
 * Onde a pessoa PAROU de ler, por canal.
 *
 * Guarda o ID da última mensagem lida — posição, não contagem. É a diferença
 * entre "tem 47 coisas novas" e "você parou AQUI", e é a segunda que faz
 * alguém conseguir voltar a um canal movimentado sem desistir.
 *
 * ⚠ Fase 6: isto EXISTE no protocolo — `ChannelUnread.lastMessageId`, e
 * `Message.ack()` escreve de volta. Hoje é local; a semeadura a partir de
 * `channelUnreads` no `Ready` já está listada como pendência, e quando ela
 * chegar o cursor passa a sobreviver entre dispositivos de graça.
 */
const cursorDeLeitura = new Map<string, string>();

/**
 * A primeira não lida de um canal — a que recebe o divisor.
 *
 * `undefined` quando não há cursor (nunca visitado) ou quando o cursor já é a
 * última: nos dois casos não existe "primeira não lida", e desenhar o divisor
 * no topo do histórico seria dizer que TUDO é novo.
 */
function primeiraNaoLidaDe(channelId: string): string | undefined {
  const cursor = cursorDeLeitura.get(channelId);
  if (!cursor) return undefined;

  const ids = idsOf(channelId);
  const indice = ids.indexOf(cursor);
  if (indice === -1) return undefined;

  return ids[indice + 1];
}

/**
 * Avança o cursor até o fim do canal.
 *
 * Chamado ao SAIR do canal, não ao entrar — e essa é a decisão que faz o
 * divisor servir para alguma coisa. Avançando na entrada, ele sumiria no
 * mesmo frame em que apareceu: a pessoa abriria o canal e veria a lista sem
 * marca nenhuma de onde tinha parado.
 *
 * Discord faz assim, e a razão é essa: "lido" é o que você JÁ viu, e você só
 * viu quando saiu.
 */
function avancarCursor(channelId: string): void {
  const ids = idsOf(channelId);
  const ultima = ids[ids.length - 1];
  if (!ultima) return;

  const anterior = cursorDeLeitura.get(channelId);
  if (anterior === ultima) return;

  cursorDeLeitura.set(channelId, ultima);

  // A linha que era a primeira não lida deixa de ser: recalcula o trecho e
  // re-emite só quem mudou.
  const antiga = anterior ? ids.indexOf(anterior) : -1;
  recalcularLayout(channelId, antiga, ids.length - 1);
}

/** Dados que o agrupamento precisa, lidos do SDK. */
function vizinho(id: string | undefined) {
  if (!id) return null;
  const m = client.messages.get(id);
  if (!m) return null;
  return {
    authorId: m.authorId,
    createdAt: m.createdAt.getTime(),
    // `!!` e não o objeto: o `Vizinho` é comparado por campo, e carregar a
    // instância do SDK aqui vazaria o protocolo para dentro do módulo de
    // agrupamento, que é puro de propósito.
    ehSistema: Boolean(m.systemMessage),
  };
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

    const base = calcularLayout(atual, vizinho(ids[i - 1]));
    // O cursor entra POR COMPOSIÇÃO: `calcularLayout` é puro sobre dois
    // vizinhos e não conhece estado de leitura, que é do cliente.
    const novo: Layout = {
      ...base,
      primeiraNaoLida: id === primeiraNaoLidaDe(channelId),
    };

    const velho = layouts.get(id);
    if (
      velho &&
      velho.iniciaGrupo === novo.iniciaGrupo &&
      velho.dia === novo.dia &&
      velho.primeiraNaoLida === novo.primeiraNaoLida
    ) {
      continue;
    }

    layouts.set(id, novo);

    // Só re-emite o que alguém está olhando. Snapshot de mensagem fora da
    // janela é recalculado quando a linha montar.
    const message = client.messages.get(id);
    if (message && messages.subscriberCount(id) > 0) {
      messages.set(id, toMessageSnapshot(message, novo, estadoDeEnvioDe(id), usuarioLocal));
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
    messages.set(id, toMessageSnapshot(message, layoutDe(id), estado, usuarioLocal));
  }
}

/**
 * Tenta enviar de novo uma mensagem que falhou.
 *
 * O design system diz que erro **explica o que aconteceu E como resolver**. A
 * linha falhada dizia "não enviada" — a primeira metade — e a segunda não
 * existia em lugar nenhum do app: a mensagem ficava lá, vermelha, para sempre.
 *
 * O conteúdo não é reenviado nem recriado: a mensagem já existe localmente com
 * o texto certo. Reenviar é voltar ao estado pendente e tentar de novo, o que
 * mantém a posição dela no histórico — recriar produziria um ID novo e a linha
 * saltaria para o fim, perdendo o lugar onde a pessoa a escreveu.
 *
 * ⚠ Fase 6: com rede, isto vira um POST novo com o MESMO nonce, e a
 * reconciliação por nonce (já documentada aqui) é o que impede a mensagem de
 * aparecer duas vezes se a primeira tentativa tiver chegado ao servidor.
 */
export function reenviar(id: string): void {
  if (estadoDeEnvioDe(id) !== "failed") return;

  marcarEnvio(id, "pending");
  setTimeout(
    () => marcarEnvio(id, simulacao.falhar ? "failed" : "sent"),
    simulacao.latenciaMs ?? 600,
  );
}

/**
 * Adiciona ou remove a MINHA reação. Otimista, e por enquanto só otimista.
 *
 * Mexe direto no `ReactiveMap` do SDK, que é o mesmo caminho que os eventos de
 * reação usariam — então quando a rede existir, a reação de outra pessoa cai
 * no mesmo lugar e a linha republica pelo mesmo efeito. Não há um segundo
 * caminho a reconciliar.
 *
 * ⚠ Fase 6: aqui entra o `POST /messages/:id/reactions/:emoji` (e o DELETE), e
 * com ele a possibilidade de o servidor recusar. O rollback é escrever de
 * volta o estado anterior — que é barato justamente porque a operação é um
 * toggle sobre um Set, e não um patch.
 */
export function alternarReacao(messageId: string, emoji: string): void {
  if (!usuarioLocal) return;

  const message = client.messages.get(messageId);
  if (!message) return;

  const quem = message.reactions.get(emoji);

  if (quem?.has(usuarioLocal)) {
    quem.delete(usuarioLocal);
    // Set vazio é removido: o `map.ts` já pula emoji sem ninguém, mas deixar a
    // chave viva faria a ORDEM dos chips guardar um fantasma — reagir de novo
    // com o mesmo emoji o traria de volta à posição antiga em vez do fim.
    if (quem.size === 0) message.reactions.delete(emoji);
  } else if (quem) {
    quem.add(usuarioLocal);
  } else {
    message.reactions.set(emoji, new ReactiveSet([usuarioLocal]));
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
    messages.set(id, toMessageSnapshot(initial, layoutDe(id), estadoDeEnvioDe(id), usuarioLocal));
  }

  return createRoot((dispose) => {
    createEffect(() => {
      const message = client.messages.get(id);
      if (message) {
        messages.set(
          id,
          toMessageSnapshot(message, layoutDe(id), estadoDeEnvioDe(id), usuarioLocal),
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
  count("publishMs", performance.now() - started);

  // Cronometrado em separado, e não somado ao de canal: são dois caminhos com
  // custos de natureza diferente — cópia de array de um lado, ordenação de
  // toda a member list do outro. Somados, o relatório do gate não atribui.
  const membrosDe = performance.now();
  for (const serverId of membrosSujos) {
    publicarMembros(serverId);
    count("membrosPublishes");
  }
  membrosSujos.clear();
  count("membrosPublishMs", performance.now() - membrosDe);
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

/**
 * Recalcula a lista de fixadas de um canal.
 *
 * Varre os IDs do canal em vez de manter um índice incremental. É O(n) por
 * chamada, e roda só quando alguém fixa ou desafixa — ação humana, raríssima
 * comparada a mensagem nova. Um índice incremental seria mais rápido e teria
 * que ser mantido correto em cinco caminhos (criar, apagar, fixar, desafixar,
 * carregar histórico); a varredura não pode divergir da verdade porque ELA é
 * a verdade lida de novo.
 */
function publicarFixadas(channelId: string): void {
  const out: string[] = [];
  for (const id of idsOf(channelId)) {
    if (client.messages.get(id)?.pinned) out.push(id);
  }
  fixadas.set(channelId, out);
}

/**
 * Fixa ou desafixa. Otimista, como a reação.
 *
 * ⚠ Fase 6: `PUT /channels/:c/messages/:m/pin` e o DELETE. O servidor pode
 * recusar por permissão — fixar costuma ser privilégio —, e aí o rollback é
 * escrever `pinned` de volta e republicar. Barato porque é booleano.
 */
export function alternarFixada(messageId: string): void {
  const message = client.messages.get(messageId);
  if (!message) return;

  // `updateUnderlyingObject` e não um campo nosso: `pinned` é do PROTOCOLO, e
  // manter a verdade lá é o que faz o evento de outra pessoa e a nossa ação
  // otimista chegarem no mesmo lugar.
  client.messages.updateUnderlyingObject(messageId, {
    pinned: !message.pinned,
  } as never);

  publicarFixadas(message.channelId);
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
  // A lista de fixadas é derivada dos IDs do canal — sem isto ela nasceria
  // vazia e só apareceria depois do primeiro fixar/desafixar.
  publicarFixadas(channelId);
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
  /**
   * A quem esta mensagem responde.
   *
   * Entra por parâmetro e não é lido do store aqui: o adapter não conhece
   * `store/resposta`, e não deve — a dependência correta aponta de dentro para
   * fora, como já acontece com o rascunho.
   */
  respondendoA?: string,
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
    {
      _id: id,
      channel: channelId,
      author: usuarioLocal,
      content: texto,
        // `replies` é do PROTOCOLO; o snapshot expõe como `respostas`. A
      // tradução acontece no `map.ts`, como tudo o mais.
      ...(respondendoA ? { replies: [respondendoA] } : {}),
    },
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
 * As seções de cargo do lado online.
 *
 * Store SEPARADO de `membrosOnline`, e não um substituto, por duas razões: um
 * painel estreito que só mostra avatares não precisa de seção nenhuma e não
 * deve acordar quando um cargo mudar de nome; e a lista achatada continua
 * sendo a forma que a member list virtualizada consome hoje.
 *
 * Quem publica os dois é a mesma função, no mesmo frame — não há como
 * divergirem.
 */
export const secoesOnline = createEntityStore<readonly SecaoDeMembros[]>();

/** As categorias de canal do servidor, na ordem que ele define. */
export const categorias = createEntityStore<readonly CategoriaDeCanais[]>();

/**
 * IDs das mensagens fixadas de um canal.
 *
 * Coleção de IDs, não de snapshots — a mesma disciplina da lista de mensagens,
 * e pela mesma razão: o painel assina a LISTA, cada item assina a própria
 * mensagem. Editar uma fixada toca uma linha do painel, não o painel.
 *
 * Derivada, não guardada em paralelo: a verdade é `message.pinned`, e manter
 * uma segunda lista sincronizada à mão daria duas fontes divergindo no
 * primeiro evento que uma delas perdesse.
 */
export const fixadas = createEntityStore<readonly string[]>();

/**
 * Quem está DENTRO de cada canal de voz.
 *
 * Assina o `ReactiveMap` do SDK por `createEffect`, e não um evento do cliente
 * — porque **não existe evento**: os handlers de `VoiceChannelJoin`,
 * `VoiceChannelLeave` e `UserVoiceStateUpdate` em `events/v1.ts` mutam
 * `channel.voiceParticipants` e trazem um `// todo: event` no lugar do
 * `client.emit`. A reatividade Solid do SDK é a única superfície de observação
 * que existe, e encapsulá-la aqui é literalmente o trabalho para o qual esta
 * camada foi instalada.
 *
 * **Um store por canal, com os participantes inteiros — não dois.** A lei nº 1
 * mandaria separar "lista de IDs" de "estado de cada um", e ela existe contra
 * *update não-escopado atingindo milhares de componentes*. Uma sala tem
 * dezenas de pessoas e a câmera é ligada por ação humana; separar aqui seria
 * otimizar preventivamente, que o briefing proíbe com todas as letras.
 *
 * ⚠ **O que NÃO pode entrar neste store:** quem está FALANDO. Esse sinal vem
 * do LiveKit dezenas de vezes por segundo e é o estado efêmero que o briefing
 * nomeia. Ele vai em store separado, com throttle na fronteira
 * (`createEphemeralStore`, o mesmo do typing). Enfiá-lo aqui repintaria a
 * coluna de canais inteira a cada sílaba.
 */
export const vozPorCanal = createEntityStore<readonly ParticipanteDeVoz[]>(
  (channelId) => {
    const ler = () => {
      const canal = client.channels.get(channelId);
      if (!canal) return;

      const out: ParticipanteDeVoz[] = [];
      for (const [userId, p] of canal.voiceParticipants) {
        // Ler os três acessores DENTRO do efeito é o que faz ligar a câmera
        // republicar a sala. Fora dele, o snapshot congelaria no estado de
        // quando a pessoa entrou.
        const estado: EstadoDeVoz = p.isScreensharing()
          ? "tela"
          : p.isCamera()
            ? "video"
            : "voz";
        out.push({ userId, estado, desde: p.joinedAt.getTime() });
      }

      // Por ordem de chegada, não alfabética. Duas razões, e as duas são de
      // estabilidade: renomear alguém não reordena a sala, e ligar a câmera
      // também não — a lista só muda quando alguém entra ou sai, que é a
      // única mudança que a pessoa olhando espera ver.
      out.sort((a, b) => a.desde - b.desde);
      vozPorCanal.set(channelId, out);
    };

    ler();

    count("vozEfeitos");
    return createRoot((dispose) => {
      createEffect(ler);
      return dispose;
    });
  },
);

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

  // SAINDO: o canal anterior passa a estar lido até o fim. É aqui que o
  // divisor de "novas mensagens" do PRÓXIMO retorno é decidido.
  if (canalAberto) avancarCursor(canalAberto);

  canalAberto = channelId;

  if (channelId) {
    marcarCanalLido(channelId);
    // Canal nunca visitado começa lido a partir de onde está: sem isto, abrir
    // um canal pela primeira vez marcaria as dez mil como novas.
    if (!cursorDeLeitura.has(channelId)) {
      const ids = idsOf(channelId);
      const ultima = ids[ids.length - 1];
      if (ultima) cursorDeLeitura.set(channelId, ultima);
    }
  }
}

/** O ponto onde a leitura parou. Para a lista saber até onde rolar. */
export function primeiraNaoLida(channelId: string): string | undefined {
  return primeiraNaoLidaDe(channelId);
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
 * Membro, keyed por SERVIDOR + USUÁRIO.
 *
 * A pendência que este bloco fecha estava escrita assim: *"apelido é por
 * servidor (`ServerMember`), e uma chave de usuário não sabe de qual servidor
 * se fala"*. Era verdade e custava três campos de uma vez — apelido, cor de
 * cargo e castigo, todos moram no `ServerMember` e nenhum no `User`.
 *
 * A chave é marcada no domínio (`ChaveDeMembro`), então passar um ID de
 * usuário aqui não compila. Sem isso, o erro seria `getSnapshot(userId)`
 * devolvendo `undefined` para sempre, calado.
 *
 * **Duas fontes numa subscrição só, e é de propósito.** `User` muda quando a
 * pessoa troca de nome; `ServerMember`, quando trocam o apelido dela ou lhe
 * dão um cargo. Um `createEffect` lendo os dois reage aos dois — e a
 * granularidade continua sendo a linha, não a lista.
 */
export const members = createEntityStore<MemberSnapshot>((chave) => {
  const userId = usuarioDaChave(chave as ChaveDeMembro);
  const serverId = chave.slice(0, chave.length - userId.length - 1);

  const ler = () => {
    const user = client.users.get(userId);
    if (!user) return;
    // `getByKey` e não `get`: a coleção do SDK indexa por objeto composto, e
    // passar a nossa chave direto acharia nada — silenciosamente.
    const membro = serverId
      ? client.serverMembers.getByKey({ server: serverId, user: userId })
      : undefined;
    members.set(chave, toMemberSnapshot(user, membro));
  };

  ler();

  count("membroEfeitos");
  return createRoot((dispose) => {
    createEffect(ler);
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

  publicarCategorias(serverId);
}

/**
 * As categorias, na ordem que o servidor define.
 *
 * `server.orderedChannels` faz o trabalho pesado — casa `categories` com os
 * canais, e força uma categoria "default" para o que sobrou fora de grupo. Era
 * a parte que parecia cara nesta pendência e já vinha pronta.
 *
 * A tradução aqui é pequena e é toda anticorrupção: IDs em vez de objetos do
 * SDK, e o título `"Default"` — string em inglês vinda do protocolo — vira
 * `undefined`, que é o que o domínio quer dizer com "sem grupo". Deixar
 * `"Default"` passar poria uma palavra do Stoat na interface do Vortex.
 */
function publicarCategorias(serverId: string): void {
  const servidor = client.servers.get(serverId);
  if (!servidor) {
    categorias.set(serverId, []);
    return;
  }

  const out: CategoriaDeCanais[] = [];
  for (const grupo of servidor.orderedChannels) {
    // Categoria vazia não vira cabeçalho órfão. O SDK já pula a `default`
    // vazia; as outras podem existir sem canal visível para quem tem
    // permissão limitada.
    if (grupo.channels.length === 0) continue;

    out.push({
      id: grupo.id,
      titulo: grupo.id === CATEGORIA_PADRAO ? undefined : grupo.title,
      canais: grupo.channels.map((c) => c.id),
    });
  }

  categorias.set(serverId, out);
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

/**
 * Semeia ocupantes de uma sala de voz — setup em massa, como `registrarServidor`.
 *
 * Existe porque o arnês NÃO pode importar `stoat.js`: a fronteira de import
 * proíbe, e o lint pegou a primeira versão disto tentando construir
 * `VoiceParticipant` lá fora. A regra estava certa por um motivo além da
 * fronteira — o arnês não tem por que conhecer a forma do protocolo, e um dia
 * em que `UserVoiceState` mudar de campo, quem conserta é este arquivo.
 */
export function semearVoz(
  channelId: string,
  dentro: readonly {
    userId: string;
    desde: number;
    tela?: boolean;
    camera?: boolean;
  }[],
): void {
  const canal = client.channels.get(channelId);
  if (!canal) return;

  for (const p of dentro) {
    canal.voiceParticipants.set(
      p.userId,
      new VoiceParticipant(client, {
        id: p.userId,
        joined_at: new Date(p.desde).toISOString(),
        is_receiving: true,
        is_publishing: true,
        screensharing: p.tela ?? false,
        camera: p.camera ?? false,
      } as never),
    );
  }
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

/**
 * O nome pelo qual a lista ORDENA — que precisa ser o mesmo que ela mostra.
 *
 * Era `username` cru, e passou a estar errado no instante em que o apelido
 * entrou: a coluna exibiria "Ana-vx" e ordenaria por "Ana", então uma pessoa
 * apelidada apareceria fora de ordem alfabética sem nada explicando por quê.
 * Bug introduzido pela feature anterior e morto aqui.
 */
function nomeDe(serverId: string, userId: string): string {
  const apelido = client.serverMembers.getByKey({
    server: serverId,
    user: userId,
  })?.nickname;
  return apelido || client.users.get(userId)?.username || userId;
}

/**
 * Os cargos HASTEADOS do servidor, achatados uma vez por publicação.
 *
 * A alternativa óbvia era `membro.hoistedRole` por membro — e ela é uma
 * armadilha: o getter chama `orderedRoles`, que faz `map` + `filter` + `sort`
 * a CADA chamada. Numa lista de 10 mil membros isso é dez mil ordenações por
 * publicação, e a member list publica sempre que alguém cruza de balde.
 *
 * Com o mapa, o custo vira O(cargos) uma vez mais O(cargos por membro) na
 * varredura, sem alocar nada por membro.
 */
type CargoHasteado = { rank: number; nome: string; cor: string | undefined };

function cargosHasteados(serverId: string): Map<string, CargoHasteado> {
  const out = new Map<string, CargoHasteado>();
  const servidor = client.servers.get(serverId);
  if (!servidor) return out;

  for (const [id, cargo] of servidor.roles) {
    if (!cargo.hoist) continue;
    out.set(id, {
      // `rank` menor = mais sênior, e o SDK documenta assim. Sem cargo, vai
      // para o fim junto com quem não tem nenhum.
      rank: cargo.rank ?? Number.MAX_SAFE_INTEGER,
      nome: cargo.name,
      cor: cargo.colour ?? undefined,
    });
  }
  return out;
}

function publicarMembros(serverId: string): void {
  const membros = membrosPorServidor.get(serverId);
  if (!membros) {
    membrosOnline.set(serverId, []);
    membrosOffline.set(serverId, []);
    secoesOnline.set(serverId, []);
    return;
  }

  const online: string[] = [];
  const offline: string[] = [];
  for (const id of membros) {
    (baldePorUsuario.get(id) === "offline" ? offline : online).push(id);
  }

  const comparar = (a: string, b: string) =>
    COLATOR.compare(nomeDe(serverId, a), nomeDe(serverId, b));
  online.sort(comparar);
  offline.sort(comparar);

  membrosOnline.set(serverId, online);
  membrosOffline.set(serverId, offline);

  /*
    As seções, só do lado online.

    Offline continua um balde único de propósito: seccionar os ausentes por
    cargo dobraria o número de cabeçalhos para mostrar quem não está lá.
  */
  const cargos = cargosHasteados(serverId);
  const porCargo = new Map<string, string[]>();

  for (const userId of online) {
    const membro = client.serverMembers.getByKey({
      server: serverId,
      user: userId,
    });

    // Entre os cargos hasteados da pessoa, o MAIS SÊNIOR — menor `rank`.
    let escolhido = SEM_CARGO;
    let melhor = Number.MAX_SAFE_INTEGER;
    for (const roleId of membro?.roles ?? []) {
      const cargo = cargos.get(roleId);
      if (cargo && cargo.rank < melhor) {
        melhor = cargo.rank;
        escolhido = roleId;
      }
    }

    const lista = porCargo.get(escolhido);
    if (lista) lista.push(userId);
    else porCargo.set(escolhido, [userId]);
  }

  // `online` já veio ordenado, então cada balde de cargo herda a ordem sem
  // ordenar de novo — a varredura acima preserva a sequência de entrada.
  const secoes: SecaoDeMembros[] = [];
  for (const [id, ids] of porCargo) {
    const cargo = cargos.get(id);
    secoes.push({
      id,
      rotulo: cargo?.nome ?? "online",
      cor: cargo?.cor,
      ids,
    });
  }

  secoes.sort((a, b) => {
    // Sem cargo sempre por último, qualquer que seja o rank dos outros.
    if (a.id === SEM_CARGO) return 1;
    if (b.id === SEM_CARGO) return -1;
    return (
      (cargos.get(a.id)?.rank ?? 0) - (cargos.get(b.id)?.rank ?? 0)
    );
  });

  secoesOnline.set(serverId, secoes);
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
