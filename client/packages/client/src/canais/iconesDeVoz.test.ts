import { describe, expect, it } from "vitest";

import { iconesDoParticipante } from "./iconesDeVoz";

const base = {
  estado: "voz" as const,
  mudo: false,
  surdo: false,
  mudoPeloServidor: false,
  surdoPeloServidor: false,
};

describe("ícones da linha de voz (D-VOZ-02)", () => {
  it("voz simples não ganha ícone", () => {
    expect(iconesDoParticipante(base)).toEqual({ visiveis: [], recolhidos: [] });
  });

  it("até três cabem, na ordem da linha", () => {
    const r = iconesDoParticipante({ ...base, estado: "tela", mudo: true, mudoPeloServidor: true });
    expect(r.visiveis).toEqual(["tela", "srvMudo", "mudo"]);
    expect(r.recolhidos).toEqual([]);
  });

  it("acima de três, o MENOS crítico colapsa — e nunca a imposição do servidor", () => {
    const r = iconesDoParticipante({
      ...base,
      estado: "tela",
      surdo: true,
      mudoPeloServidor: true,
      surdoPeloServidor: true,
    });
    expect(r.visiveis).toHaveLength(3);
    expect(r.visiveis).toEqual(["srvSurdo", "srvMudo", "surdo"]);
    expect(r.recolhidos).toEqual(["tela"]);
  });

  it("surdo esconde o mudo — diria a mesma coisa duas vezes", () => {
    const r = iconesDoParticipante({ ...base, mudo: true, surdo: true });
    expect(r.visiveis).toEqual(["surdo"]);
  });

  it("respeita um teto menor", () => {
    const r = iconesDoParticipante({ ...base, estado: "video", mudo: true, mudoPeloServidor: true }, 1);
    expect(r.visiveis).toEqual(["srvMudo"]);
    expect(r.recolhidos).toEqual(["mudo", "video"]);
  });
});
