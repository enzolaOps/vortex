import { afterEach, describe, expect, it } from "vitest";

import {
  alternarFavorita,
  deTexto,
  ehFavorita,
  limparFavoritos,
  ordenarComFavoritas,
} from "./favoritos";
import { aplicarRemoto, ligarEnvio } from "./sync";

afterEach(() => {
  limparFavoritos();
  ligarEnvio(() => {});
});

/**
 * Favoritar conversa. O que se guarda: a favorita sobe SEM bagunçar a ordem de
 * recência do resto, e a escolha vai para a conta (sincronia), não fica presa
 * nesta máquina.
 */
describe("ordenarComFavoritas", () => {
  it("favoritas no topo, na ordem em que foram marcadas; o resto intacto", () => {
    expect(ordenarComFavoritas(["a", "b", "c", "d"], ["c", "a"])).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("favorita que não é mais conversa é ignorada", () => {
    expect(ordenarComFavoritas(["a", "b"], ["x", "b"])).toEqual(["b", "a"]);
  });

  it("sem favoritas devolve a MESMA lista", () => {
    const lista = ["a", "b"];
    expect(ordenarComFavoritas(lista, [])).toBe(lista);
  });
});

describe("alternarFavorita", () => {
  it("marca, desmarca e avisa a sincronia com a lista inteira", () => {
    const enviados: string[] = [];
    ligarEnvio((chave, valor) => enviados.push(`${chave}=${valor}`));

    alternarFavorita("dm1");
    expect(ehFavorita("dm1")).toBe(true);
    alternarFavorita("dm1");
    expect(ehFavorita("dm1")).toBe(false);

    expect(enviados).toEqual(['vortex:favoritos=["dm1"]', "vortex:favoritos=[]"]);
  });

  it("o que chega da sincronia não volta como envio", () => {
    const enviados: string[] = [];
    ligarEnvio((chave) => enviados.push(chave));
    aplicarRemoto(() => alternarFavorita("dm2"));
    expect(enviados).toEqual([]);
  });
});

describe("deTexto", () => {
  it("só lista de strings, sem repetição; o resto vira vazio", () => {
    expect(deTexto('["a","a",3,"b"]')).toEqual(["a", "b"]);
    expect(deTexto('{"a":1}')).toEqual([]);
    expect(deTexto("podre")).toEqual([]);
  });
});
