import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { VERSAO_DO_MEDIAPIPE } from "../mediapipe";
import {
  CAMINHO_DO_RUNTIME,
  RAIO_DO_DESFOQUE,
  opcoesDeFundo,
} from "nucleo/ui-logica/voz/fundoDeVideo";

describe("fundo de vídeo no app", () => {
  it("o runtime do MediaPipe é servido da própria origem, na versão do build", () => {
    expect(__VERSAO_MEDIAPIPE__).toBe(VERSAO_DO_MEDIAPIPE);
    expect(CAMINHO_DO_RUNTIME).toBe(`/mediapipe/${VERSAO_DO_MEDIAPIPE}`);
    expect(CAMINHO_DO_RUNTIME).not.toMatch(/^https?:/);
  });

  it("preferência vira o modo do processador", () => {
    expect(opcoesDeFundo("desfoque")).toEqual({
      mode: "background-blur",
      blurRadius: RAIO_DO_DESFOQUE,
    });
    expect(opcoesDeFundo("nenhum")).toEqual({ mode: "disabled" });
  });

  it("o motor só carrega o segmentador por import dinâmico", () => {
    const fonte = readFileSync(
      new URL("../../nucleo/src/sdk/motorDeVoz.ts", import.meta.url),
      "utf8",
    );
    expect(fonte).toMatch(/await import\("\.\.\/ui-logica\/voz\/fundoDeVideo"\)/);
    expect(fonte).not.toMatch(/^import (?!type)[^;]*fundoDeVideo/m);
  });
});
