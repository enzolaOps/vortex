import type { ReactNode } from "react";

import { shell } from "../textos";
import { PainelVidro } from "../ui/ds";
import { juntar } from "../ui/juntar";
import css from "./Regioes.module.css";

/** Dock flutuante de servidores. Sem servidor, o vazio fica só para leitor de tela: a dock é estreita. */
export function DockDeServidores({ children }: { children?: ReactNode }) {
  return (
    <PainelVidro
      como="nav"
      raio="xl"
      aria-label={shell.dock.rotulo}
      className={juntar(css.painel, css.dock)}
    >
      {children ?? <span className={css.soLeitor}>{shell.dock.vazio}</span>}
    </PainelVidro>
  );
}
