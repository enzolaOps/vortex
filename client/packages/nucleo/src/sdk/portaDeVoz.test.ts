import { describe, expect, it } from "vitest";

import { lerPreferenciasDeVoz } from "../store/preferenciasDeVoz";
import { aplicarPorta, portaAtiva } from "./portaDeVoz";

function faixa(enabled: boolean, isMuted: boolean) {
  return { mediaStreamTrack: { enabled } as MediaStreamTrack, isMuted };
}

describe("porta de voz do limiar manual", () => {
  it("vale só em detecção com a sensibilidade automática desligada", () => {
    const p = lerPreferenciasDeVoz();
    expect(portaAtiva({ ...p, modo: "deteccao", sensibilidadeAutomatica: false })).toBe(true);
    expect(portaAtiva({ ...p, modo: "deteccao", sensibilidadeAutomatica: true })).toBe(false);
    expect(portaAtiva({ ...p, modo: "pressionar", sensibilidadeAutomatica: false })).toBe(false);
  });

  it("fecha e reabre a origem abaixo e acima do limiar", () => {
    const f = faixa(true, false);
    aplicarPorta(f, false);
    expect(f.mediaStreamTrack.enabled).toBe(false);
    aplicarPorta(f, true);
    expect(f.mediaStreamTrack.enabled).toBe(true);
  });

  it("nunca reabre o microfone de quem está mudo", () => {
    // O LiveKit desligou a origem ao mutar; a porta aberta não pode religá-la.
    const f = faixa(false, true);
    aplicarPorta(f, true);
    expect(f.mediaStreamTrack.enabled).toBe(false);
  });
});
