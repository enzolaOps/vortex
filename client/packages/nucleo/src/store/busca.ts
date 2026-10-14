import {
  analisarConsulta,
  intervaloDasDatas,
  menorCursor,
  tipoDoFiltro,
} from "../ui-logica/busca/filtros";
import {
  buscarNoCanal,
  buscarNoServidor,
  resolverAutor,
  POR_PAGINA,
  type OrdemDeBusca,
  type ResultadoDeBusca,
} from "../sdk/busca";

/**
 * O estado do painel de busca.
 *
 * Store module-level com `useSyncExternalStore`, lei nº 1: quem dispara uma
 * busca é o campo do painel, quem a lê é o painel E a timeline — que precisa
 * saber qual resultado está selecionado para destacá-lo. Duas árvores
 * diferentes, um estado.
 *
 * ⚠ **A seleção mora AQUI e não na lista de mensagens.** Ela é o que liga as
 * duas superfícies: o cartão selecionado no painel e a linha realçada na
 * timeline são o mesmo dado. Guardá-la na lista faria o painel ter de
 * empurrá-la para lá a cada clique, e as duas divergiriam ao trocar de canal.
 */

/**
 * Onde a busca procura.
 *
 * `servidor` é do fork (`POST /servers/{id}/search`). Ele não muda o que a
 * tela desenha — cada cartão já carrega o canal de origem —, muda de onde a
 * página vem e o que acontece ao trocar de canal (ver `apontarBuscaPara`).
 */
export type EscopoDeBusca = "canal" | "servidor";

/**
 * O que impediu a busca de rodar, e que a tela diz em palavras.
 *
 * ⚠ **Estado e não toast.** A busca roda enquanto a pessoa digita: `de:m` no
 * meio de `de:marina` é um autor ambíguo por um instante, e um toast por tecla
 * seria uma metralhadora. O painel mostra o problema no lugar dos resultados e
 * ele some sozinho quando o texto passa a valer.
 */
export type ProblemaDeBusca =
  | { readonly tipo: "filtroInvalido"; readonly bruto: string }
  | { readonly tipo: "autorDesconhecido"; readonly nome: string };

export type EstadoDeBusca = {
  /** O painel está aberto. */
  readonly aberta: boolean;
  readonly channelId: string | undefined;
  /** Servidor do canal apontado; `undefined` em DM, onde só existe `canal`. */
  readonly serverId: string | undefined;
  readonly escopo: EscopoDeBusca;
  readonly consulta: string;
  readonly ordem: OrdemDeBusca;
  readonly resultados: readonly ResultadoDeBusca[];
  /** `undefined` = nenhuma busca feita ainda; a tela mostra o convite. */
  readonly total: number | undefined;
  readonly buscando: boolean;
  /** 1-based, como o design numera. */
  readonly pagina: number;
  /** O resultado aberto na timeline, se houver. */
  readonly selecionado: string | undefined;
  /** A última página veio cheia: pode haver mais, e "carregar mais" existe. */
  readonly temMais: boolean;
  /** A chamada falhou (rede, servidor). Diferente de "nada encontrado". */
  readonly falhou: boolean;
  readonly problema: ProblemaDeBusca | undefined;
};

const VAZIO: EstadoDeBusca = {
  aberta: false,
  channelId: undefined,
  serverId: undefined,
  escopo: "canal",
  consulta: "",
  ordem: "recentes",
  resultados: [],
  total: undefined,
  buscando: false,
  pagina: 1,
  selecionado: undefined,
  temMais: false,
  falhou: false,
  problema: undefined,
};

let estado = VAZIO;

/**
 * A pilha de cursores.
 *
 * ⚠ Fora do snapshot de propósito: ela é maquinário do protocolo (o `before`
 * de cada página), não estado que a tela desenha. No snapshot, cada `push`
 * trocaria a referência e acordaria o painel inteiro por um dado que nenhum
 * componente lê.
 */
let cursores: string[] = [];

/**
 * Qual busca está valendo.
 *
 * ⚠ **O SDK não aceita cancelamento** (`Channel.search` não recebe um
 * `AbortSignal`), então "cancelar a busca anterior" é IGNORAR a resposta dela:
 * cada pedido pega um número, e só o último a pedir pode escrever no estado.
 * Sem isso, digitar "pra" e depois "prazo" deixaria a resposta lenta de "pra"
 * chegar por último e trocar a lista por resultados de uma busca que não é a
 * da tela.
 */
let geracao = 0;
let relogio: ReturnType<typeof setTimeout> | undefined;

/** Espera depois da última tecla. Menos que isso é uma chamada por letra. */
export const ESPERA_DA_DIGITACAO_MS = 300;

const ouvintes = new Set<() => void>();

