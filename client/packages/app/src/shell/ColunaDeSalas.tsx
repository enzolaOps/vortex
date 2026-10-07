import type { ReactNode } from "react";

import { salas, shell } from "../textos";
import { PainelVidro } from "../ui/ds";
import css from "./Regioes.module.css";

export interface ColunaDeSalasProps {
  /** O nome do servidor. Sem ele, o título genérico "Salas". */
  titulo?: string;
  /** Faixa de aviso sob o cabeçalho (conexão, por exemplo). */
  aviso?: ReactNode;
  children?: ReactNode;
  /** Fixo sob a rolagem das salas. */
  rodape?: ReactNode;
}

/** Coluna flutuante de salas e canais, com a contagem de cada sala no item. */
/** `rodape` é o que é da pessoa e não da navegação (hoje, sair da conta): fica fixo sob a rolagem das salas. */
export function ColunaDeSalas({ titulo = salas.titulo, aviso, children, rodape }: ColunaDeSalasProps) {
  return (
    <PainelVidro como="aside" raio="xl" aria-label={shell.salas.rotulo} className={css.painel}>
      <div className={css.cabeca}>
        <h2 className={css.titulo}>{titulo}</h2>
      </div>
      {aviso}
      <div className={css.corpo}>{children ?? <p className={css.vazio}>{shell.salas.vazio}</p>}</div>
      {rodape && <div className={css.rodape}>{rodape}</div>}
    </PainelVidro>
  );
}
