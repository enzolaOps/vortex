import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { TooltipProvider } from "./components/ui/Tooltip";
import "./styles/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root ausente no index.html");

createRoot(root).render(
  <StrictMode>
    {/* Um Provider na raiz: ele coordena o atraso compartilhado entre
        tooltips. Um por tooltip devolveria o atraso cheio a cada ícone. */}
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      <App />
    </TooltipProvider>
  </StrictMode>,
);
