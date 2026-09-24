import { describe, expect, it } from "vitest";

import {
  codificarAssistindo,
  decodificarAssistindo,
  limitadoPelaRede,
  MAXIMO_DE_ENTRADAS,
  TETO_DO_VALOR,
} from "./espectadores";

const DONO = "01HZX3N8Q9R2S4T6V8W0Y2A4C6";

describe("atributo vx.assiste", () => {
  it("vai e volta sem perder nada", () => {
    const lista = [
      { dono: DONO, altura: 1080, rede: false, cheia: false },
      { dono: "01HZX3N8Q9R2S4T6V8W0Y2A4C7", altura: 720, rede: true, cheia: true },
    ];
    expect(decodificarAssistindo(codificarAssistindo(lista))).toEqual(lista);
  });

  it("altura não medida vira ausência, não zero", () => {
    const valor = codificarAssistindo([{ dono: DONO, rede: false, cheia: false }]);
    expect(decodificarAssistindo(valor)).toEqual([
      { dono: DONO, rede: false, cheia: false },
    ]);
  });

  it("vazio e ausente são a mesma lista vazia", () => {
    expect(decodificarAssistindo(undefined)).toEqual([]);
    expect(decodificarAssistindo("")).toBe(decodificarAssistindo(undefined));
  });

  /*
    O atributo é escrito por OUTRO cliente — qualquer um na sala. O que chega
    malformado vira ausência, nunca exceção nem texto na tela.
  */
  it("recusa o que outro cliente poderia escrever de errado", () => {
    expect(decodificarAssistindo("<script>,1080,")).toEqual([]);
    expect(decodificarAssistindo(`${DONO},-5,`)).toEqual([
      { dono: DONO, rede: false, cheia: false },
    ]);
    expect(decodificarAssistindo(`${DONO},1e9,`)[0]?.altura).toBeUndefined();
    expect(decodificarAssistindo(`${DONO},12.5,`)[0]?.altura).toBeUndefined();
    expect(decodificarAssistindo("x".repeat(TETO_DO_VALOR + 1))).toEqual([]);
  });

  it("dono repetido conta uma vez", () => {
    expect(decodificarAssistindo(`${DONO},1080,;${DONO},720,r`)).toHaveLength(1);
  });

  it("tem teto de entradas nas duas pontas", () => {
    const muitos = Array.from({ length: 10 }, (_, i) => ({
      dono: `u${String(i)}`,
      altura: 720,
      rede: false,
      cheia: false,
    }));
    const valor = codificarAssistindo(muitos);
    expect(valor.length).toBeLessThanOrEqual(TETO_DO_VALOR);
    expect(decodificarAssistindo(valor)).toHaveLength(MAXIMO_DE_ENTRADAS);
    const cru = muitos.map((m) => `${m.dono},720,`).join(";");
    expect(decodificarAssistindo(cru)).toHaveLength(MAXIMO_DE_ENTRADAS);
  });
});

describe("limitadoPelaRede", () => {
  it("abaixo do publicado sem ter pedido é a rede", () => {
    expect(limitadoPelaRede(720, 1080, false)).toBe(true);
  });

  it("720p pedido não é (rede)", () => {
    expect(limitadoPelaRede(720, 1080, true)).toBe(false);
  });

  it("captura de tela com altura quebrada não acusa ninguém", () => {
    expect(limitadoPelaRede(1076, 1080, false)).toBe(false);
  });

  it("sem medida não afirma nada", () => {
    expect(limitadoPelaRede(undefined, 1080, false)).toBe(false);
    expect(limitadoPelaRede(720, undefined, false)).toBe(false);
  });
});
