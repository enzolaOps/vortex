import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarQualidadeDaTela,
  constraintsDe,
  definirQualidadeEscolhida,
  esquecerQualidadeDaTela,
  QUALIDADES_DA_TELA,
  qualidadeEscolhida,
} from "./qualidadeDaTela";

/**
 * A qualidade da transmissão.
 *
 * ⚠ **Estas asserções existem porque o caminho de sucesso é INVERIFICÁVEL
 * aqui.** Trocar a qualidade de verdade exige uma sala LiveKit de pé mais
 * captura de tela real, e o painel do navegador bloqueia captura — o mesmo
 * limite que barrou câmera e microfone. O que dá para segurar é a decisão que
 * decide se a feature funciona quando o caminho existir, e ela é pura.
 *
 * O que NÃO é testado aqui, e é dito: que `applyConstraints` de fato muda a
 * faixa. Isso é contrato do navegador, não deste código.
 */

beforeEach(() => {
  esquecerQualidadeDaTela();
});

describe("constraints de um degrau", () => {
  /*
    ⚠ **O teste que justifica ter movido a função do motor para cá.** Com
    `exact`, uma tela de 1366×768 recusaria 1080p com `OverconstrainedError`, e
    o erro chegaria como "não deu para trocar" numa escolha que o navegador
    teria atendido em 768p. É a diferença entre degradar e falhar.
  */
  it("pede `ideal` e NUNCA `exact`", () => {
    for (const q of QUALIDADES_DA_TELA) {
      const c = constraintsDe(q.id);
      expect(c).toEqual({
        height: { ideal: q.altura },
        frameRate: { ideal: q.fps },
      });
      /* Explícito, porque `toEqual` acima passaria se alguém ACRESCENTASSE
         `exact` ao lado de `ideal`? Não — mas passaria com o objeto trocado
         inteiro numa refatoração descuidada, e a intenção merece a linha. */
      expect(JSON.stringify(c)).not.toContain("exact");
    }
  });

  it("cada degrau leva a própria altura e o próprio fps", () => {
    expect(constraintsDe("1080p60")).toEqual({
      height: { ideal: 1080 },
      frameRate: { ideal: 60 },
    });
    expect(constraintsDe("480p30")).toEqual({
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    });
  });

  /* Os quatro rótulos precisam ser distintos: dois degraus com o mesmo nome no
     menu são dois alvos que a pessoa não consegue diferenciar. */
  it("os degraus são distintos em id e em rótulo", () => {
    const ids = new Set(QUALIDADES_DA_TELA.map((q) => q.id));
    const rotulos = new Set(QUALIDADES_DA_TELA.map((q) => q.rotulo));
    expect(ids.size).toBe(QUALIDADES_DA_TELA.length);
    expect(rotulos.size).toBe(QUALIDADES_DA_TELA.length);
  });
});

describe("a escolha", () => {
  /*
    ⚠ **Ausência não é o degrau mais alto**, e a distinção é o que impede o
    menu de afirmar uma escolha que ninguém fez: quem nunca escolheu está no
    que o navegador negociou ao abrir a tela, que não é nenhum dos quatro.
  */
  it("nasce ausente, e ausente não é `1080p60`", async () => {
    /*
      ⚠ **Módulo FRESCO, e a mutação foi quem exigiu.** A primeira versão
      chamava `qualidadeEscolhida()` direto — e o `beforeEach` acima já tinha
      chamado `esquecerQualidadeDaTela()`, então o que ela media era o
      ESQUECER, não o valor inicial. Passou com o módulo nascendo em
      `"1080p60"`, que é justamente o estado que ela diz proibir.

      É o mesmo defeito que a mutação achou em `silencio.test.ts` duas vezes:
      asserção que passa pelo motivo errado, e por isso não guarda nada.
    */
    vi.resetModules();
    const fresco = await import("./qualidadeDaTela");
    expect(fresco.qualidadeEscolhida()).toBeUndefined();
  });

  it("guarda o que foi escolhido", () => {
    definirQualidadeEscolhida("720p30");
    expect(qualidadeEscolhida()).toBe("720p30");
  });

  it("avisa quem assina, e SÓ quando muda", () => {
    const ouvinte = vi.fn();
    assinarQualidadeDaTela(ouvinte);

    definirQualidadeEscolhida("720p30");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    /* Reescrever o mesmo valor não é mudança. Sem a guarda, o menu do HUD
       re-renderizaria a cada clique repetido no degrau já marcado. */
    definirQualidadeEscolhida("720p30");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    definirQualidadeEscolhida("480p30");
    expect(ouvinte).toHaveBeenCalledTimes(2);
  });

  it("parar de assinar solta o ouvinte", () => {
    const ouvinte = vi.fn();
    const soltar = assinarQualidadeDaTela(ouvinte);
    soltar();
    definirQualidadeEscolhida("1080p30");
    expect(ouvinte).not.toHaveBeenCalled();
  });

  /*
    ⚠ **A escolha morre com a FAIXA.** A janela que suportava 1080p60 pode ser
    uma aba de 720p na vez seguinte, e o menu abriria marcando um degrau que a
    faixa nova nunca recebeu. Quem chama é o `LocalTrackUnpublished` do motor,
    que pega os dois caminhos de parada — o nosso e o do botão do navegador.
  */
  it("esquecer volta para a ausência, e avisa", () => {
    const ouvinte = vi.fn();
    definirQualidadeEscolhida("1080p60");
    assinarQualidadeDaTela(ouvinte);

    esquecerQualidadeDaTela();

    expect(qualidadeEscolhida()).toBeUndefined();
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  /* Esquecer o que já está ausente não acorda ninguém — o motor chama isso a
     cada faixa despublicada, inclusive as de câmera e microfone. */
  it("esquecer duas vezes avisa uma vez", () => {
    const ouvinte = vi.fn();
    definirQualidadeEscolhida("1080p60");
    assinarQualidadeDaTela(ouvinte);

    esquecerQualidadeDaTela();
    esquecerQualidadeDaTela();

    expect(ouvinte).toHaveBeenCalledTimes(1);
  });
});
