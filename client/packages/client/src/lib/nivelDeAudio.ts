/**
 * Nível de áudio em dB — a matemática que o medidor da tela de Voz e vídeo e a
 * porta de voz do motor PRECISAM compartilhar.
 *
 * ⚠ **Um lugar só, e a razão é o limiar manual.** A pessoa arrasta a marca
 * amarela sobre o medidor e lê "barras à esquerda dela não transmitem". Isso
 * só é verdade se a barra que o medidor acende e o dB que a porta compara
 * saírem da MESMA conta — com duas cópias, a primeira que mudasse a escala
 * faria a marca mentir sobre o que abre o microfone, sem erro nenhum.
 *
 * Puro: sem `AudioContext`, sem DOM. Quem mede é quem chama.
 */

/** O piso útil de um microfone de mesa. Abaixo disto é chiado da placa. */
export const DB_MIN = -60;
export const DB_MAX = 0;

/** Quantas barras o medidor tem — as 28 do design. */
export const BARRAS_DO_MEDIDOR = 28;

/** RMS de amostras em [-1, 1] → dBFS, preso ao piso. */
export function dbDoRms(rms: number): number {
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  return Math.min(DB_MAX, Math.max(DB_MIN, db));
}

/** RMS de um bloco de amostras no domínio do tempo. */
export function rmsDe(amostras: Float32Array): number {
  let soma = 0;
  for (const v of amostras) soma += v * v;
  return amostras.length === 0 ? 0 : Math.sqrt(soma / amostras.length);
}

/** 0 no piso, 1 no teto — a posição no medidor. */
export function fracaoDoDb(db: number): number {
  return Math.min(1, Math.max(0, (db - DB_MIN) / (DB_MAX - DB_MIN)));
}

/** O inverso: onde a pessoa soltou a marca, em dB inteiro. */
export function dbDaFracao(f: number): number {
  const preso = Math.min(1, Math.max(0, f));
  return Math.round(DB_MIN + preso * (DB_MAX - DB_MIN));
}

/** Quantas barras acender para um nível. `undefined` = nada medindo. */
export function barrasAcesas(
  db: number | undefined,
  total = BARRAS_DO_MEDIDOR,
): number {
  if (db === undefined) return 0;
  return Math.round(fracaoDoDb(db) * total);
}

/**
 * A faixa de cor da barra `i` (0-based), pelas regras literais do design:
 * `i > 24` vermelho, `i > 19` amarelo, o resto verde.
 *
 * ⚠ **Proporcional e não índice fixo**: o 19 e o 24 são de 28 barras, e um
 * medidor com outro total manteria as mesmas faixas de dB — que é o que as
 * cores dizem ("alto", "estourando"), não uma posição.
 */
export type FaixaDaBarra = "ok" | "alto" | "pico";

export function faixaDaBarra(
  i: number,
  total = BARRAS_DO_MEDIDOR,
): FaixaDaBarra {
  const pos = (i / total) * BARRAS_DO_MEDIDOR;
  if (pos > 24) return "pico";
  if (pos > 19) return "alto";
  return "ok";
}

/** "−42 dB", com o sinal de menos tipográfico que o design usa. */
export function textoDoDb(db: number): string {
  const r = Math.round(db);
  return r < 0 ? `−${String(-r)} dB` : `${String(r)} dB`;
}

/**
 * A porta de voz do limiar manual.
 *
 * Abre no instante em que o nível passa do limiar; fecha só depois de
 * `segurarMs` abaixo dele. ⚠ **Sem esse tempo de espera a porta cortaria o fim
 * de toda palavra** — as consoantes finais e o intervalo entre sílabas caem
 * abaixo de qualquer limiar útil, e a voz chegaria picotada do outro lado.
 */
export const SEGURAR_PORTA_MS = 300;

export type EstadoDaPorta = {
  readonly aberta: boolean;
  /** Última vez que o nível esteve acima do limiar. */
  readonly acimaEm: number;
};

export const PORTA_FECHADA: EstadoDaPorta = { aberta: false, acimaEm: -Infinity };

export function decidirPorta(
  anterior: EstadoDaPorta,
  db: number,
  limiarDb: number,
  agora: number,
  segurarMs = SEGURAR_PORTA_MS,
): EstadoDaPorta {
  if (db >= limiarDb) return { aberta: true, acimaEm: agora };
  const aberta = agora - anterior.acimaEm < segurarMs;
  return aberta === anterior.aberta ? anterior : { ...anterior, aberta };
}
