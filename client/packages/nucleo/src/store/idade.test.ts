import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A confirmação de idade por canal (D-CCANAL-06).
 *
 * Módulo reimportado a cada caso: o `cache` é module-level e lido do
 * `localStorage` na carga, que é justamente o caminho que um F5 percorre.
 */
const CHAVE = "vortex:idade-confirmada";

async function carregar() {
  vi.resetModules();
  return import("./idade");
}

beforeEach(() => {
  localStorage.clear();
});

describe("confirmação de idade", () => {
  it("canal nasce pedindo confirmação", async () => {
    const { idadeConfirmada } = await carregar();
    expect(idadeConfirmada("01CANAL")).toBe(false);
  });

  it("confirmar vale para AQUELE canal e avisa quem assina", async () => {
    const { assinarIdade, confirmarIdade, idadeConfirmada } = await carregar();
    const ouvinte = vi.fn();
    const desassinar = assinarIdade(ouvinte);

    confirmarIdade("01CANAL");

    expect(idadeConfirmada("01CANAL")).toBe(true);
    /* Quem aceitou um canal não aceitou todos os que alguém marcar depois. */
    expect(idadeConfirmada("01OUTRO")).toBe(false);
    expect(ouvinte).toHaveBeenCalledTimes(1);
    desassinar();
  });

  it("confirmar de novo não acorda ninguém", async () => {
    const { assinarIdade, confirmarIdade } = await carregar();
    confirmarIdade("01CANAL");
    const ouvinte = vi.fn();
    assinarIdade(ouvinte);
    confirmarIdade("01CANAL");
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("sobrevive ao F5", async () => {
    const primeira = await carregar();
    primeira.confirmarIdade("01CANAL");

    const depois = await carregar();
    expect(depois.idadeConfirmada("01CANAL")).toBe(true);
  });

  it("valor corrompido vira 'ninguém confirmou', e não exceção", async () => {
    localStorage.setItem(CHAVE, "{não é json");
    const { idadeConfirmada } = await carregar();
    expect(idadeConfirmada("01CANAL")).toBe(false);

    localStorage.setItem(CHAVE, JSON.stringify(["01CANAL", 42, null]));
    const outra = await carregar();
    expect(outra.idadeConfirmada("01CANAL")).toBe(true);
  });
});
