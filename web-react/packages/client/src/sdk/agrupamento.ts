/**
 * Regras de agrupamento e divisor de data.
 *
 * Isolado do adapter porque é lógica pura sobre dois valores — o que a torna
 * testável sem SDK, sem store e sem DOM. As regras de produto vivem aqui, num
 * lugar só, em vez de espalhadas por condicionais no componente.
 */

/**
 * Janela de agrupamento.
 *
 * Sete minutos é a fronteira entre "continuou falando" e "voltou depois". Curto
 * demais quebra a fala em blocos e devolve o ruído que o agrupamento existe
 * para remover; longo demais junta assuntos distintos sob um cabeçalho só.
 */
export const JANELA_DE_GRUPO_MS = 7 * 60 * 1000;

export type Vizinho = {
  readonly authorId: string | undefined;
  readonly createdAt: number;
} | null;

const DIA_MS = 24 * 60 * 60 * 1000;

/** Meia-noite local, não UTC: o divisor de data é sobre o dia de quem lê. */
function inicioDoDia(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const FORMATO_LONGO = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Rótulo do divisor, relativo quando ajuda.
 *
 * "Hoje" e "Ontem" são o que a pessoa pensa; a data por extenso é o que ela
 * precisa quando o histórico é antigo. Datar tudo por extenso obriga a
 * calcular mentalmente o que "26 de agosto" significa.
 */
export function rotuloDeDia(ms: number, agora = Date.now()): string {
  const dia = inicioDoDia(ms);
  const hoje = inicioDoDia(agora);
  const diferenca = Math.round((hoje - dia) / DIA_MS);

  if (diferenca === 0) return "Hoje";
  if (diferenca === 1) return "Ontem";
  return FORMATO_LONGO.format(new Date(ms));
}

export type Layout = {
  readonly iniciaGrupo: boolean;
  readonly dia: string | undefined;
};

/**
 * Decide o layout de uma linha a partir da anterior.
 *
 * A primeira mensagem carregada sempre abre grupo e sempre abre dia: sem
 * vizinho acima, não há do que ela seja continuação. Isso vale inclusive
 * depois de um prepend, quando a antiga primeira deixa de ser a primeira e
 * precisa ser recalculada — é o único caso em que uma linha existente muda de
 * layout sem ter mudado de conteúdo.
 */
export function calcularLayout(
  atual: { authorId: string | undefined; createdAt: number },
  anterior: Vizinho,
  agora = Date.now(),
): Layout {
  if (!anterior) {
    return { iniciaGrupo: true, dia: rotuloDeDia(atual.createdAt, agora) };
  }

  const mudouDeDia = inicioDoDia(atual.createdAt) !== inicioDoDia(anterior.createdAt);
  const mudouDeAutor = atual.authorId !== anterior.authorId;
  const passouDaJanela =
    atual.createdAt - anterior.createdAt > JANELA_DE_GRUPO_MS;

  return {
    // Dia novo sempre abre grupo: um cabeçalho continuando por cima de um
    // divisor de data leria como se a fala tivesse atravessado a meia-noite.
    iniciaGrupo: mudouDeDia || mudouDeAutor || passouDaJanela,
    dia: mudouDeDia ? rotuloDeDia(atual.createdAt, agora) : undefined,
  };
}
