/**
 * Firehose sintético.
 *
 * Dirige o SDK DE VERDADE — `getOrCreate` roda a hidratação real, emite os
 * eventos reais e mexe nos stores Solid reais. Nada aqui é mock. Um SDK
 * mockado testaria a peça de menor risco e deixaria a de maior risco de fora.
 *
 * Não há websocket nem backend: `new Client()` não conecta.
 *
 * Regressão de escopo nunca aparece em uso normal de desenvolvimento. Só em
 * servidor grande com usuário real. Isto é o que a pega antes.
 */
import { monotonicFactory } from "ulid";

import { count, countMax } from "./stats";
import {
  definirUsuarioLocal,
  diagnostico,
  prependHistory,
  seedChannel,
  startAdapter,
} from "../sdk/adapter";
import { client } from "../sdk/client";

const nextId = monotonicFactory();

export const CHANNEL_ID = "01JQ0000000000000000000000";
const SERVER_ID = "01JQ0000000000000000000001";
const USER_COUNT = 40;

const userIds: string[] = [];

const WORDS =
  "vortex canal mensagem servidor presença digitando reação âncora scroll virtualização adapter store snapshot render frame orçamento escopo".split(
    " ",
  );

/** Comprimento variado de propósito: altura de linha uniforme mede o caso fácil. */
function body(seed: number): string {
  const words = 3 + (seed * 7) % 60;
  const out: string[] = [];
  for (let i = 0; i < words; i++) {
    out.push(WORDS[(seed + i) % WORDS.length]!);
  }
  if (seed % 23 === 0) {
    out.push(`https://exemplo.invalid/${"x".repeat(300)}`);
  }
  return out.join(" ");
}

function ensureWorld() {
  client.channels.getOrCreate(CHANNEL_ID, {
    _id: CHANNEL_ID,
    channel_type: "TextChannel",
    server: SERVER_ID,
    name: "spike",
  } as never);

  for (let i = 0; i < USER_COUNT; i++) {
    const id = `01JQ00000000000000000${String(i).padStart(5, "0")}`;
    userIds.push(id);
    // O primeiro é "eu". Placeholder honesto enquanto não há sessão: o
    // composer precisa de autor, e mensagem sem autor renderiza sem cabeçalho
    // em vez de dar erro — bug caro de enxergar.
    if (i === 0) definirUsuarioLocal(id);
    client.users.getOrCreate(id, {
      _id: id,
      username: `user${i}`,
      discriminator: "0001",
      online: true,
      relationship: "None",
    } as never);
  }
}

/**
 * Uma pessoa fala algumas vezes seguidas, depois outra assume.
 *
 * Trocar de autor a cada mensagem faria TODA linha abrir grupo, e o
 * agrupamento não seria exercitado nem visto. Corridas de 1 a 5 aproximam
 * conversa — que é a distribuição que a lista precisa aguentar.
 */
function autorDe(seed: number): string {
  const bloco = Math.floor(seed / 3) + (seed % 7 === 0 ? 1 : 0);
  return userIds[bloco % userIds.length]!;
}

function createMessage(seed: number, quando?: number): string {
  const id = quando === undefined ? nextId() : nextId(quando);
  client.messages.getOrCreate(
    id,
    {
      _id: id,
      channel: CHANNEL_ID,
      author: autorDe(seed),
      content: body(seed),
    },
    true,
  );
  return id;
}

/**
 * Semeia o canal. Custo de setup, fora da janela medida.
 *
 * Em fatias com yield entre elas: síncrono, 10k hidratações bloqueiam a main
 * thread por segundos sob throttle 4x — o suficiente para o clique seguinte
 * enfileirar com segundos de input delay e para o primeiro frame da medição
 * virar uma barra que domina o p99.
 *
 * Publica a lista UMA vez, no fim: publicar por fatia geraria renders de
 * setup que não interessam a ninguém.
 */
