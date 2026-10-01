import { describe, expect, it } from "vitest";

import { envolverSelecao, inserirNoCursor, tomDoContador } from "./formatacao";

describe("envolverSelecao", () => {
  it("envolve só a seleção, não o texto inteiro", () => {
    // "Decisões de liderança" com "liderança" selecionado
    const r = envolverSelecao("Decisões de liderança", 12, 21, "**");
    expect(r?.texto).toBe("Decisões de **liderança**");
    // a seleção continua sendo a palavra, agora dentro das marcas
    expect(r && r.texto.slice(r.inicio, r.fim)).toBe("liderança");
  });

  it("sem seleção, insere a marca vazia com o cursor no meio", () => {
    const r = envolverSelecao("ab", 1, 1, "~~");
    expect(r).toEqual({ texto: "a~~~~b", inicio: 3, fim: 3 });
  });

  it("aceita a seleção de trás para frente", () => {
    expect(envolverSelecao("abcd", 3, 1, "*")?.texto).toBe("a*bc*d");
  });

  it("não aplica quando passaria do limite, em vez de cortar a marca", () => {
    expect(envolverSelecao("abc", 0, 3, "**", 6)).toBeUndefined();
    expect(envolverSelecao("abc", 0, 3, "**", 7)?.texto).toBe("**abc**");
  });
});

describe("inserirNoCursor", () => {
  it("insere no cursor, não no fim", () => {
    expect(inserirNoCursor("olá mundo", 3, 3, " 🙂")).toEqual({
      texto: "olá 🙂 mundo",
      inicio: 3 + " 🙂".length,
      fim: 3 + " 🙂".length,
    });
  });

  it("substitui a seleção", () => {
    expect(inserirNoCursor("abcd", 1, 3, "X")?.texto).toBe("aXd");
  });

  it("respeita o limite", () => {
    expect(inserirNoCursor("abc", 3, 3, "d", 3)).toBeUndefined();
  });
});

describe("tomDoContador", () => {
  it("neutro abaixo de 90%, aviso a partir de 90%, perigo no limite", () => {
    expect(tomDoContador(0, 1024)).toBe("neutro");
    expect(tomDoContador(921, 1024)).toBe("neutro"); // 89,9%
    expect(tomDoContador(922, 1024)).toBe("aviso"); // 90,04%
    expect(tomDoContador(1023, 1024)).toBe("aviso");
    expect(tomDoContador(1024, 1024)).toBe("perigo");
    // a fronteira é inclusiva: 90% exatos já é aviso
    expect(tomDoContador(90, 100)).toBe("aviso");
    expect(tomDoContador(89, 100)).toBe("neutro");
  });
});
