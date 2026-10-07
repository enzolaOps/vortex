import type { ReactNode } from "react";

import { shell } from "../textos";
import { Botao, PainelVidro } from "../ui/ds";
import { Pessoas } from "../ui/icones";
import css from "./Regioes.module.css";

export type ModoVisivelDaGaveta = "lista" | "icones";

export interface GavetaDeMembrosProps {
  modo: ModoVisivelDaGaveta;
  aoMudarModo: (modo: ModoVisivelDaGaveta) => void;
  children?: ReactNode;
}

/**
 * Gaveta à direita com os membros online. Dois modos: lista (agrupada por cargo,
 * quando houver dado) e só ícones, que ainda divide por cargo.
 */
export function GavetaDeMembros({ modo, aoMudarModo, children }: GavetaDeMembrosProps) {
  const emIcones = modo === "icones";
  return (
    <PainelVidro como="aside" raio="xl" aria-label={shell.gaveta.rotulo} className={css.painel}>
      <div className={css.cabeca}>
        {!emIcones && <h2 className={css.titulo}>{shell.gaveta.titulo}</h2>}
        <Botao
          variante="fantasma"
          tamanho="sm"
          icone={<Pessoas />}
          aria-label={emIcones ? shell.gaveta.mostrarLista : shell.gaveta.mostrarIcones}
          aria-pressed={emIcones}
          onClick={() => {
            aoMudarModo(emIcones ? "lista" : "icones");
          }}
        />
      </div>
      <div className={css.corpo}>
        {children ?? (emIcones ? null : <p className={css.vazio}>{shell.gaveta.vazio}</p>)}
      </div>
    </PainelVidro>
  );
}
