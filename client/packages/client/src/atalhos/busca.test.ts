import { describe, expect, it } from "vitest";

import { casa } from "./busca";
import type { LinhaDeAtalho } from "./registro";

const paleta: LinhaDeAtalho = {
  id: "navegadorRapido",
  grupo: "Navegação",
  rotulo: "Navegador rápido",
  teclas: ["mod", "K"],
};

/**
 * A busca da página de atalhos casa por AÇÃO ou por TECLA — e a tecla nas
 * duas grafias, porque o que a pessoa digita é o que ela lê na tela.
 */
describe("busca de atalho", () => {
  it("casa pelo rótulo, sem acento e sem caixa", () => {
    expect(casa(paleta, "navegador rapido")).toBe(true);
  });

  it("casa pelo token neutro e pela grafia da plataforma", () => {
    expect(casa(paleta, "mod")).toBe(true);
    // O ambiente de teste não é Mac: a grafia exibida é "Ctrl".
    expect(casa(paleta, "ctrl")).toBe(true);
  });

  /**
   * ⚠ O exemplo que a própria tela sugere no estado vazio é "Ctrl+K" — e
   * nenhum token isolado contém o "+". Sem casar a combinação inteira, a
   * sugestão da tela não acharia nada.
   */
  it("casa a combinação inteira, com e sem separador", () => {
    expect(casa(paleta, "ctrl+k")).toBe(true);
    expect(casa(paleta, "ctrlk")).toBe(true);
  });

  it("não casa o que não está lá", () => {
    expect(casa(paleta, "xyzzy")).toBe(false);
  });

  it("busca vazia casa tudo", () => {
    expect(casa(paleta, "")).toBe(true);
  });
});
