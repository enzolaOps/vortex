import { describe, expect, it } from "vitest";

import { CATEGORIAS } from "./emojis";
import { aceitaTom, comTom } from "./tomDePele";

describe("tom de pele", () => {
  it("cola o modificador depois da base", () => {
    expect(comTom("👍", "medio")).toBe("👍🏽");
    expect(comTom("🙏", "escuro")).toBe("🙏🏿");
    expect(comTom("🫶", "claro")).toBe("🫶🏻");
  });

  it("padrão é o glifo sem modificador", () => {
    expect(comTom("👍", "padrao")).toBe("👍");
  });

  /*
    ⚠ O defeito que "aplica em tudo" produziria: o sistema desenha o olho e,
    ao lado, um quadradinho marrom.
  */
  it.each(["👀", "🧠", "🙂", "🐶", "🔥", "🫡"])(
    "%s não aceita tom e fica como está",
    (glifo) => {
      expect(aceitaTom(glifo)).toBe(false);
      expect(comTom(glifo, "medioEscuro")).toBe(glifo);
    },
  );

  it("o seletor de variação sai quando o modificador entra", () => {
    // ✌️ = U+270C U+FE0F
    expect(comTom("✌️", "medio")).toBe("✌\u{1F3FD}");
  });

  it("glifo que já tem tom não é reescrito", () => {
    expect(comTom("👍🏿", "claro")).toBe("👍🏿");
  });

  it("a lista curada tem bases de verdade — senão o seletor não muda nada", () => {
    const bases = CATEGORIAS.flatMap((c) => c.emojis).filter((e) =>
      aceitaTom(e.glifo),
    );
    expect(bases.map((e) => e.glifo)).toEqual(
      expect.arrayContaining(["🤝", "🙏", "👋", "👍", "👎", "💪", "🫶"]),
    );
  });
});
