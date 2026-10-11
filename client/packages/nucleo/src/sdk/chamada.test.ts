import { beforeEach, describe, expect, it, vi } from "vitest";

import { lerChamada, limparChamada } from "../store/chamada";

/*
  O motor entra por `import()`; o mock o segura numa promessa para provar o que
  a fachada faz ENQUANTO o chunk baixa.
*/
const h = vi.hoisted(() => {
  let liberar!: () => void;
  const portao = new Promise<void>((r) => {
    liberar = r;
  });
  return { portao, liberar, importado: vi.fn() };
});

vi.mock("./motorDeVoz", async () => {
  h.importado();
  await h.portao;
  return {
    entrarNaChamada: vi.fn(() => Promise.resolve(true)),
    sairDaChamada: vi.fn(() => Promise.resolve()),
  };
});

import { entrarNaChamada, precarregarMotorDeVoz } from "./chamada";

describe("fachada de chamada", () => {
  beforeEach(() => limparChamada());

  it("marca 'conectando' no clique, antes do motor terminar de carregar", async () => {
    const p = entrarNaChamada("01CANAL");
    // O chunk ainda está "baixando" (portão fechado) e a UI já respondeu.
    expect(lerChamada().estado).toBe("conectando");
    expect(lerChamada().channelId).toBe("01CANAL");
    h.liberar();
    expect(await p).toBe(true);
  });

  it("precarregar só baixa o chunk, sem entrar em sala", async () => {
    precarregarMotorDeVoz();
    await Promise.resolve();
    expect(lerChamada().estado).toBe("fora");
  });
});
