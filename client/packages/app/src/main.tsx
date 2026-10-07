import "./tema/theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("#raiz ausente no index.html");

createRoot(raiz).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
