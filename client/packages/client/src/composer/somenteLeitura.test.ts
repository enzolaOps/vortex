import { describe, expect, it } from "vitest";

import { composerSomenteLeitura } from "./somenteLeitura";

const base = {
  arquivado: true,
  channelId: "T1",
  reabrirEm: undefined,
  rascunho: "",
  respondendo: false,
  gravando: false,
} as const;

describe("composerSomenteLeitura", () => {
  it("tópico arquivado sem gesto nenhum perde o composer", () => {
    expect(composerSomenteLeitura(base)).toBe(true);
  });

  it("tópico ativo nunca", () => {
    expect(composerSomenteLeitura({ ...base, arquivado: false })).toBe(false);
  });

  it("'Responder' na faixa devolve o campo — só no canal onde foi clicado", () => {
    expect(composerSomenteLeitura({ ...base, reabrirEm: "T1" })).toBe(false);
    expect(composerSomenteLeitura({ ...base, reabrirEm: "T2" })).toBe(true);
  });

  it("rascunho, resposta armada ou gravação também devolvem o campo", () => {
    expect(composerSomenteLeitura({ ...base, rascunho: "oi" })).toBe(false);
    expect(composerSomenteLeitura({ ...base, respondendo: true })).toBe(false);
    expect(composerSomenteLeitura({ ...base, gravando: true })).toBe(false);
  });
});
