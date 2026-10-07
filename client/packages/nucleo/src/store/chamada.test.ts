import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarChamada,
  definirChamada,
  lerChamada,
  limparChamada,
  type Chamada,
} from "./chamada";

/**
 * A comparação de `definirChamada` cobre TODOS os campos.
 *
 * ⚠ **Este teste nasce de um defeito silencioso que custou meia hora de
 * diagnóstico na grade de vídeo.** A comparação era uma lista escrita à mão de
 * oito campos; quando `transmitindo`, `comCamera` e `mudos` entraram, mudanças
 * que tocassem só esses três eram lidas como "nada mudou" e engolidas — sem
 * erro, sem aviso, com o store dizendo uma coisa e a tela mostrando outra.
 *
 * Pior: `publicarFontes` no motor publica exatamente esses três. Contra um
 * servidor real, ninguém apareceria com câmera nunca, e a investigação
 * começaria pelo LiveKit.
 *
 * A comparação virou varredura de chaves, o que já torna o defeito impossível.
 * Este teste guarda a varredura: se alguém a trocar de volta por uma lista, ou
 * se ela passar a pular um tipo de campo, o campo novo reprova sozinho — sem
 * ninguém precisar lembrar de vir aqui.
 *
 * ⚠ **Ele deriva os campos do PRÓPRIO estado**, e não de uma lista repetida.
 * Uma cópia da lista de campos aqui teria a mesma doença que o original: este
 * projeto já registrou um teste que media uma cor que o app não produzia mais,
 * porque duplicava constantes "de propósito".
 */

/** Um valor diferente do atual, seja ele qual for. */
function outro(valor: unknown): unknown {
  if (typeof valor === "boolean") return !valor;
  if (typeof valor === "number") return valor + 1;
  if (Array.isArray(valor)) return [...(valor as unknown[]), "01OUTRO"];
  if (typeof valor === "string") return `${valor}-outro`;
  throw new Error("tipo de campo não previsto por este teste");
}

describe("definirChamada", () => {
  beforeEach(() => {
    limparChamada();
  });

  it("publica quando QUALQUER campo muda", () => {
    const campos = Object.keys(lerChamada()) as (keyof Chamada)[];

    /*
      ⚠ O laço que roda zero vezes. Este projeto já teve duas guardas que
      aprovaram tudo varrendo uma lista vazia.
    */
    expect(campos.length).toBeGreaterThan(8);

    for (const campo of campos) {
      limparChamada();
      let avisos = 0;
      const parar = assinarChamada(() => (avisos += 1));

      definirChamada({ [campo]: outro(lerChamada()[campo]) });
      parar();

      expect(avisos, `mudar \`${campo}\` não avisou ninguém`).toBe(1);
    }
  });

  it("NÃO publica quando nada muda", () => {
    definirChamada({ estado: "dentro", participantes: ["01A", "01B"] });

    let avisos = 0;
    const parar = assinarChamada(() => (avisos += 1));
    /* Mesmo conteúdo, array NOVO — é o caso que a comparação existe para
       absorver: o LiveKit emite mudança de participantes a cada faixa, e a
       maioria não muda a lista. */
    definirChamada({ estado: "dentro", participantes: ["01A", "01B"] });
    parar();

    expect(avisos).toBe(0);
  });

  it("vê diferença de ORDEM numa lista, e não só de tamanho", () => {
    definirChamada({ participantes: ["01A", "01B"] });

    let avisos = 0;
    const parar = assinarChamada(() => (avisos += 1));
    definirChamada({ participantes: ["01B", "01A"] });
    parar();

    expect(avisos).toBe(1);
  });
});

/**
 * O cronômetro da transmissão conta desde a TRANSMISSÃO (D-TELA-11).
 *
 * Contava desde a entrada na chamada: quem entrava às 14h e transmitia às
 * 14h30 via "AO VIVO 30:00" no primeiro segundo no ar.
 */
describe("telaDesde", () => {
  beforeEach(() => {
    limparChamada();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("nasce na transição de `tela`, e não na entrada da chamada", () => {
    vi.setSystemTime(1_000_000);
    definirChamada({ estado: "dentro", desde: Date.now() });
    expect(lerChamada().telaDesde).toBe(0);

    vi.setSystemTime(1_000_000 + 30 * 60_000);
    definirChamada({ tela: true });
    expect(lerChamada().telaDesde).toBe(1_000_000 + 30 * 60_000);
    expect(lerChamada().desde).toBe(1_000_000);
  });

  it("repetir `tela: true` (releitura na reconexão) NÃO zera o relógio", () => {
    vi.setSystemTime(5_000);
    definirChamada({ tela: true });
    vi.setSystemTime(9_000);
    definirChamada({ tela: true, camera: true });
    expect(lerChamada().telaDesde).toBe(5_000);
  });

  it("morre com a transmissão e recomeça do zero na seguinte", () => {
    vi.setSystemTime(5_000);
    definirChamada({ tela: true });
    definirChamada({ tela: false, telaPausada: false, telaAudio: "sem" });
    expect(lerChamada().telaDesde).toBe(0);

    vi.setSystemTime(8_000);
    definirChamada({ tela: true });
    expect(lerChamada().telaDesde).toBe(8_000);
  });
});
