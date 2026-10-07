import type { ReactNode } from "react";

import { shell } from "../textos";
import { PainelVidro } from "../ui/ds";
import css from "./Regioes.module.css";

/**
 * O chat preenche toda a área principal; a medida de leitura é da lista, não daqui.
 * A camada é o que flutua sobre ela (o widget da sala) e não conta como conteúdo.
 */
export function AreaPrincipal({ children, camada }: { children?: ReactNode; camada?: ReactNode }) {
  return (
    <PainelVidro
      como="main"
      variante="leitura"
      raio="xl"
      aria-label={shell.principal.rotulo}
      className={css.painel}
    >
      {children ?? <p className={css.vazio}>{shell.principal.vazio}</p>}
      {camada}
    </PainelVidro>
  );
}
