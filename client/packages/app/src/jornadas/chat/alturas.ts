import { count, readCounters } from "nucleo/arnes/stats";

/**
 * Estimativa de altura de linha, por TIPO. Medida, não chutada.
 *
 * Linha de sistema é uma frase curta; a que abre grupo carrega avatar, nome e
 * hora; a continuação é só o corpo. Estimar as três pelo mesmo número faz a
 * barra de rolagem errar na proporção de cada tipo, e erro de estimativa é o
 * que desengata o `followOnAppend` (lição do spike: a lista passa a derivar e o
 * gate mede uma lista parada).
 *
 * Os números saem do relatório do arnês (`/dev`), que reporta a altura real
 * partida por tipo. A ordem inversa (escrever a constante e conferir depois) é
 * como um `estimateSize: 44` sobreviveu três fases no `client`. Dependem da
 * LARGURA da coluna: medidos a 1600x900 (coluna de leitura de ~850px), 10k mensagens
 * do firehose: 96,1px abre grupo, 77,3px continua, 34,1px sistema.
 */
export const ALTURA_POR_TIPO = {
  sistema: 34,
  abreGrupo: 96,
  continua: 77,
} as const;

export type TipoDeLinha = keyof typeof ALTURA_POR_TIPO;

/** Piso de quem ainda não foi resolvido. Nunca zero: zero realimenta a medição. */
export const ALTURA_ESTIMADA = 80;

/** O divisor de dia vive dentro da linha que abre o dia. */
export const ALTURA_DO_DIVISOR = 32;

/** O divisor de "novas mensagens" também vive dentro da linha. */
export const ALTURA_DO_DIVISOR_DE_NOVAS = 36;

/** A prévia da resposta, irmã da linha: uma linha de 18px mais o respiro de cima. */
export const ALTURA_DA_CITACAO = 22;

/** A fileira de reações sob o corpo: chip de 24px mais o respiro. */
export const ALTURA_DAS_REACOES = 28;

/** A linha de estado de envio ("Enviando…", "Não foi enviada"). */
export const ALTURA_DO_ESTADO_DE_ENVIO = 22;

/** Quão perto do topo (px) a lista pede a página anterior do histórico. */
export const LIMIAR_DE_PAGINACAO = 600;

/** Quão longe do fim (px) aparece o atalho "Ir para as mensagens recentes". */
export const LIMIAR_DE_LONGE = 800;

/** Quão longe do fim ainda conta como "no fim". Um número para os dois lados concordarem. */
export const LIMIAR_DE_FIM = 80;

const AVISADO = new Set<TipoDeLinha>();

function conferir(tipo: TipoDeLinha, media: number) {
  if (AVISADO.has(tipo)) return;
  const esperada = ALTURA_POR_TIPO[tipo];
  const erro = Math.abs(media - esperada) / esperada;
  if (erro < 0.15) return;
  AVISADO.add(tipo);
  console.error(
    `[vortex] a estimativa de altura da linha "${tipo}" está a ${(erro * 100).toFixed(0)}% ` +
      `do real: estima ${esperada}px, mede ${media.toFixed(1)}px. A linha mudou de forma. ` +
      `Estimativa errada não quebra nada, só faz a barra de rolagem mentir sobre o histórico.`,
  );
}

/**
 * Soma a altura medida de uma linha ao relatório do arnês e, em dev, confere a
 * estimativa do tipo contra a média (com amostra suficiente para ela significar
 * algo). Linhas com divisor de dia ficam fora: a constante descreve a linha sem ele.
 */
export function amostrarAltura(tipo: TipoDeLinha, altura: number, comDivisor: boolean) {
  if (altura <= 0) return;
  count("alturaSoma", altura);
  count("alturaAmostras");
  if (comDivisor) return;
  if (tipo === "sistema") {
    count("alturaSistemaSoma", altura);
    count("alturaSistemaAmostras");
  } else if (tipo === "abreGrupo") {
    count("alturaGrupoSoma", altura);
    count("alturaGrupoAmostras");
  } else {
    count("alturaContinuaSoma", altura);
    count("alturaContinuaAmostras");
  }
  if (import.meta.env.DEV) {
    const c = readCounters();
    if (tipo === "abreGrupo" && c.alturaGrupoAmostras > 200)
      conferir(tipo, c.alturaGrupoSoma / c.alturaGrupoAmostras);
    if (tipo === "continua" && c.alturaContinuaAmostras > 200)
      conferir(tipo, c.alturaContinuaSoma / c.alturaContinuaAmostras);
    if (tipo === "sistema" && c.alturaSistemaAmostras > 200)
      conferir(tipo, c.alturaSistemaSoma / c.alturaSistemaAmostras);
  }
}
