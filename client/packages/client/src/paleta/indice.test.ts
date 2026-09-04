import { describe, expect, it } from "vitest";

import { combina, pontuar } from "./indice";

/**
 * O filtro da paleta.
 *
 * Lógica pura sobre duas strings — o que a torna testável sem store, sem SDK e
 * sem DOM, e é por isso que ela vive separada do componente.
 *
 * O que estes testes protegem é a diferença entre uma paleta que parece rápida
 * e uma lista com campo de busca: subsequência em vez de substring, acento
 * ignorado, e prefixo ganhando de espalhado.
 */

describe("combina", () => {
  it("acha por subsequência, não só por prefixo", () => {
    // É isto que faz a paleta parecer rápida: a pessoa digita as consoantes
    // que lembra, não o começo exato.
    expect(combina("geral", "gr")).toBe(true);
    expect(combina("conversa", "cnv")).toBe(true);
    expect(combina("voz-jogos", "vj")).toBe(true);
  });

  it("respeita a ORDEM das letras", () => {
    // Subsequência não é "contém estas letras": "rg" não é "geral" ao
    // contrário, e aceitar isso encheria a lista de ruído.
    expect(combina("geral", "rg")).toBe(false);
  });

  it("ignora acento nos dois lados", () => {
    // Quem tem teclado sem acento não pode ficar de fora da própria lista de
    // contatos — e quem digita com acento também tem que achar.
    expect(combina("Emília", "emilia")).toBe(true);
    expect(combina("Emilia", "emília")).toBe(true);
    expect(combina("Íris", "iris")).toBe(true);
  });

  it("ignora caixa", () => {
    expect(combina("Vortex", "VOR")).toBe(true);
    expect(combina("vortex", "Vor")).toBe(true);
  });

  it("busca vazia combina com tudo", () => {
    // A paleta abre mostrando o índice inteiro, não uma lista vazia
    // esperando alguém digitar.
    expect(combina("qualquer coisa", "")).toBe(true);
  });
});

describe("pontuar", () => {
  it("prefixo ganha de substring, que ganha de espalhado", () => {
    expect(pontuar("geral", "ger")).toBeLessThan(pontuar("agenda-geral", "ger"));
    expect(pontuar("agenda-geral", "ger")).toBeLessThan(pontuar("gerenciar", "gnr"));
  });

  it("ordena de fato uma lista realista", () => {
    // O caso que motiva a pontuação existir: digitar "ger" tem que trazer
    // `geral` primeiro, não `gerenciamento-de-recursos`.
    const canais = ["gerenciamento-de-recursos", "agenda-geral", "geral"];
    const ordenados = canais
      .filter((c) => combina(c, "ger"))
      .sort((a, b) => pontuar(a, "ger") - pontuar(b, "ger"));

    expect(ordenados[0]).toBe("geral");
  });

  it("acento não muda a pontuação", () => {
    expect(pontuar("Emília", "emi")).toBe(pontuar("Emilia", "emi"));
  });
});

/**
 * O caso que o desempate por comprimento por pouco não quebrou.
 *
 * Com busca vazia a paleta mostra o índice inteiro, e a ORDEM dele é
 * significativa: servidores, canais, pessoas. Pontuar por comprimento também
 * sem busca misturaria os três tipos numa lista ordenada por tamanho de nome.
 */
describe("ordem sem busca", () => {
  it("todos empatam, para a ordem do índice sobreviver", () => {
    expect(pontuar("Vortex", "")).toBe(pontuar("um-nome-de-canal-bem-longo", ""));
  });
});
