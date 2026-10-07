import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarConexao,
  definirConexao,
  lerConexao,
  lerDetalheDaConexao,
  limparConexao,
  pausarConexao,
} from "./conexao";

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

  it("só avisa quem assina quando algo muda de verdade", () => {
    const ouvinte = vi.fn();
    const parar = assinarConexao(ouvinte);

    /*
      ⚠ **Este teste dizia "uma vez só", e a regra MUDOU com o contador.**

      Ela era: o SDK repete `connecting` enquanto tenta, e republicar a cada
      tentativa acordaria a árvore por nada. A segunda metade continua certa e
      a primeira não: a tentativa É um campo observável agora, e um contador
      que não republica congela no "tentativa 1" para sempre.

      O que impede a árvore de acordar deixou de ser o silêncio do store e
      passou a ser o snapshot: quem assina `lerConexao` recebe a MESMA string
      e o React descarta o render. Quem assina o detalhe é a faixa, e ela é um
      componente só.
    */
    definirConexao("reconectando");
    expect(ouvinte).toHaveBeenCalledTimes(1); // o contador foi para 1
    vi.advanceTimersByTime(2000);
    expect(ouvinte).toHaveBeenCalledTimes(2); // a faixa apareceu

    // Estado repetido SEM contador andando não emite: `sem-conexao` duas vezes
    // seguidas é o mesmo fato dito duas vezes.
    definirConexao("sem-conexao");
    definirConexao("sem-conexao");
    expect(ouvinte).toHaveBeenCalledTimes(3);

    parar();
    definirConexao("conectado");
    expect(ouvinte).toHaveBeenCalledTimes(3);
  });

  it("devolve a MESMA referência enquanto nada muda", () => {
    /*
      O erro nº 1 do briefing, e a única forma de ele não acontecer é esta.
      Um `getSnapshot` que monta o objeto devolve referência nova toda vez,
      `useSyncExternalStore` conclui que mudou e re-renderiza para sempre — e
      isso não dá erro, dá aba travada.
    */
    const antes = lerDetalheDaConexao();
    expect(lerDetalheDaConexao()).toBe(antes);

    definirConexao("sem-conexao");
    vi.advanceTimersByTime(2000);
    const depois = lerDetalheDaConexao();
    expect(depois).not.toBe(antes);

    /*
      ⚠ **O evento REPETIDO é o que prova a coisa**, e a primeira versão deste
      teste só lia duas vezes seguidas — que passa mesmo com o cache quebrado,
      porque ninguém tinha chamado o publicador entre as leituras. O SDK manda
      o mesmo estado várias vezes; é aí que a referência tem de segurar.
    */
    definirConexao("sem-conexao");
    definirConexao("sem-conexao");
    expect(lerDetalheDaConexao()).toBe(depois);
  });

  it("conta as tentativas e zera ao voltar", () => {
    definirConexao("reconectando");
    definirConexao("sem-conexao");
    definirConexao("reconectando");
    expect(lerDetalheDaConexao().tentativa).toBe(2);

    definirConexao("conectado");
    expect(lerDetalheDaConexao().tentativa).toBe(0);
  });

  it("conta a tentativa mesmo dentro da espera", () => {
    /*
      O contador é independente do relógio que decide se a faixa aparece. Se
      ele só andasse depois do aviso, um engasgo que virou queda apareceria
      dizendo "tentativa 1" com três tentativas já gastas.
    */
    definirConexao("reconectando");
    definirConexao("reconectando");
    expect(lerConexao()).toBe("conectado");
    expect(lerDetalheDaConexao().tentativa).toBe(2);
  });

  it("guarda o instante da última sincronia", () => {
    vi.setSystemTime(new Date("2026-01-02T14:31:00"));
    definirConexao("conectado");
    const marca = lerDetalheDaConexao().ultimaSincronia;
    expect(marca).toBe(Date.now());

    vi.setSystemTime(new Date("2026-01-02T14:40:00"));
    definirConexao("sem-conexao");
    vi.advanceTimersByTime(2000);
    // Cair não reescreve a marca: ela é quando o app esteve de pé pela última
    // vez, não quando ele percebeu que não está mais.
    expect(lerDetalheDaConexao().ultimaSincronia).toBe(marca);
    // E ela chega escrita, porque formatar no render é chamada impura.
    expect(lerDetalheDaConexao().ultimaSincroniaTexto).toBe("14:31");
  });

  it("pausar corta a espera e some quando o SDK volta a tentar", () => {
    /*
      "Cancelar" é clique, e atrasar a resposta a um clique é exatamente o
      defeito que a espera existe para evitar, invertido.
    */
    pausarConexao();
    expect(lerConexao()).toBe("sem-conexao");
    expect(lerDetalheDaConexao().pausada).toBe(true);

    definirConexao("reconectando");
    expect(lerDetalheDaConexao().pausada).toBe(false);
  });
});
