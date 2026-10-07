import "./tema/theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("#raiz ausente no index.html");
const alvo = createRoot(raiz);

if (import.meta.env.DEV && location.hash === "#galeria") {
  // Galeria do design system: só em dev. O Vite troca `import.meta.env.DEV` por
  // `false` no build e o import dinâmico morre junto, então ela não vai ao bundle.
  void import("./arnes/galeria").then(({ Galeria }) => {
    alvo.render(
      <StrictMode>
        <Galeria />
      </StrictMode>,
    );
  });
} else {
  alvo.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
