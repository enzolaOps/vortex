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
  channelMessageIds,
  definirUsuarioLocal,
  estadoDaFila,
  diagnostico,
  prependHistory,
  registrarServidor,
  seedChannel,
  semearVoz,
  semearPresenca,
  startAdapter,
} from "../sdk/adapter";
import type { PresenceStatus } from "../sdk/domain";
import { client } from "../sdk/client";

const nextId = monotonicFactory();

export const CHANNEL_ID = "01JQ0000000000000000000000";
export const SERVER_ID = "01JQ0000000000000000000001";
const USER_COUNT = 40;

const userIds: string[] = [];

/**
 * O mundo do arnês: três servidores, com canais e membros.
 *
 * Um servidor só provava metade das colunas laterais. Rail com um item não
 * exercita estado ativo nem não-lidas; e não-lidas SÓ existem em canal que
 * não está aberto — com um canal, o contador nunca sairia de zero e a
 * contabilidade passaria despercebida quebrada.
 *
 * Os IDs são fixos e legíveis de propósito: aparecem no DOM durante depuração,
 * e ULID aleatório num arnês é ruído sem benefício.
 */
type Servidor = {
  id: string;
  nome: string;
  canais: {
    id: string;
    nome: string;
    voz?: boolean;
    dentro?: number;
    topico?: string;
  }[];
  categorias?: { id: string; title: string; channels: string[] }[];
  /** Quantos dos `userIds` pertencem a ele. */
  membros: number;
};

const MUNDO: Servidor[] = [
  {
    id: SERVER_ID,
    nome: "Vortex",
    canais: [
      {
        id: CHANNEL_ID,
        nome: "spike",
        topico: "Onde o firehose despeja 10 mil mensagens e a âncora tem que aguentar.",
      },
      { id: "01JQ0000000000000000000010", nome: "geral" },
      { id: "01JQ0000000000000000000011", nome: "links" },
      { id: "01JQ0000000000000000000012", nome: "voz-geral", voz: true, dentro: 2 },
      { id: "01JQ0000000000000000000013", nome: "voz-jogos", voz: true, dentro: 3 },
      // Sala VAZIA, e ela é o caso mais fácil de quebrar sem perceber: se o
      // componente renderizasse um cabeçalho "ninguém aqui" por canal, cada
      // servidor pagaria altura permanente para dizer que não há nada.
      { id: "01JQ0000000000000000000014", nome: "voz-silencio", voz: true, dentro: 0 },
    ],
    categorias: [
      {
        id: "01JQC000000000000000CONVERSA",
        title: "conversa",
        channels: ["01JQ0000000000000000000010", "01JQ0000000000000000000011"],
      },
      {
        id: "01JQC0000000000000000000VOZ",
        title: "voz",
        channels: [
          "01JQ0000000000000000000012",
          "01JQ0000000000000000000013",
          "01JQ0000000000000000000014",
        ],
      },
    ],
    membros: USER_COUNT,
  },
  {
    id: "01JQ0000000000000000000002",
    nome: "Ponte de Estado",
    canais: [
      { id: "01JQ0000000000000000000020", nome: "adapter" },
      { id: "01JQ0000000000000000000021", nome: "medições" },
    ],
    membros: 12,
  },
  {
    id: "01JQ0000000000000000000003",
    nome: "Rascunhos",
    canais: [{ id: "01JQ0000000000000000000030", nome: "ideias" }],
    membros: 5,
  },
];

/**
 * Presença inicial variada.
 *
 * Todo mundo online mediria só metade da member list: os dois baldes, a
 * ordenação dentro de cada um e as quatro silhuetas do ponto ficariam sem
 * exercício. A distribuição é fixa por índice — arnês que sorteia produz
 * captura de tela diferente a cada execução.
 */
const PRESENCAS: PresenceStatus[] = ["online", "online", "idle", "dnd", "offline"];

/**
 * Cargos do arnês.
 *
 * IDs no mesmo formato ULID do resto — 26 caracteres. Não é preciosismo: um ID
 * curto aqui já produziu confusão antes, quando o ID de usuário colidiu com o
 * de canal e só apareceu na detecção de menção.
 */
const CARGOS = {
  fundacao: "01JQR0000000000000FUNDACAO",
  moderacao: "01JQR0000000000000MODERACAO",
  veterano: "01JQR0000000000000VETERANO0",
} as const;

