import { describe, expect, it } from "vitest";

import { motivoDe } from "./autenticacao";

/**
 * A tradução do erro, que é a parte do login que se pode testar sem servidor.
 *
 * "Failed to fetch" é escrito para quem programa. Quem digitou a senha precisa
 * saber se errou a senha ou se o servidor não respondeu — são problemas
 * diferentes, com ações diferentes, e confundi-los faz a pessoa tentar a coisa
 * errada por minutos.
 *
 * Nenhuma mensagem daqui repete o texto do servidor: a resposta do protocolo é
 * em inglês e escrita para uma API, e passá-la adiante seria mostrar a
 * plumbing para quem quer entrar no app.
 */
describe("motivo da falha de login", () => {
  it("401 é senha errada, e diz isso", () => {
    expect(motivoDe({ response: { status: 401 } })).toContain("incorretos");
  });

  it("429 pede espera, não outra tentativa", () => {
    // Dizer "tente de novo" num 429 faz a pessoa cavar mais fundo o buraco.
    const m = motivoDe({ response: { status: 429 } });
    expect(m).toContain("Espere");
    expect(m).not.toContain("Tente de novo");
  });

  it("5xx aponta para o servidor, não para a pessoa", () => {
    expect(motivoDe({ response: { status: 503 } })).toContain("servidor");
  });

  it("sem status é rede — o pedido não chegou a lugar nenhum", () => {
    expect(motivoDe(new Error("Failed to fetch"))).toContain("conexão");
  });

  it("erro de forma inesperada ainda produz frase legível", () => {
    // Nunca `undefined` na tela: uma caixa de erro vazia é pior que nenhuma.
    for (const e of [undefined, null, "texto", { response: {} }]) {
      expect(motivoDe(e).length).toBeGreaterThan(10);
    }
  });
});
