import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

import "./tema/theme.css";
import { App } from "./App";

it("monta o shell raiz com os tokens do tema Vidro aplicados", async () => {
  const raiz = document.createElement("div");
  document.body.append(raiz);
  document.documentElement.dataset.tema = "vidro";
  createRoot(raiz).render(<App />);

  await expect.poll(() => raiz.querySelector('[data-testid="shell"]')).not.toBeNull();

  const accent = getComputedStyle(document.documentElement).getPropertyValue("--vx-accent");
  expect(accent.trim()).toBe("#a99bff");

  const fundo = getComputedStyle(raiz.querySelector('[data-testid="shell"]')!).backgroundColor;
  expect(fundo).toBe("rgb(10, 12, 20)");
});
