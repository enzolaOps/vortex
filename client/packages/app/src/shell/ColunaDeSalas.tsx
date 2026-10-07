import type { ReactNode } from "react";

import { salas, shell } from "../textos";
import { PainelVidro } from "../ui/ds";
import css from "./Regioes.module.css";

/** Coluna flutuante de salas e canais, com a contagem de cada sala no item. */
/** `rodape` é o que é da pessoa e não da navegação (hoje, sair da conta): fica fixo sob a rolagem das salas. */
export function ColunaDeSalas({ children, rodape }: { children?: ReactNode; rodape?: ReactNode }) {
  return (
    <PainelVidro como="aside" raio="xl" aria-label={shell.salas.rotulo} className={css.painel}>
      <div className={css.cabeca}>
        <h2 className={css.titulo}>{salas.titulo}</h2>
      </div>
      <div className={css.corpo}>{children ?? <p className={css.vazio}>{shell.salas.vazio}</p>}</div>
      {rodape && <div className={css.rodape}>{rodape}</div>}
    </PainelVidro>
  );
}
