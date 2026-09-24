import { describe, expect, it } from "vitest";

import { DEGRAUS_DE_MODO_LENTO, degrausDeModoLento, rotuloDoModoLento } from "./modoLento";

describe("modo lento", () => {
  it("tem os sete degraus do design, na ordem", () => {
    expect(DEGRAUS_DE_MODO_LENTO.map(rotuloDoModoLento)).toEqual([
      "Desativado",
      "5 segundos",
      "30 segundos",
      "1 minuto",
      "5 minutos",
      "15 minutos",
      "1 hora",
    ]);
  });

  it("valor gravado fora dos degraus entra na lista, em ordem", () => {
    expect(degrausDeModoLento(30)).toBe(DEGRAUS_DE_MODO_LENTO);
    expect(degrausDeModoLento(7200)).toEqual([0, 5, 30, 60, 300, 900, 3600, 7200]);
    expect(degrausDeModoLento(10)).toEqual([0, 5, 10, 30, 60, 300, 900, 3600]);
  });

  it("não escreve fração de unidade", () => {
    expect(rotuloDoModoLento(90)).toBe("90 segundos");
    expect(rotuloDoModoLento(5400)).toBe("90 minutos");
    expect(rotuloDoModoLento(21600)).toBe("6 horas");
  });
});
