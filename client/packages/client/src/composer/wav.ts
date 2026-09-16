/**
 * As partes PURAS da mensagem de voz — sem microfone, sem `AudioContext`.
 *
 * Separadas de `gravacaoDeVoz.ts` pela razão de sempre: o que decide se a
 * gravação chega ao servidor como ÁUDIO é aritmética sobre bytes, e aritmética
 * tem teste. O resto é API de navegador que jsdom não tem.
 */

/**
 * O teto de uma mensagem de voz, em segundos — "Máx. 5 min", do design.
 *
 * Também é o que mantém o WAV abaixo do teto de `attachments` do `autumn`
 * (20 MB): 300 s × 24 kHz × 2 bytes = 14,4 MB. Ver `TAXA_DO_ENVIO`.
 */
export const DURACAO_MAXIMA_S = 300;

/**
 * A taxa do arquivo enviado.
 *
 * ⚠ **24 kHz mono, e não os 48 kHz do microfone.** Voz não tem energia útil
 * acima de 12 kHz (o limite de Nyquist de 24 kHz), e a 48 kHz cinco minutos
 * dariam 28,8 MB — acima do teto de 20 MB do `autumn`, ou seja, a mensagem
 * mais longa que o próprio gravador permite seria recusada.
 */
export const TAXA_DO_ENVIO = 24_000;

/** Quantas barras a onda do gravador desenha — fixas, como no player. */
export const BARRAS_DA_GRAVACAO = 32;

/**
 * Codifica amostras em WAV PCM de 16 bits, mono.
 *
 * ⚠ **Por que WAV, e não o `webm` que o `MediaRecorder` entrega.** Quem decide
 * se o anexo vira PLAYER na linha é o `autumn`, pelo tipo que ele DETECTA nos
 * bytes (`crates/services/autumn/src/mime_type.rs`, com a crate `infer`) — e
 * não pelo que o navegador declara. Um `webm` só de áudio é detectado como
 * `video/webm`; o `autumn` tenta tirar largura e altura com `ffprobe`, não
 * acha stream de vídeo, e cai em `Metadata::File`. A mensagem de voz chegaria
 * como um cartão de arquivo para baixar. `RIFF…WAVE` é detectado como
 * `audio/x-wav`, que começa com `audio/`, e só isso vira `Metadata::Audio`.
 *
 * Mudar isso no servidor seria fork do `autumn`, que este fork NÃO publica —
 * ele segue pinado na imagem upstream.
 */
export function codificarWav(amostras: Float32Array, taxa: number): ArrayBuffer {
  const bytesPorAmostra = 2;
  const dados = amostras.length * bytesPorAmostra;
  const buffer = new ArrayBuffer(44 + dados);
  const v = new DataView(buffer);

  const texto = (pos: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(pos + i, s.charCodeAt(i));
  };

  texto(0, "RIFF");
  v.setUint32(4, 36 + dados, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  v.setUint32(16, 16, true); // tamanho do bloco fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * bytesPorAmostra, true); // bytes por segundo
  v.setUint16(32, bytesPorAmostra, true); // alinhamento do bloco
  v.setUint16(34, 16, true); // bits por amostra
  texto(36, "data");
  v.setUint32(40, dados, true);

  for (let i = 0; i < amostras.length; i++) {
    /*
      Satura em ±1 antes de escalar. Um pico acima de 1 — comum com ganho
      automático do microfone — sem o clamp daria a volta no inteiro de 16
      bits e viraria um estalo no pico da fala.
    */
    const a = Math.max(-1, Math.min(1, amostras[i] ?? 0));
    v.setInt16(44 + i * bytesPorAmostra, a < 0 ? a * 0x8000 : a * 0x7fff, true);
  }
  return buffer;
}

/**
 * O nível de um trecho, de 0 a 1, para a altura de uma barra.
 *
 * RMS e não pico: o pico acende a barra inteira num estalo de consoante e
 * deixa a vogal baixa, e o que se quer ver é "tem voz aqui". A raiz no fim
 * abre a faixa baixa — fala normal fica em RMS 0,02–0,15, e linear a onda
 * seria uma linha de barras mínimas.
 */
export function nivelDoTrecho(amostras: Float32Array): number {
  if (amostras.length === 0) return 0;
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) {
    const a = amostras[i] ?? 0;
    soma += a * a;
  }
  const rms = Math.sqrt(soma / amostras.length);
  return Math.min(1, Math.sqrt(rms * 4));
}

/**
 * Acrescenta um nível à onda, mantendo as `n` mais recentes.
 *
 * Devolve array NOVO: é ele que vai no snapshot, e mutar no lugar faria o
 * `useSyncExternalStore` ver a mesma referência e não redesenhar.
 */
export function empurrarNivel(
  niveis: readonly number[],
  nivel: number,
  n: number = BARRAS_DA_GRAVACAO,
): readonly number[] {
  const proximo = [...niveis, nivel];
  return proximo.length > n ? proximo.slice(proximo.length - n) : proximo;
}

/**
 * O formato que o `MediaRecorder` deste navegador grava, na ordem de preferência.
 *
 * Opus em qualquer contêiner — ele é decodificado localmente e reescrito como
 * WAV, então o contêiner não importa para o servidor. `""` deixa o navegador
 * escolher, que é melhor que recusar gravar num navegador que não anuncia
 * nenhum dos três.
 */
export function formatoDeGravacao(suporta: (tipo: string) => boolean): string {
  const preferidos = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return preferidos.find((t) => suporta(t)) ?? "";
}

/** "mensagem-de-voz-2026-09-13-1402.wav" — nome estável e ordenável. */
export function nomeDaGravacao(quando: Date): string {
  const d = (n: number) => String(n).padStart(2, "0");
  return (
    `mensagem-de-voz-${quando.getFullYear()}-${d(quando.getMonth() + 1)}-` +
    `${d(quando.getDate())}-${d(quando.getHours())}${d(quando.getMinutes())}.wav`
  );
}
