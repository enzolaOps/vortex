import { createRoot } from "react-dom/client";

import { Overlay } from "./Overlay";
import "../styles/tokens.css";

/**
 * A janela do overlay do jogo — o único ramo que `main.tsx` monta em `/overlay`.
 *
 * ⚠ **Só tokens, fontes e componentes atravessam para cá.** Nada de sessão,
 * rota, socket, sons nem atalhos: tudo o que o overlay desenha chega pela casca
 * (`window.vortexOverlay`). O grafo deste módulo NÃO pode alcançar `sdk/adapter`
 * — ele faz `new Client()`, e o construtor já busca a configuração na API.
 */
export function montarOverlay(root: HTMLElement): void {
  document.documentElement.dataset.theme = "dark";
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  createRoot(root).render(<Overlay />);
}
