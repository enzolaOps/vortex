import { describe, expect, it } from "vitest";

import { TOKENS_DE_TEMA } from "../preset/tokens";
import { PARES, SEM_PAR } from "./pares";

/**
 * Todo token está classificado — usado num par, ou dispensado com motivo.
 *
 * A auditoria de design perguntou por que `--vx-border-subtle` não estava na
 * lista de pares. A resposta era boa, mas não estava escrita em lugar nenhum, e
 * é aí que mora o problema: token AUSENTE de propósito e token ESQUECIDO são a
 * mesma coisa olhando o arquivo. O primeiro é uma decisão; o segundo é um furo
 * de contraste que passa despercebido para sempre.
 *
 * Isto fecha o buraco do mesmo jeito que o teste de `TokenName` contra o
 * `tokens.css`: nos DOIS sentidos, e com "pare" como default do que ninguém
 * classificou.
 */
describe("classificação dos tokens", () => {
  const usados = new Set<string>();
  for (const p of PARES) {
    usados.add(p.fg);
    usados.add(p.bg);
  }

  it("nenhum token fica sem par e sem motivo", () => {
    const orfaos = TOKENS_DE_TEMA.filter(
      (t) => !usados.has(t) && SEM_PAR[t] === undefined,
    );
    expect(orfaos).toEqual([]);
  });

  it("nenhum motivo sobra para token que sumiu ou que voltou a ter par", () => {
    // O outro sentido. Sem ele a lista de dispensas vira depósito: o motivo
    // continua ali depois de o token deixar de existir, ou depois de ele ganhar
    // um par de verdade — e passa a mentir sobre uma decisão que ninguém tomou.
    const conhecidos = new Set<string>(TOKENS_DE_TEMA);
    const sobrando = Object.keys(SEM_PAR).filter(
      (t) => !conhecidos.has(t) || usados.has(t),
    );
    expect(sobrando).toEqual([]);
  });

  it("todo motivo é uma frase, não um marcador vazio", () => {
    for (const [token, motivo] of Object.entries(SEM_PAR)) {
      expect(motivo.length, token).toBeGreaterThan(40);
    }
  });
});
