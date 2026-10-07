import { describe, expect, it } from "vitest";

import { compararVersoes, versaoAbaixoDoMinimo } from "./versao";

describe("compararVersoes", () => {
  it("compara numericamente, não como texto", () => {
    expect(compararVersoes("4.10.0", "4.9.0")).toBe(1);
    expect(compararVersoes("4.2.0", "4.2.1")).toBe(-1);
    expect(compararVersoes("4.2.0", "4.2.0")).toBe(0);
  });

  it("componente ausente vale zero e aceita prefixo v", () => {
    expect(compararVersoes("4.2", "4.2.0")).toBe(0);
    expect(compararVersoes("v5", "4.9.9")).toBe(1);
  });

  it("pré-release vem antes da versão final", () => {
    expect(compararVersoes("4.2.0-beta", "4.2.0")).toBe(-1);
    expect(compararVersoes("4.2.0-beta.2", "4.2.0-beta.10")).toBe(-1);
    expect(compararVersoes("4.2.0-alpha", "4.2.0-beta")).toBe(-1);
  });

  it("metadado de build não conta", () => {
    expect(compararVersoes("4.2.0+abc", "4.2.0")).toBe(0);
  });

  it("texto que não é versão dá undefined", () => {
    expect(compararVersoes("latest", "4.2.0")).toBeUndefined();
  });
});

describe("versaoAbaixoDoMinimo", () => {
  it("bloqueia só quando a instalada é menor", () => {
    expect(versaoAbaixoDoMinimo("4.2.0", "4.3.0")).toBe(true);
    expect(versaoAbaixoDoMinimo("4.3.0", "4.3.0")).toBe(false);
    expect(versaoAbaixoDoMinimo("4.4.0", "4.3.0")).toBe(false);
  });

  it("mínima ausente, vazia ou malformada nunca bloqueia", () => {
    expect(versaoAbaixoDoMinimo("1.0.0", undefined)).toBe(false);
    expect(versaoAbaixoDoMinimo("1.0.0", "")).toBe(false);
    expect(versaoAbaixoDoMinimo("1.0.0", "quatro")).toBe(false);
  });
});
