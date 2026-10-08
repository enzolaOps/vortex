/**
 * A qualidade de stream pedida pela pessoa ou pelo papel do ladrilho, e a
 * CAMADA (simulcast) que ela vira no transporte.
 *
 * Mora fora de `motorDeVoz.ts` para o teste exercitar o mapeamento de verdade,
 * sem carregar o `livekit-client`. `"LOW"`, `"MEDIUM"` e `"HIGH"` são os nomes
 * de `VideoQuality`; o motor os traduz.
 *
 * - `baixa`: miniaturas do palco e PiP pequeno — a camada mais barata (LOW).
 * - `media`: ladrilhos da grade — MEDIUM.
 * - `alta` e `auto`: o teto alto (HIGH); o LiveKit degrada sozinho quando a
 *   banda não sustenta, e "automática" é justamente não impor teto.
 * - `soAudio`: sem camada — o vídeo é desligado (`setEnabled(false)`).
 */
export type QualidadeDeStream = "auto" | "alta" | "media" | "baixa" | "soAudio";

export type CamadaDeVideo = "LOW" | "MEDIUM" | "HIGH";

export function camadaDe(qualidade: QualidadeDeStream): CamadaDeVideo | undefined {
  switch (qualidade) {
    case "soAudio":
      return undefined;
    case "baixa":
      return "LOW";
    case "media":
      return "MEDIUM";
    case "alta":
    case "auto":
      return "HIGH";
  }
}

/** Pediu menos do que a fonte publica? Alimenta o anúncio de "assistindo em menos". */
export function pediuMenos(qualidade: QualidadeDeStream): boolean {
  return qualidade === "media" || qualidade === "baixa";
}
