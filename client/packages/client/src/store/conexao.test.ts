import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { assinarConexao, definirConexao, lerConexao, limparConexao } from "./conexao";

/**
 * A espera antes de avisar, e a pressa em desavisar.
 *
 * Reconexão de socket é frequente e quase sempre invisível — um segundo de
 * túnel, um wi-fi trocando de ponto. Uma faixa que pisca a cada engasgo ensina
 * a ignorá-la, e aí ela não serve para o caso que importa: a queda que dura.
 *
 * O que estes testes guardam é a ASSIMETRIA. Avisar espera; parar de avisar,
 * não. Um aviso que demora a sumir depois de resolvido é pior que não ter
 * havido aviso nenhum, porque ele mente sobre o presente.
 */
describe("estado da conexão", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    limparConexao();
  });
  afterEach(() => vi.useRealTimers());

  it("engasgo curto não avisa ninguém", () => {
    definirConexao("reconectando");
    vi.advanceTimersByTime(1000);
    expect(lerConexao()).toBe("conectado");

    definirConexao("conectado");
    vi.advanceTimersByTime(5000);
    // E o agendamento antigo não pode disparar depois: ele avisaria de uma
    // queda que já passou.
    expect(lerConexao()).toBe("conectado");
  });

  it("queda que dura avisa", () => {
    definirConexao("reconectando");
    vi.advanceTimersByTime(2000);
    expect(lerConexao()).toBe("reconectando");
  });

  it("voltar é IMEDIATO, sem espera", () => {
    definirConexao("reconectando");
    vi.advanceTimersByTime(2000);
    expect(lerConexao()).toBe("reconectando");

    definirConexao("conectado");
    // Sem avançar relógio nenhum.
    expect(lerConexao()).toBe("conectado");
  });

  it("piorar durante o aviso troca o texto na hora", () => {
    /*
      Já estava avisando "reconectando" e virou "sem conexão". Fazer a pessoa
      esperar de novo para saber que piorou seria esconder a informação nova
      atrás da regra que existe para esconder a informação irrelevante.
    */
    definirConexao("reconectando");
    vi.advanceTimersByTime(2000);
    definirConexao("sem-conexao");
    expect(lerConexao()).toBe("sem-conexao");
  });

  it("avisa uma vez só quem assina, e só quando muda", () => {
    const ouvinte = vi.fn();
    const parar = assinarConexao(ouvinte);

    definirConexao("reconectando");
    vi.advanceTimersByTime(2000);
    expect(ouvinte).toHaveBeenCalledTimes(1);

    // O SDK repete `connecting` enquanto tenta. Republicar a cada tentativa
    // acordaria a árvore inteira sem nada ter mudado.
    definirConexao("reconectando");
    definirConexao("reconectando");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    parar();
    definirConexao("conectado");
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
