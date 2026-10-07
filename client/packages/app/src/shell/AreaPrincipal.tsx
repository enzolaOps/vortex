import type { ReactNode } from "react";

import { shell } from "../textos";
import { PainelVidro } from "../ui/ds";
import css from "./Regioes.module.css";

/** O chat preenche toda a área principal; a medida de leitura é da lista, não daqui. */
export function AreaPrincipal({ children }: { children?: ReactNode }) {
  return (
    <PainelVidro
      como="main"
      variante="leitura"
      raio="xl"
      aria-label={shell.principal.rotulo}
      className={css.painel}
    >
      {children ?? <p className={css.vazio}>{shell.principal.vazio}</p>}
    </PainelVidro>
  );
}