export async function seed(count: number, chunk = 250): Promise<string[]> {
  // O adapter só entra DEPOIS da carga.
  //
  // Assinar antes faz cada mensagem criada emitir `messageCreate`, e a lista
  // passa a crescer evento a evento durante a carga. No fim, `seedChannel`
  // republica as 10k de uma vez — e o salto de N para 10.000 destrói a
  // âncora: a lista termina no começo do histórico em vez de no fim.
  //
  // Carga em massa e chegada incremental são caminhos diferentes. Misturar os
  // dois dá duas fontes competindo pela mesma lista.
  ensureWorld();

  const ids: string[] = [];

  // Espalhado por ~5 dias, terminando agora: o passo de ~43s fica dentro da
  // janela de 7 minutos, então quem agrupa é a corrida de autor, e as
  // viradas de meia-noite produzem divisores de data de verdade.
  const inicio = Date.now() - 5 * 86_400_000;
  const passo = Math.max(1, Math.floor((5 * 86_400_000) / count));

  for (let i = 0; i < count; i++) {
    ids.push(createMessage(i, inicio + i * passo));
    if (i % chunk === chunk - 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  seedChannel(CHANNEL_ID, ids);
  ultimaLista = ids;
  // Agora sim: a partir daqui, mensagem nova chega por evento.
  startAdapter();
  return ids;
}

let ultimaLista: readonly string[] = [];

/**
 * Edita a mensagem mais recente. Existe para provar, à mão e observável, a
 * afirmação central da arquitetura: editar uma mensagem toca UMA linha.
 */
/**
 * Edita um id ESPECÍFICO e devolve o diagnóstico completo.
 * Chamado com um id lido do DOM, elimina qualquer dúvida sobre a mensagem
 * estar montada e assinada no momento da escrita.
 */
export function editarId(id: string) {
  const antes = diagnostico(id);
  const conteudo = "EDITADA " + new Date().toLocaleTimeString("pt-BR");
  client.messages.updateUnderlyingObject(id, { content: conteudo, editedAt: new Date() });
  const depois = diagnostico(id);
  return {
    id,
    conteudo,
    antes,
    depois,
    sdkAtualizou: depois.noSdk === conteudo,
    storeAcompanhou: depois.noStore === conteudo,
  };
}

export function editarUltima() {
  // Varre do fim para trás até achar um id REALMENTE assinado. Editar uma
  // mensagem desmontada não testa nada.
  let id: string | undefined;
  for (let i = ultimaLista.length - 1; i >= 0 && i > ultimaLista.length - 400; i--) {
    const candidato = ultimaLista[i];
    if (candidato && diagnostico(candidato).assinado) {
      id = candidato;
      break;
    }
  }
  if (!id) {
    const n = ultimaLista.length;
    return {
      erro: 'nenhum id assinado',
      tamanhoDaLista: n,
      amostraDoFim: [n - 1, n - 10, n - 30].map((i) => ({
        i,
        id: ultimaLista[i],
        ...(ultimaLista[i] ? diagnostico(ultimaLista[i]) : {}),
      })),
    };
  }
  const conteudo = "EDITADA " + new Date().toLocaleTimeString("pt-BR");
  client.messages.updateUnderlyingObject(id, {
    content: conteudo,
    editedAt: new Date(),
  });
  // Leitura de volta pelo getter do PRÓPRIO SDK: separa 'a escrita não
  // aplicou' de 'a escrita aplicou mas meu efeito não rastreia'.
  const d = diagnostico(id);
  return { id, conteudo, ...d, escritaAplicou: d.noSdk === conteudo, storeAcompanhou: d.noStore === conteudo };
}


/**
 * Carrega uma pagina de historico ANTIGO.
 *
 * Os ids sao gerados com timestamp anterior ao do seed, para a ordem ULID
 * bater com a posicao na lista — carregar historico com id mais novo que o
 * que ja esta na tela mentiria sobre a ordenacao.
 */
export function carregarHistorico(quantas = 50): string[] {
  const base = Date.now() - 86_400_000;
  const antigas: string[] = [];

  for (let i = quantas - 1; i >= 0; i--) {
    const id = nextId(base + i);
    client.messages.getOrCreate(id, {
      _id: id,
      channel: CHANNEL_ID,
      author: userIds[i % userIds.length]!,
      content: `historico ${quantas - i} — ` + body(i + 7),
    });
    antigas.push(id);
  }

  antigas.reverse();
  prependHistory(CHANNEL_ID, antigas);
  ultimaLista = antigas.concat(ultimaLista);
  return antigas;
}

export type FirehoseMix = {
  message: number;
  update: number;
  reaction: number;
  typing: number;
  presence: number;
};

/** Proporção de um canal movimentado: presença domina, mensagem é minoria. */
const DEFAULT_MIX: FirehoseMix = {
  presence: 55,
  typing: 20,
  reaction: 15,
  update: 6,
  message: 4,
};

export function startFirehose(
  eventsPerSecond: number,
  existing: readonly string[],
  mix: FirehoseMix = DEFAULT_MIX,
) {
  const table: (keyof FirehoseMix)[] = [];
  for (const [kind, weight] of Object.entries(mix)) {
    for (let i = 0; i < weight; i++) table.push(kind as keyof FirehoseMix);
  }

  const ids = [...existing];
  let n = 0;

  /**
   * Alvo de edição e reação: a CAUDA da lista, não o acervo inteiro.
   *
   * Sortear entre 10k mensagens faz quase todo evento cair em mensagem não
   * assinada — barato, e mentiroso. Num chat real se edita e se reage ao que
   * acabou de ser dito, que é exatamente o que está na tela e assinado. Sem
   * este viés o gate aprova o caminho fácil e a regressão de escopo passa.
   */
  const RECENTES = 120;
  const recente = (k: number) =>
    ids[Math.max(0, ids.length - 1 - (k % RECENTES))];
  // Um tick a cada 16ms disparando um lote: aproxima rajada de websocket
  // melhor que um setInterval por evento, e não afoga o event loop com timers.
  const perTick = Math.max(1, Math.round((eventsPerSecond * 16) / 1000));

  const timer = setInterval(() => {
    // Cronometrado: o gerador roda no mesmo thread que o app e sofre o
    // mesmo throttle. Sem isto, um pico do PRÓPRIO gerador é indistinguível
    // de jank do app — e o gate reprovaria o arnês, não o código.
    const inicioDoTick = performance.now();
    for (let i = 0; i < perTick; i++) {
      const kind = table[n++ % table.length]!;

      switch (kind) {
        case "message":
          ids.push(createMessage(n));
          break;

        case "update": {
          const id = recente(n * 31);
          if (id) {
            // Forma de objeto parcial — a mesma que o próprio SDK usa em
            // handleEvent. A forma de caminho de 3 argumentos não propagava,
            // e o firehose ficava sem exercitar edição nenhuma.
            client.messages.updateUnderlyingObject(id, {
              content: body(n),
              editedAt: new Date(),
            });
          }
          break;
        }

        case "reaction": {
          const id = recente(n * 17);
          const message = id ? client.messages.get(id) : undefined;
          if (message) {
            const emoji = ["👍", "🔥", "🎯", "🧊"][n % 4]!;
            const users = message.reactions.get(emoji);
            if (users) users.add(userIds[n % userIds.length]!);
            else message.reactions.set(emoji, new Set([userIds[n % userIds.length]!]) as never);
          }
          break;
        }

        case "typing": {
          const channel = client.channels.get(CHANNEL_ID);
          const user = client.users.get(userIds[n % userIds.length]!);
          if (channel && user) {
            client.emit(n % 2 ? "channelStartTyping" : "channelStopTyping", channel, user);
          }
          break;
        }

        case "presence": {
          const id = userIds[n % userIds.length]!;
          const user = client.users.get(id);
          if (user) {
            // Precisa mexer em status.presence: mudar só `online` deixava o
            // adapter mapeando sempre para "offline", e nenhuma linha
            // re-renderizava. Presença não estava sendo testada.
            const presences = ["Online", "Idle", "Busy", "Invisible"] as const;
            client.users.updateUnderlyingObject(id, {
              status: { presence: presences[n % presences.length] },
            } as never);
            client.emit("userUpdate", user, {} as never);
          }
          break;
        }
      }
    }
    const custo = performance.now() - inicioDoTick;
    count("tickMs", custo);
    countMax("maxTickMs", custo);
  }, 16);

  return () => clearInterval(timer);
}

// Sonda de console, no nível do módulo — expor de dentro de um componente é
// mutação de global durante o render, e o React Compiler reprova com razão.
if (import.meta.env.DEV) {
  (globalThis as never as Record<string, unknown>).__editarId = editarId;
  (globalThis as never as Record<string, unknown>).__diagnostico = diagnostico;
}