export function assinarBusca(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerBusca(): EstadoDeBusca {
  return estado;
}

function publicar(mudanca: Partial<EstadoDeBusca>): void {
  estado = { ...estado, ...mudanca };
  for (const o of ouvintes) o();
}

function cancelarEspera(): void {
  if (relogio !== undefined) clearTimeout(relogio);
  relogio = undefined;
}

export function definirConsulta(consulta: string): void {
  publicar({ consulta });
}

/** Volta ao convite inicial, e invalida qualquer resposta em voo. */
export function reiniciarResultados(): void {
  cancelarEspera();
  geracao += 1;
  cursores = [];
  publicar({
    resultados: [],
    total: undefined,
    buscando: false,
    pagina: 1,
    selecionado: undefined,
    temMais: false,
    falhou: false,
    problema: undefined,
  });
}

/**
 * A pessoa digitou. Mostra o esqueleto já, e só busca depois de uma pausa.
 *
 * Texto em branco não busca: limpa. Cada tecla invalida a busca em voo
 * (`geracao`) e reinicia a espera.
 */
export function digitar(consulta: string): void {
  cancelarEspera();
  geracao += 1;
  if (consulta.trim().length === 0) {
    publicar({ consulta });
    reiniciarResultados();
    return;
  }
  publicar({ consulta, buscando: true, falhou: false, problema: undefined });
  relogio = setTimeout(() => {
    relogio = undefined;
    void executar(1);
  }, ESPERA_DA_DIGITACAO_MS);
}

/**
 * Escreve o texto e busca NA HORA — para o `✕` de uma ficha e para os controles
 * de filtro, que são um clique e não uma digitação.
 */
export function aplicarConsulta(consulta: string): void {
  cancelarEspera();
  geracao += 1;
  publicar({ consulta });
  if (consulta.trim().length === 0) {
    reiniciarResultados();
    return;
  }
  void executar(1);
}

/** Refaz a busca da tela do começo (o "tentar de novo" e a volta da conexão). */
export function refazerBusca(): void {
  if (estado.consulta.trim().length > 0) void executar(1);
}

/** Abre o painel apontado para um canal. A busca de OUTRO canal é descartada. */
export function abrirBusca(channelId: string, serverId: string | undefined): void {
  apontarBuscaPara(channelId, serverId);
  if (!estado.aberta) publicar({ aberta: true });
}

/** Fecha o painel. O texto e os resultados ficam: reabrir retoma de onde parou. */
export function fecharBusca(): void {
  if (!estado.aberta) return;
  cancelarEspera();
  geracao += 1;
  publicar({ aberta: false, buscando: false });
}

/**
 * Troca a ordem e REFAZ a busca.
 *
 * Trocar a ordem sem refazer deixaria a lista antiga com o botão novo
 * marcado — a interface afirmando uma ordenação que os resultados na tela não
 * têm.
 */
export function definirOrdem(ordem: OrdemDeBusca): void {
  publicar({ ordem });
  if (estado.consulta.trim().length > 0) void executar(1);
}

/**
 * Aponta a busca para um canal.
 *
 * ⚠ Trocar de canal LIMPA tudo, e não é zelo: os resultados carregam o nome do
 * canal de origem e o "Pular para mensagem" pede um salto naquele canal. Manter
 * a lista ao mudar de canal daria um painel que pula para outro lugar.
 */
export function apontarBuscaPara(
  channelId: string | undefined,
  serverId: string | undefined,
): void {
  if (estado.channelId === channelId && estado.serverId === serverId) return;
  /*
    ⚠ **Em escopo de SERVIDOR, trocar de canal dentro do mesmo servidor NÃO
    limpa** — e é o caso comum, não a exceção: "Pular para mensagem" num
    resultado de outro canal ABRE aquele canal, e limpar ali apagaria a lista
    no exato clique que a usou. Os resultados continuam válidos, porque cada
    um carrega o próprio canal.
  */
  if (
    estado.escopo === "servidor" &&
    serverId !== undefined &&
    estado.serverId === serverId
  ) {
    publicar({ channelId });
    return;
  }
  cancelarEspera();
  geracao += 1;
  cursores = [];
  estado = { ...VAZIO, aberta: estado.aberta, channelId, serverId };
  for (const o of ouvintes) o();
}

/**
 * Troca o escopo e REFAZ a busca, pela mesma razão de `definirOrdem`: a lista
 * antiga sob o rótulo novo afirmaria uma busca que ninguém fez.
 */
export function definirEscopo(escopo: EscopoDeBusca): void {
  if (escopo === "servidor" && estado.serverId === undefined) return;
  if (estado.escopo === escopo) return;
  cursores = [];
  geracao += 1;
  publicar({
    escopo,
    resultados: [],
    total: undefined,
    pagina: 1,
    selecionado: undefined,
    temMais: false,
    falhou: false,
    problema: undefined,
  });
  if (estado.consulta.trim().length > 0) void executar(1);
}

export function selecionarResultado(id: string | undefined): void {
  publicar({ selecionado: id });
}

/**
 * Roda a busca para uma página.
 *
 * ⚠ **A página só é alcançável em ordem**, porque o protocolo pagina por
 * CURSOR e não por número: ele sabe "antes desta mensagem", não "a terceira
 * página". A pilha guarda o cursor de cada página já visitada, e é isso que
 * deixa "carregar mais" pedir a seguinte sem refazer as anteriores.
 */
export async function executar(pagina: number, acumular = false): Promise<void> {
  const { channelId, serverId, escopo, consulta, ordem } = estado;
  if (channelId === undefined) return;
  if (escopo === "servidor" && serverId === undefined) return;

  cancelarEspera();
  geracao += 1;
  const minha = geracao;

  /*
    O TEXTO do campo é a fonte dos filtros — ver `busca/filtros.ts`. Filtro
    que não se entende PARA a busca e diz, em vez de ser ignorado: `tem:planilha`
    ignorado devolveria tudo, com cara de resultado filtrado.
  */
  const { texto, filtros } = analisarConsulta(consulta);
  if (texto.length === 0 && filtros.length === 0) {
    reiniciarResultados();
    return;
  }

  const parar = (problema: ProblemaDeBusca) => {
    cursores = [];
    publicar({
      resultados: [],
      total: undefined,
      buscando: false,
      pagina: 1,
      selecionado: undefined,
      temMais: false,
      falhou: false,
      problema,
    });
  };

  const invalido = filtros.find((f) => !f.valido);
  if (invalido) {
    parar({ tipo: "filtroInvalido", bruto: invalido.bruto });
    return;
  }

  const de = filtros.find((f) => f.chave === "de");
  const autorId = de ? resolverAutor(de.valor, channelId) : undefined;
  if (de && autorId === undefined) {
    parar({ tipo: "autorDesconhecido", nome: de.valor });
    return;
  }
  const tem = filtros.find((f) => f.chave === "tem");
  const intervalo = intervaloDasDatas(filtros);

  if (pagina === 1) cursores = [];
  const cursorDaPagina = pagina > 1 ? cursores[pagina - 2] : undefined;
  if (pagina > 1 && cursorDaPagina === undefined) return;

  publicar({ buscando: true, falhou: false, problema: undefined });
  const filtrosDaChamada = {
    consulta: texto,
    ordem,
    antesDe: menorCursor(cursorDaPagina, intervalo.antesDe),
    depoisDe: intervalo.depoisDe,
    autorId,
    tem: tem ? tipoDoFiltro(tem.valor) : undefined,
  };
  const r =
    escopo === "servidor" && serverId !== undefined
      ? await buscarNoServidor({ serverId, ...filtrosDaChamada })
      : await buscarNoCanal({ channelId, ...filtrosDaChamada });

  /*
    A resposta pode chegar depois de a pessoa digitar de novo, trocar de escopo
    ou de canal. Aplicá-la escreveria resultados de uma busca que já não é a da
    tela — e é a única forma de "cancelar" que o SDK permite.
  */
  if (minha !== geracao) return;

  if (r === undefined) {
    publicar({ buscando: false, falhou: true });
    return;
  }

  /*
    O cursor da PRÓXIMA página é o último ID desta. Guardado por índice para
    que voltar não refaça a conta — e só quando a página veio cheia: página
    curta é a última, e oferecer um "carregar mais" que devolve vazio é o botão
    que ensina a não confiar na paginação.
  */
  const ultimo = r[r.length - 1];
  const cheia = r.length === POR_PAGINA && ultimo !== undefined;
  if (cheia) cursores[pagina - 1] = ultimo.id;
  else cursores.length = Math.max(0, pagina - 1);

  let resultados = r;
  if (acumular) {
    const jaTem = new Set(estado.resultados.map((x) => x.id));
    resultados = [...estado.resultados, ...r.filter((x) => !jaTem.has(x.id))];
  }

  publicar({
    resultados,
    /*
      ⚠ **`total` é o que a tela já trouxe, e a tela diz "N ou mais" quando
      `temMais`** — o protocolo não devolve contagem total, e inventar uma
      daria um número que encolhe quando a pessoa refaz a busca. Mesma
      disciplina do "Conectado · 42 ms" que a faixa de voz recusou.
    */
    total: resultados.length,
    buscando: false,
    pagina,
    temMais: cheia,
    falhou: false,
    problema: undefined,
    selecionado: acumular ? estado.selecionado : undefined,
  });
}

/** A página seguinte, ACRESCENTADA à lista (sem scroll infinito: é um botão). */
export function carregarMais(): void {
  if (!estado.temMais || estado.buscando) return;
  void executar(estado.pagina + 1, true);
}

/** Quantas páginas a pilha já conhece. */
export function paginasConhecidas(): number {
  return cursores.length + 1;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparBusca(): void {
  cancelarEspera();
  geracao += 1;
  cursores = [];
  estado = VAZIO;
}
