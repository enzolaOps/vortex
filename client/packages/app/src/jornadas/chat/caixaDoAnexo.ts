import type { AnexoSnapshot } from "nucleo/sdk/domain";

/**
 * A caixa de um anexo, calculada do metadata ANTES do primeiro byte.
 *
 * É o que impede o layout shift: a lista é ancorada no fim, e uma imagem que
 * chega e cresce empurra a âncora. Imagem e vídeo reservam a proporção real
 * (`largura`/`altura` vêm do servidor); sem metadata, 16:9. Áudio e arquivo têm
 * altura fixa. A mesma função alimenta o CSS e a estimativa do virtualizador,
 * então a estimativa do anexo é cálculo exato, não palpite.
 */
export const LARGURA_MAXIMA_DO_ANEXO = 360;
export const ALTURA_MAXIMA_DO_ANEXO = 320;
export const ALTURA_DO_AUDIO = 56;
export const ALTURA_DO_ARQUIVO = 56;
/** Respiro entre o texto e o anexo, e entre anexos. Espelha `--vx-space-2`. */
export const RESPIRO_DO_ANEXO = 8;

export type CaixaDoAnexo = { largura: number; altura: number; proporcao: string | undefined };

export function caixaDoAnexo(a: AnexoSnapshot): CaixaDoAnexo {
  if (a.tipo === "audio") return { largura: LARGURA_MAXIMA_DO_ANEXO, altura: ALTURA_DO_AUDIO, proporcao: undefined };
  if (a.tipo === "arquivo") return { largura: LARGURA_MAXIMA_DO_ANEXO, altura: ALTURA_DO_ARQUIVO, proporcao: undefined };

  const l = a.largura !== undefined && a.largura > 0 ? a.largura : 16;
  const h = a.altura !== undefined && a.altura > 0 ? a.altura : 9;
  const escala = Math.min(LARGURA_MAXIMA_DO_ANEXO / l, ALTURA_MAXIMA_DO_ANEXO / h, 1);
  // Sem metadata (16:9 "de mentira") a caixa usa a largura máxima inteira.
  const semMedida = a.largura === undefined || a.altura === undefined;
  const largura = semMedida ? LARGURA_MAXIMA_DO_ANEXO : Math.max(1, Math.round(l * escala));
  const altura = Math.max(1, Math.round(largura * (h / l)));
  return { largura, altura, proporcao: `${l} / ${h}` };
}

/** Altura total que os anexos somam à linha, respiros incluídos. */
export function alturaDeAnexos(anexos: readonly AnexoSnapshot[]): number {
  let total = 0;
  for (const a of anexos) total += caixaDoAnexo(a).altura + RESPIRO_DO_ANEXO;
  return total;
}