/**
 * Quem tem qual cargo.
 *
 * A distribuição importa mais que os números: a maioria SEM cargo, para que a
 * seção "sem cargo" exista e se possa conferir que ela cai por último; e
 * `veterano` cobrindo gente que também é moderação, porque o desempate entre
 * dois cargos da mesma pessoa é justamente o que a lógica de "mais sênior"
 * decide.
 */
function cargosDe(i: number): string[] {
  const out: string[] = [];
  if (i === 0) out.push(CARGOS.fundacao);
  else if (i % 7 === 3) out.push(CARGOS.moderacao);
  if (i % 5 === 2) out.push(CARGOS.veterano);
  return out;
}

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

/**
 * Nomes de gente, não `user0..user39`.
 *
 * A member list ordena por nome e mostra iniciais no avatar — com `user0` a
 * ordenação é trivialmente correta por acidente (prefixo comum, sufixo
 * numérico) e as siglas são todas "U". Nomes reais exercitam o colator, a
 * acentuação e a sigla de duas letras.
 */
const NOMES =
  "Ana Bruno Camila Diego Elisa Fábio Gabriela Henrique Íris João Kátia Lucas Mariana Nuno Olívia Pedro Quirino Renata Sofia Tiago Úrsula Vitor Wanda Xavier Yara Zeca Alice Bento Clara Davi Emília Felipe Giulia Hugo Isabel Joana Kauê Laura Miguel Nina".split(
    " ",
  );

let mundoPronto = false;

