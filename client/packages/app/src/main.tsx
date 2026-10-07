import "./tema/theme.css";

import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { arnesAtivo } from "./arnes/arnesAtivo";
import { aplicarTemaSalvo } from "./tema/personalizado";

// A paleta personalizada guardada vale antes da primeira pintura: sem isto o app piscaria no tema de fábrica.
aplicarTemaSalvo();

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("#raiz ausente no index.html");
const alvo = createRoot(raiz);

function montar(ui: ReactNode) {
  alvo.render(<StrictMode>{ui}</StrictMode>);
}

if (import.meta.env.DEV && location.hash === "#galeria") {
  // Galeria do design system: só em dev. O Vite troca `import.meta.env.DEV` por
  // `false` no build e o import dinâmico morre junto, então ela não vai ao bundle.
  void import("./arnes/galeria").then(({ Galeria }) => {
    montar(<Galeria />);
  });
} else if ((import.meta.env.DEV || import.meta.env.MODE === "gate") && arnesAtivo()) {
  // Arnês do gate (`/dev`). A condição fica INLINE e não numa constante importada: o Vite
  // só troca `import.meta.env.*` por literal no ponto de uso, e é a dobra do literal que faz
  // o import dinâmico (e o chunk do arnês) sumir do build de produção. Ver `arnesAtivo.ts`.
  // A rede falsa entra ANTES do chunk do arnês: o SDK dispara `fetch` ao ser avaliado.
  void import("./arnes/redeFalsa")
    .then(() => import("./arnes/Arnes"))
    .then(({ Arnes }) => {
      montar(<Arnes />);
    });
} else {
  montar(<App />);
}
