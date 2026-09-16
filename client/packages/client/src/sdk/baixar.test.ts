import { describe, expect, it } from "vitest";

import { motivoDoDownload, urlDeDownload } from "./baixar";

/**
 * A URL de download. O que ela guarda é o NOME: sem ele o `autumn` responde
 * com um redirect absoluto na raiz, que atrás de um prefixo de proxy dá 404.
 */
describe("urlDeDownload", () => {
  const base = "https://vortex.exemplo/autumn/attachments/01ABC/original";

  it("troca /original pelo nome do arquivo", () => {
    expect(urlDeDownload(base, "densidades.png")).toBe(
      "https://vortex.exemplo/autumn/attachments/01ABC/densidades.png",
    );
  });

  it("codifica o nome — '#' e '?' cortariam a URL", () => {
    expect(urlDeDownload(base, "plano #2 ?.pdf")).toBe(
      "https://vortex.exemplo/autumn/attachments/01ABC/plano%20%232%20%3F.pdf",
    );
  });

  it("URL sem /original fica como veio", () => {
    const url = "https://vortex.exemplo/autumn/attachments/01ABC";
    expect(urlDeDownload(url, "x.png")).toBe(url);
  });

  it("nome vazio mantém /original, que o servidor ainda resolve", () => {
    expect(urlDeDownload(base, "  ")).toBe(base);
  });
});

describe("motivoDoDownload", () => {
  it("404 diz que o arquivo sumiu, e não uma frase genérica", () => {
    expect(motivoDoDownload(404)).toMatch(/não existe/);
    expect(motivoDoDownload(403)).toMatch(/acesso/);
    expect(motivoDoDownload(500)).toMatch(/recusou/);
  });
});
