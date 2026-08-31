import {
  CheckCircle,
  Info,
  WarningCircle,
  WarningOctagon,
} from "@phosphor-icons/react";
import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./Banner.module.css";

export type TomDeBanner = "aviso" | "perigo" | "sucesso" | "info";

const TOM: Record<TomDeBanner, string | undefined> = {
  aviso: css.aviso,
  perigo: css.perigo,
  sucesso: css.sucesso,
  info: css.info,
};

/*
  O glifo é decidido pelo TOM e não passado por quem chama.

  Deixá-lo livre produziria o mesmo aviso com três ícones diferentes em três
  telas — e o ícone é metade do que faz um banner ser reconhecido de relance.
*/
const ICONE: Record<TomDeBanner, typeof Info> = {
  aviso: WarningCircle,
  perigo: WarningOctagon,
  sucesso: CheckCircle,
  info: Info,
};

/**
 * Faixa de estado no fluxo.
 *
 * ⚠ Não confundir com `Toast`: toast é efêmero e flutua sobre tudo; o banner
 * fica no fluxo e dura enquanto a condição durar. Um erro de formulário que
 * some sozinho depois de cinco segundos é o defeito que o toast de erro já
 * teve uma vez.
 */
export function Banner({
  tom = "info",
  titulo,
  acoes,
  children,
  className,
  ...props
}: {
  tom?: TomDeBanner;
  /** Opcional: sem ele o banner é uma frase só, que é o caso mais comum. */
  titulo?: string;
  /**
   * O que resolve a condição — "Abrir ajustes", "Tentar de novo".
   *
   * ⚠ Irmã do corpo e não filha dele: uma ação empilhada embaixo do texto
   * empurra o resto da página e o banner deixa de ler como faixa. O design a
   * põe à direita, alinhada ao topo.
   */
  acoes?: ReactNode;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>) {
  const Glifo = ICONE[tom];

  return (
    <div className={cn(css.banner, TOM[tom], className)} {...props}>
      <Glifo weight="fill" className={css.icone} aria-hidden />
      <div className={css.corpo}>
        {titulo !== undefined ? (
          <strong className={css.titulo}>{titulo}</strong>
        ) : null}
        {children}
      </div>
      {acoes !== undefined ? <div className={css.acoes}>{acoes}</div> : null}
    </div>
  );
}
