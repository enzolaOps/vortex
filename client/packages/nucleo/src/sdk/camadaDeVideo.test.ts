import { describe, expect, it } from "vitest";

import { camadaDe, pediuMenos, type QualidadeDeStream } from "./camadaDeVideo";

describe("camadaDe", () => {
  it("baixa pede a camada LOW, abaixo da média", () => {
    expect(camadaDe("baixa")).toBe("LOW");
    expect(camadaDe("media")).toBe("MEDIUM");
  });

  it("alta e auto pedem o teto; só áudio não pede camada", () => {
    expect(camadaDe("alta")).toBe("HIGH");
    expect(camadaDe("auto")).toBe("HIGH");
    expect(camadaDe("soAudio")).toBeUndefined();
  });

  it("baixa e média contam como pedir menos; as outras não", () => {
    const todas: QualidadeDeStream[] = ["auto", "alta", "media", "baixa", "soAudio"];
    expect(todas.filter(pediuMenos)).toEqual(["media", "baixa"]);
  });
});
