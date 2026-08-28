import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ligarRota } from "./rota/rota";
import { iniciarPintura } from "./tema/pintor";
import { App } from "./App";
import { PortaoDeSessao } from "./sessao/PortaoDeSessao";
import { Toaster } from "./components/ui/Toast";
import { FaixaDeConexao } from "./conexao/FaixaDeConexao";
import { TooltipProvider } from "./components/ui/Tooltip";
import "./styles/tokens.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root ausente no index.html");

iniciarPintura();

/*
  A rota, antes do primeiro render.

  Aplicar depois faria o app abrir na casa e SALTAR para o lugar da URL um
  quadro adiante — visível em toda abertura de link, e pior numa lista
  virtualizada, que montaria duas vezes.

  Module-level e não `useEffect`: `history` e `popstate` não pertencem a árvore
  de componente nenhuma. Mesmo padrão de `ligarAtalhoDaPaleta`.
*/
ligarRota();

createRoot(root).render(
  <StrictMode>
    {/* Um Provider na raiz: ele coordena o atraso compartilhado entre
        tooltips. Um por tooltip devolveria o atraso cheio a cada ícone. */}
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      {/* Sem sessão não há canal, autor nem permissão: o portão vem antes
          do shell. Ver `PortaoDeSessao`. */}
      <PortaoDeSessao>
        <App />
      </PortaoDeSessao>
      {/* Montado uma vez na raiz: a viewport e a regiao aria-live que o
          leitor de tela anuncia. Os toasts vem do store, nao de props. */}
      <Toaster />
      {/* Como o Toaster: superfície global, montada uma vez, alimentada por
          store. Flutua — faixa no fluxo mudaria a altura do container da
          lista virtualizada. */}
      <FaixaDeConexao />
    </TooltipProvider>
  </StrictMode>,
);
