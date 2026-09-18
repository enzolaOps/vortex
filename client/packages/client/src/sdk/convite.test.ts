import { describe, expect, it } from "vitest";

import { codigoDe } from "./servidores";
import { conviteNoTexto } from "./conviteNoTexto";

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

/**
 * O convite ESCRITO numa mensagem (D-EVT-40).
 *
 * ⚠ **Reconhecimento estreito de propósito, e é o que separa este de
 * `codigoDe`.** Lá a entrada vem de um campo chamado "Convite", e aceitar
 * `abc123` solto poupa atrito; aqui a entrada é texto que outra pessoa
 * escreveu, e o cartão que sai daqui traz um botão que MUDA de servidor. Um
 * scanner que pegasse "o último segmento de qualquer URL" transformaria um
 * link de artigo num convite falso — e ninguém leria o link para conferir.
 */
describe("convite dentro de uma mensagem", () => {
  it.each([
    ["entra aí https://vortex.exemplo/convite/a9Kq2", "a9Kq2"],
    ["https://stt.gg/a9Kq2 valeu", "a9Kq2"],
    ["olha https://vortex.gg/a9Kq2", "a9Kq2"],
    // O upstream escreve `/invite/`; o mesmo link vindo de outro cliente.
    ["http://exemplo.test/invite/xY_9-z", "xY_9-z"],
    // Vários links: o primeiro ganha — a linha desenha UM cartão.
    [
      "a https://vortex.exemplo/convite/um e https://vortex.exemplo/convite/dois",
      "um",
    ],
  ])("%s → %s", (texto, esperado) => {
    expect(conviteNoTexto(texto)).toBe(esperado);
  });

  it.each([
    "",
    "bom dia",
    // O caso que decide o desenho: URL comum não pode virar convite.
    "leia https://exemplo.test/artigos/react",
    "https://exemplo.test/convite",
    // Domínio parecido com o encurtador não basta: o caminho tem de ser dele.
    "https://naostt.gg.exemplo.test/algo",
    // `abc123` solto é convite em `codigoDe` e NÃO é aqui.
    "abc123",
  ])("%s não vira cartão", (texto) => {
    expect(conviteNoTexto(texto)).toBeUndefined();
  });
});
