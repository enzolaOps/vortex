import { describe, expect, it } from "vitest";

import { HOSTS_DE_PLAYER } from "nucleo/sdk/traduzirEmbeds";

import { montarPolitica } from "../csp";

function diretiva(politica: string, nome: string): string {
  return politica.split("; ").find((d) => d.startsWith(`${nome} `)) ?? "";
}

describe("CSP do app", () => {
  const prod = montarPolitica({ dev: false, apiUrl: "https://vortex.example/api" });

  it("script-src de produção não tem unsafe-inline nem unsafe-eval", () => {
    const s = diretiva(prod, "script-src");
    expect(s).not.toContain("'unsafe-inline'");
    expect(s).not.toMatch(/'unsafe-eval'/);
  });

  it("img-src, media-src e connect-src não abrem para https: nem *", () => {
    for (const nome of ["img-src", "media-src", "connect-src"]) {
      const d = diretiva(prod, nome).split(" ");
      expect(d).not.toContain("https:");
      expect(d).not.toContain("*");
    }
  });

  it("deriva a origem da API e o socket", () => {
    expect(diretiva(prod, "connect-src")).toContain("https://vortex.example");
    expect(diretiva(prod, "connect-src")).toContain("wss://vortex.example");
  });

  it("frame-src só abre para os players do embed, e na mesma lista do núcleo", () => {
    const hosts = diretiva(prod, "frame-src").split(" ").filter((x) => x.startsWith("https://")).map((x) => new URL(x).hostname);
    expect(new Set(hosts)).toEqual(new Set(HOSTS_DE_PLAYER));
    expect(diretiva(prod, "frame-src").split(" ")).not.toContain("https:");
  });

  it("só o dev server aceita script inline", () => {
    expect(diretiva(montarPolitica({ dev: true }), "script-src")).toContain("'unsafe-inline'");
  });

  it("fundo de vídeo: só compila wasm e usa worker/blob, sem abrir origem externa", () => {
    expect(diretiva(prod, "script-src")).toContain("'wasm-unsafe-eval'");
    expect(diretiva(prod, "worker-src")).toBe("worker-src 'self' blob:");
    expect(prod).not.toMatch(/jsdelivr|googleapis/);
  });
});
