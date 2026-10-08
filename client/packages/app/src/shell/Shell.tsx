import { useState, type ReactNode } from "react";

import { FundoVidro } from "../ui/ds";
import { SalasEmFaixa } from "./SalasEmFaixa";
import css from "./Shell.module.css";

export type ModoDaGaveta = "lista" | "icones" | "oculta";

export interface ShellProps {
  barraDeTitulo: ReactNode;
  dock: ReactNode;
  salas: ReactNode;
  principal: ReactNode;
  gaveta: ReactNode;
  modoDaGaveta?: ModoDaGaveta;
  /**
   * Com o palco em tela cheia, a coluna de salas vira uma faixa estreita (o
   * `faixaDeSalas`) que abre a coluna por cima ao passar o mouse ou receber foco.
   * A coluna segue montada.
   */
  salasEmFaixa?: boolean;
  faixaDeSalas?: ReactNode;
  /** O esqueleto de restauração é um Shell também; ele se identifica diferente para não passar pelo real. */
  testId?: string;
}

/**
 * O layout fixo do Vortex (TRD §2): fundo de vidro, barra de título, dock de
 * servidores, coluna de salas, área principal e gaveta de membros. Só declara
 * ONDE cada região fica; o que mora nelas é do consumidor. Nada aqui assina
 * store: o shell não re-renderiza com mensagem, presença ou digitação.
 */
export function Shell({
  barraDeTitulo,
  dock,
  salas,
  principal,
  gaveta,
  modoDaGaveta = "lista",
  salasEmFaixa = false,
  faixaDeSalas,
  testId = "shell",
}: ShellProps) {
  const emFaixa = salasEmFaixa && faixaDeSalas !== undefined;
  /*
    Entrar/sair do palco troca a trilha de salas (276 ↔ 56px) NUM quadro só — o layout
    final vale desde o primeiro frame, e a lista de mensagens/palco remedem uma vez, não
    por frame. O que anima é só opacity/transform, em cima de quem acabou de mudar:
    `data-anim` é a pista para o CSS, e só existe depois da primeira mudança (abrir o
    app não anima). Derivado na renderização (estado anterior), sem efeito.
  */
  const [anterior, setAnterior] = useState(emFaixa);
  const [anim, setAnim] = useState<"entrando" | "saindo" | undefined>();
  if (anterior !== emFaixa) {
    setAnterior(emFaixa);
    setAnim(emFaixa ? "entrando" : "saindo");
  }
  return (
    <FundoVidro data-testid={testId} className={css.raiz}>
      <div className={css.grade} data-testid="shell-grade" data-gaveta={modoDaGaveta} data-salas={emFaixa ? "faixa" : undefined}>
        <div className={css.barra}>{barraDeTitulo}</div>
        <div className={css.dock}>{dock}</div>
        <div className={css.salas} data-anim={anim}>
          {emFaixa ? <SalasEmFaixa faixa={faixaDeSalas} lista={salas} /> : salas}
        </div>
        <div className={css.principal} data-anim={anim}>{principal}</div>
        <div className={css.gaveta} data-colapsada={modoDaGaveta === "oculta" || undefined}>
          {gaveta}
        </div>
      </div>
    </FundoVidro>
  );
}
