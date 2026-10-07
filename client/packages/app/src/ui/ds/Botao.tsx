import { cloneElement, type ButtonHTMLAttributes, type MouseEvent, type ReactElement, type ReactNode } from "react";

import { juntar } from "../juntar";
import type { TamanhoDeIcone } from "../icones";
import css from "./Botao.module.css";

type Base = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** primario = ação principal (uma por coluna). */
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  /** sm = 32px, md = 40px. */
  tamanho?: "sm" | "md";
  /** Ícone de `ui/icones.tsx` (já decorativo). Some enquanto `carregando`. */
  icone?: ReactElement<{ tamanho?: TamanhoDeIcone }>;
  /** Troca o ícone por um giro, bloqueia o clique e marca `aria-busy`. O rótulo fica. */
  carregando?: boolean;
};

/** Sem `children` o botão é só ícone, e então `aria-label` é obrigatório (tipo). */
export type BotaoProps = Base &
  ({ children: ReactNode } | { children?: undefined; "aria-label": string });

export function Botao({
  variante = "primario",
  tamanho = "md",
  icone,
  carregando = false,
  className,
  children,
  onClick,
  type = "button",
  ...resto
}: BotaoProps) {
  const soIcone = children === undefined || children === null || children === false;
  // 18px no botão de 40, 16px no de 32 (README do DS).
  const iconeFinal = icone && cloneElement(icone, { tamanho: tamanho === "sm" ? 16 : 18 });

  // `aria-disabled` e não `disabled`: o foco não pode escapar do botão no meio do envio.
  const bloquear = (e: MouseEvent<HTMLButtonElement>) => {
    if (carregando) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };

  return (
    <button
      {...resto}
      type={type}
      onClick={bloquear}
      aria-busy={carregando || undefined}
      aria-disabled={carregando || undefined}
      className={juntar(
        css.botao,
        css[variante],
        css[tamanho],
        soIcone && css.soIcone,
        carregando && css.carregando,
        className,
      )}
    >
      {carregando ? (
        <span className={css.giro} aria-hidden="true" />
      ) : (
        iconeFinal && <span className={css.icone}>{iconeFinal}</span>
      )}
      {soIcone ? null : children}
    </button>
  );
}
