import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* `window` só neste arquivo — ver a razão em `menus/menus.test.tsx`. */
(globalThis as { window?: unknown }).window ??= document.defaultView;

/**
 * O banner de não perturbe (D-NOTIF-02).
 *
 * O que se guarda é que o "Desativar" escreve a presença pelo MESMO caminho do
 * menu do rodapé — e não um segundo estado desta tela —, e que o banner só
 * existe enquanto o DND vale.
 */

const { definirPresenca } = vi.hoisted(() => ({
  definirPresenca: vi.fn(() => Promise.resolve(true)),
}));
vi.mock("../sdk/perfil", () => ({ definirPresenca }));

/* Objeto TROCADO pelo teste e devolvido sempre o mesmo: `getSnapshot` que
   aloca a cada leitura é o erro nº 1 do briefing, inclusive num dublê. */
let status = { presenca: "dnd" };
vi.mock("../store/meuStatus", () => ({
  assinarMeuStatus: () => () => undefined,
  lerMeuStatus: () => status,
}));

vi.mock("../notificacao/push", () => ({
  assinarPush: () => () => undefined,
  lerPush: () => "desligado",
  ligarPush: () => undefined,
  desligarPush: () => undefined,
}));

import { Notificacoes } from "./Notificacoes";

let alvo: HTMLDivElement;
let raiz: Root;

beforeEach(() => {
  definirPresenca.mockClear();
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
});

afterEach(() => {
  act(() => raiz.unmount());
  alvo.remove();
});

function desenhar(): void {
  act(() => raiz.render(<Notificacoes />));
}

function botaoDesativar(): HTMLButtonElement | undefined {
  return [...alvo.querySelectorAll("button")].find(
    (b) => b.textContent === "Desativar",
  );
}

describe("banner de não perturbe", () => {
  it("com DND: o banner tem Desativar, que volta a presença para online", () => {
    status = { presenca: "dnd" };
    desenhar();
    expect(alvo.textContent).toContain("Não perturbe está ativo");
    const botao = botaoDesativar();
    expect(botao).toBeDefined();
    act(() => botao?.click());
    expect(definirPresenca).toHaveBeenCalledExactlyOnceWith("online");
  });

  it("sem DND: nem banner nem botão", () => {
    status = { presenca: "online" };
    desenhar();
    expect(alvo.textContent).not.toContain("Não perturbe está ativo");
    expect(botaoDesativar()).toBeUndefined();
  });
});
