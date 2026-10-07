import "./arnes/redeFalsa";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import "./tema/theme.css";
import { App } from "./App";

it("sem sessão guardada, monta a tela de entrada com os tokens do tema Vidro aplicados", async () => {
  localStorage.clear();
  sessionStorage.clear();
  const raiz = document.createElement("div");
  document.body.append(raiz);
  document.documentElement.dataset.tema = "vidro";
  createRoot(raiz).render(<App />);

  await expect.poll(() => raiz.querySelector('[data-testid="tela-de-entrada"]')).not.toBeNull();
  // O shell só existe depois do portão.
  expect(raiz.querySelector('[data-testid="shell"]')).toBeNull();

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--vx-accent");
  expect(accent.trim()).toBe("#a99bff");

  const fundo = getComputedStyle(raiz.querySelector('[data-testid="tela-de-entrada"]')!).backgroundColor;
  expect(fundo).toBe("rgb(10, 12, 20)");
});
