import { describe, expect, it } from "vitest";

import { codigoDe } from "./servidores";

/**
 * O código, de um código ou de um link.
 *
 * Quem recebe um convite copia o LINK, não o código — obrigar a extrair o
 * pedaço à mão é atrito por nada, e é o tipo de coisa que faz alguém achar que
 * o convite não funciona.
 */
describe("código de convite", () => {
  it.each([
    ["abc123", "abc123"],
    ["https://stt.gg/abc123", "abc123"],
    ["https://vortex.exemplo/convite/abc123", "abc123"],
    ["  https://vortex.exemplo/convite/abc123  ", "abc123"],
    // Parâmetro de rastreio é a forma mais comum de link colado, e a primeira
    // versão devolvia `ref=x` como se fosse o código.
    ["https://vortex.exemplo/convite/abc123?ref=x", "abc123"],
    ["https://vortex.exemplo/convite/abc123#topo", "abc123"],
    ["/convite/xY_9-z", "xY_9-z"],
  ])("%s → %s", (entrada, esperado) => {
    expect(codigoDe(entrada)).toBe(esperado);
  });

  it.each(["", "   ", "https://", "abc 123", "a".repeat(65)])(
    "%s não é convite",
    (entrada) => {
      expect(codigoDe(entrada)).toBeUndefined();
    },
  );
});
