import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import "../../tema/theme.css";

/** Ajuda dos testes de navegador: monta, devolve o alvo e limpa. */
let raiz: Root | undefined;
let alvo: HTMLElement | undefined;

export function montar(ui: React.ReactNode): HTMLElement {
  alvo = document.createElement("div");
  document.body.append(alvo);
  raiz = createRoot(alvo);
  flushSync(() => raiz?.render(ui));
  return alvo;
}

export function desmontar() {
  raiz?.unmount();
  alvo?.remove();
  raiz = undefined;
  alvo = undefined;
}

export const pegar = <T extends HTMLElement = HTMLElement>(seletor: string) =>
  document.querySelector<T>(seletor);

/**
 * Anel de foco único: um contorno de 2px e nenhuma sombra de anel por cima
 * (o DS proíbe anel duplicado).
 */
export function umSoAnel(el: Element): boolean {
  const e = getComputedStyle(el);
  return e.outlineStyle === "solid" && e.outlineWidth === "2px" && e.boxShadow === "none";
}
