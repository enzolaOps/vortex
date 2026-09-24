import { describe, expect, it } from "vitest";

import { desfazerSeguirAoResponder } from "./seguirAoResponder";

const TOPICO = { paiId: "PAI", seguidores: ["OUTRA"] };
const desligado = (paiId: string) => paiId !== "PAI";

describe("seguir tópico ao responder (D-NOTIF-16)", () => {
  it("desligado no pai: desfaz o seguir que o servidor fez", () => {
    expect(desfazerSeguirAoResponder(TOPICO, "EU", desligado)).toBe(true);
  });

  it("ligado (o padrão): deixa o servidor seguir", () => {
    expect(desfazerSeguirAoResponder(TOPICO, "EU", () => true)).toBe(false);
  });

  it("quem já seguia continua seguindo, mesmo desligado", () => {
    const sigo = { ...TOPICO, seguidores: ["OUTRA", "EU"] };
    expect(desfazerSeguirAoResponder(sigo, "EU", desligado)).toBe(false);
  });

  it("canal que não é tópico, ou sem sessão, não faz nada", () => {
    expect(desfazerSeguirAoResponder(undefined, "EU", desligado)).toBe(false);
    expect(desfazerSeguirAoResponder(TOPICO, undefined, desligado)).toBe(false);
  });
});