function ensureWorld() {
  // Idempotente: `seed()` pode ser chamado de novo pelo arnês, e recriar o
  // mundo duplicaria membros em cada servidor.
  if (mundoPronto) return;
  mundoPronto = true;

  for (let i = 0; i < USER_COUNT; i++) {
    /**
     * Prefixo próprio para usuário.
     *
     * O prefixo anterior produzia, para `i === 0`, exatamente a string do
     * `CHANNEL_ID` — 26 caracteres idênticos. Passava despercebido porque
     * usuário e canal vivem em coleções separadas do SDK, mas deixou de ser
     * inofensivo com a detecção de menção: `<@id>` no conteúdo passa a
     * carregar um ID que também nomeia um canal, e qualquer depuração por
     * busca de string no DOM mistura os dois.
     */
    const id = `01JQ0000000000000001${String(i).padStart(6, "0")}`;
    userIds.push(id);
    // O primeiro é "eu". Placeholder honesto enquanto não há sessão: o
    // composer precisa de autor, e mensagem sem autor renderiza sem cabeçalho
    // em vez de dar erro — bug caro de enxergar.
    if (i === 0) definirUsuarioLocal(id);
    client.users.getOrCreate(id, {
      _id: id,
      username: NOMES[i % NOMES.length]!,
      discriminator: "0001",
      // Pronomes e status em parte das pessoas: o cartão de perfil precisa
      // mostrar tanto o caso com quanto o sem — campo opcional que aparece
      // sempre não prova que a ausência foi tratada.
      ...(i % 4 === 1 ? { pronouns: "ela/dela" } : {}),
      ...(i % 4 === 2 ? { pronouns: "ele/dele" } : {}),
      ...(i % 6 === 3
        ? { status: { text: "focada, volto mais tarde", presence: "Busy" } }
        : {}),
      online: true,
      relationship: "None",
    } as never);
    // O "eu" está sempre online — a própria presença nunca é ausente.
    semearPresenca(id, i === 0 ? "online" : PRESENCAS[i % PRESENCAS.length]!);
  }

  for (const servidor of MUNDO) {
    for (const canal of servidor.canais) {
      // Canal de voz é TextChannel COM objeto `voice` — o protocolo não tem
      // um `channel_type` de voz. Ver `ehCanalDeVoz` em `map.ts`.
      client.channels.getOrCreate(canal.id, {
        _id: canal.id,
        channel_type: "TextChannel",
        server: servidor.id,
        name: canal.nome,
        // Tópico só em alguns: um arnês onde todo canal tem descrição nunca
        // exercitaria o cabeçalho sem tópico, que é o caso comum.
        ...(canal.topico ? { description: canal.topico } : {}),
        ...(canal.voz ? { voice: {} } : {}),
      } as never);
    }

    client.servers.getOrCreate(servidor.id, {
      _id: servidor.id,
      owner: userIds[0],
      name: servidor.nome,
      channels: servidor.canais.map((c) => c.id),
      default_permissions: 0,
      /*
        Categorias — e uma delas deixa canal DE FORA de propósito.

        O protocolo força uma categoria "default" para o que sobrou fora de
        grupo, e ela renderiza sem cabeçalho. Um arnês onde todo canal está
        categorizado nunca exercitaria esse caminho, que é justamente o mais
        comum num servidor real recém-criado.
      */
      ...(servidor.categorias ? { categories: servidor.categorias } : {}),
      /*
        Cargos, e um deles NÃO é hasteado de propósito.

        `hoist: false` significa "colore o nome mas não abre seção" — é a
        distinção que o protocolo faz e que um arnês só com cargos hasteados
        nunca exercitaria. Sem ela, um bug que tratasse todo cargo como seção
        passaria despercebido aqui e apareceria num servidor real.

        `rank` menor = mais sênior, conforme o SDK documenta.
      */
      roles: {
        [CARGOS.fundacao]: {
          name: "fundação",
          colour: "#bcaef2",
          hoist: true,
          rank: 0,
          permissions: { a: 0, d: 0 },
        },
        [CARGOS.moderacao]: {
          name: "moderação",
          colour: "#9bdcb4",
          hoist: true,
          rank: 1,
          permissions: { a: 0, d: 0 },
        },
        [CARGOS.veterano]: {
          name: "veterano",
          colour: "#f0cd8d",
          hoist: false,
          rank: 2,
          permissions: { a: 0, d: 0 },
        },
      },
    } as never);

    /*
      Os `ServerMember`, que é onde moram apelido, cargo e castigo.

      Sem isto a member list mostraria username para todo mundo e nenhum dos
      três campos apareceria — e o pior: pareceria funcionando. O arnês precisa
      exercitar a chave composta, senão ela é só tipo bonito.

      A coleção do SDK indexa por `server + user` CONCATENADO, sem separador.
      A nossa `ChaveDeMembro` usa `:` de propósito — é chave do domínio, não do
      protocolo, e misturar as duas é como o resto do app perderia a fronteira.
    */
    const membros = userIds.slice(0, servidor.membros);
    membros.forEach((userId, i) => {
      client.serverMembers.getOrCreate(
        { server: servidor.id, user: userId },
        {
          _id: { server: servidor.id, user: userId },
          joined_at: new Date(0).toISOString(),
          // Um em cada três tem apelido: o suficiente para ver a mistura de
          // apelido e username na mesma coluna, que é o caso real.
          ...(i % 3 === 0 ? { nickname: `${NOMES[i % NOMES.length]!}-vx` } : {}),
          // Um em cada onze em castigo, sempre no futuro — no passado o estado
          // é indistinguível de "sem castigo" e não exercitaria nada.
          ...(i % 11 === 5
            ? { timeout: new Date(Date.now() + 36e5).toISOString() }
            : {}),
          // Poucos com cargo, e a maioria sem — a proporção de um servidor
          // real. Uma lista onde todo mundo tem cargo não mostra se a seção
          // "sem cargo" cai no lugar certo, que é o último.
          roles: cargosDe(i),
        },
      );
    });

    /*
      Gente DENTRO dos canais de voz, desde a semeadura.

      É o ponto inteiro da sala: `Ready.voice_states` entrega os ocupantes no
      login, antes de entrar em canal nenhum. Semear só quando alguém "entra"
      exercitaria o caminho de evento e deixaria de fora justamente o que
      diferencia sala de chamada.

      Um dos ocupantes com a tela ligada, para o estado não-padrão existir.
    */
    servidor.canais
      .filter((c) => c.voz)
      .forEach((canal, n) => {
        // Fatias disjuntas: ninguém em duas salas ao mesmo tempo, que é o que
        // o protocolo garante e o que a coluna assume.
        const dentro = membros.slice(n * 4, n * 4 + (canal.dentro ?? 0));
        semearVoz(
          canal.id,
          dentro.map((userId, k) => ({
            userId,
            // Fixo, não `Date.now()`: a ordem da sala é por chegada, e um
            // arnês com relógio real produz captura diferente a cada corrida.
            desde: 1700000000000 + k * 60000,
            tela: n === 0 && k === 0,
            camera: n === 1 && k === 1,
          })),
        );
      });

    // Registro, não evento: é setup em massa, e o caminho de evento existe
    // para chegada incremental. A mesma separação do `seedChannel`.
    registrarServidor(servidor.id, membros);
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

/**
 * De vez em quando, uma linha do SISTEMA em vez de fala.
 *
 * Uma a cada 97 — raro como no uso real, e o número é primo de propósito: com
 * um divisor da corrida de autores (1 a 5) ou do passo de tempo, os eventos
 * cairiam sempre na mesma posição relativa do grupo e o caso "alguém entra e
 * fala em seguida" nunca apareceria. É exatamente o caso que a regra de
 * agrupamento existe para cobrir.
 *
 * Os quatro tipos cobrem as duas formas do domínio: as estruturadas com um
 * usuário, a estruturada com dois, e a de canal renomeado.
 */
function sistemaDe(seed: number, autor: string): object | undefined {
  if (seed % 97 !== 0 || seed === 0) return undefined;

  const outro = autorDe(seed + 7);
  switch ((seed / 97) % 4) {
    case 0:
      return { type: "user_joined", id: autor, by: outro };
    case 1:
      return { type: "user_left", id: autor, by: outro };
    case 2:
      return { type: "user_added", id: autor, by: outro };
    default:
      return { type: "channel_renamed", name: "spike", by: autor };
  }
}

function createMessage(seed: number, quando?: number): string {
  const id = quando === undefined ? nextId() : nextId(quando);
  const author = autorDe(seed);
  const system = sistemaDe(seed, author);

  client.messages.getOrCreate(
    id,
    {
      _id: id,
      channel: CHANNEL_ID,
      author,
      // O protocolo põe o texto da linha de sistema em `system`, NÃO em
      // `content` — e é por isso que a linha renderizava vazia antes: o
      // componente lia `content` e encontrava string vazia.
      content: system ? "" : body(seed),
      ...(system ? { system } : {}),
      // `as never` como o resto das semeaduras deste arquivo: o payload de
      // hidratação é do PROTOCOLO, e o arnês não pode importar `stoat.js`
      // para nomear o tipo — a fronteira proíbe, com razão.
    } as never,
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

/**
 * Manda uma mensagem para um canal que NÃO está aberto.
 *
 * Existe porque não-lida é, por definição, o que acontece longe dos olhos: o
 * firehose fala sempre no canal aberto, e ali `contabilizarNaoLida` sai na
 * primeira linha. Sem este caminho, a contabilidade inteira — contador do
 * canal, rollup do servidor, menção, zerar ao abrir — poderia estar quebrada
 * e o arnês passaria verde.
 *
 * Uma a cada três menciona o usuário local, para o badge de menção sair do
 * zero sem que toda mensagem vire menção.
 */
let falas = 0;

export function falarEmOutroCanal(): string | undefined {
  const outros = MUNDO.flatMap((s) =>
    s.canais.filter((c) => !c.voz && c.id !== CHANNEL_ID).map((c) => c.id),
  );
  const alvo = outros[falas % outros.length];
  if (!alvo) return undefined;

  falas++;
  const id = nextId();
  const mencao = falas % 3 === 0 ? `<@${userIds[0]!}> ` : "";
  client.messages.getOrCreate(
    id,
    {
      _id: id,
      channel: alvo,
      author: autorDe(falas),
      content: `${mencao}${body(falas)}`,
    },
    true,
  );
  return alvo;
}

/** Quantas mensagens o índice do canal tem? `null` = nunca publicado. */
function tamanhoDaLista(id: string): number | null {
  return channelMessageIds.getSnapshot(id)?.length ?? null;
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
    count("eventos", perTick);
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
  /**
   * Sonda de coleção: o canal tem índice? quantas mensagens?
   *
   * Existe porque a pergunta "a lista está vazia porque a mensagem não entrou
   * no índice, ou porque o componente não leu?" não tem resposta pelo DOM — os
   * dois casos renderizam a mesma coisa: nada.
   */
  (globalThis as never as Record<string, unknown>).__fila = estadoDaFila;
  (globalThis as never as Record<string, unknown>).__lista = tamanhoDaLista;
}
