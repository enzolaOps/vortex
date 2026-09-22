import { describe, expect, it } from "vitest";

import { empurrarItem, moverItem } from "./reordenar";

describe("moverItem", () => {
  it("tira de um lugar e põe no outro", () => {
    expect(moverItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moverItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("para o MESMO lugar devolve a lista, e é a mesma referência", () => {
    /* Sem isso, todo `dragover` com o ponteiro parado — que o navegador
       dispara a ~20 Hz — daria array novo e re-renderizaria a lista inteira
       sem nada ter mudado de lugar. */
    const lista = ["a", "b", "c"];
    expect(moverItem(lista, 1, 1)).toBe(lista);
  });

  it("índice fora de faixa devolve a lista intacta", () => {
    const lista = ["a", "b"];
    /* `indexOf` de quem não está na lista devolve -1, e é assim que o
       chamador chega aqui: o item saiu enquanto o arraste rolava. */
    expect(moverItem(lista, -1, 0)).toBe(lista);
    expect(moverItem(lista, 0, 9)).toBe(lista);
  });
});

describe("empurrarItem", () => {
  it("sobe e desce uma casa", () => {
    expect(empurrarItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(empurrarItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
  });

  it("NÃO circula nas pontas", () => {
    /* Uma lista que dá a volta faz quem segura a tecla perder de vista onde o
       item parou: "não mexeu" é mais fácil de entender que "foi para o outro
       lado". */
    const lista = ["a", "b", "c"];
    expect(empurrarItem(lista, 0, -1)).toBe(lista);
    expect(empurrarItem(lista, 2, 1)).toBe(lista);
  });
});
