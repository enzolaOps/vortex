import { describe, expect, it } from "vitest";

import { ancoras, dicaDeSilencio, duracao, ehPosicao, textoDoAtalho } from "./modelo";

describe("posição dos widgets", () => {
  /* O padrão do design: voz em cima·fim, mensagem baixo·fim, dica baixo·início. */
  it("posição 2 é cima·fim, e os outros ficam onde o design os põe", () => {
    expect(ancoras(2)).toEqual({
      voz: { v: "cima", h: "fim" },
      mensagem: { v: "baixo", h: "fim" },
      dica: { v: "baixo", h: "inicio" },
    });
  });

  /* Dois widgets no mesmo canto se cobririam. */
  it("voz em baixo·fim empurra a mensagem para cima·fim", () => {
    expect(ancoras(8).mensagem).toEqual({ v: "cima", h: "fim" });
  });

  it("voz em baixo·início empurra a dica para cima·início", () => {
    expect(ancoras(6).dica).toEqual({ v: "cima", h: "inicio" });
  });

  it("nenhuma posição põe dois widgets no mesmo lugar", () => {
    for (let p = 0; p <= 8; p++) {
      if (!ehPosicao(p)) throw new Error("posição inválida");
      const a = ancoras(p);
      const lugares = [a.voz, a.mensagem, a.dica].map((x) => `${x.v}-${x.h}`);
      expect(new Set(lugares).size).toBe(3);
    }
  });

  it("só aceita as nove posições", () => {
    expect(ehPosicao(0)).toBe(true);
    expect(ehPosicao(8)).toBe(true);
    expect(ehPosicao(9)).toBe(false);
    expect(ehPosicao(1.5)).toBe(false);
    expect(ehPosicao("2")).toBe(false);
  });
});

describe("texto", () => {
  it("atalho como o design escreve", () => {
    expect(textoDoAtalho(["shift", "`"], false)).toBe("⇧ `");
    expect(textoDoAtalho(["shift", "mod", "M"], true)).toBe("⇧ ⌘ M");
    expect(textoDoAtalho(["shift", "mod", "M"], false)).toBe("⇧ Ctrl M");
  });

  it("cronômetro em mm:ss, com hora quando passa", () => {
    expect(duracao(2537)).toBe("42:17");
    expect(duracao(3725)).toBe("1:02:05");
    expect(duracao(-4)).toBe("00:00");
  });

  /* "⇧⌘M silencia", do design — com a combinação gravada. */
  it("dica de silenciar, e o verbo muda com o estado", () => {
    expect(dicaDeSilencio(["shift", "mod", "N"], false, true)).toBe("⇧ ⌘ N silencia");
    expect(dicaDeSilencio(["shift", "mod", "N"], true, false)).toBe("⇧ Ctrl N volta");
  });

  /* Casca que não sabe silenciar não pode ver a tela prometer a tecla. */
  it("sem resposta da casca ou sem atalho, não há dica", () => {
    expect(dicaDeSilencio(["shift", "mod", "N"], undefined, false)).toBeUndefined();
    expect(dicaDeSilencio(undefined, false, false)).toBeUndefined();
    expect(dicaDeSilencio([], false, false)).toBeUndefined();
  });
});
