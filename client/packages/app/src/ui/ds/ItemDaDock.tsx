import type { ButtonHTMLAttributes, ReactNode } from "react";

import { ds } from "../../textos";
import { juntar } from "../juntar";
import { Avatar } from "./Avatar";
import css from "./ItemDaDock.module.css";
import { Pilula } from "./Pilula";

export interface ItemDaDockProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Nome do servidor (ou do destino): é o nome acessível do botão. */
  nome: string;
  /** ID do servidor; escolhe o tom do avatar. */
  id?: string;
  /** Ícone no lugar do avatar (o botão de início). */
  icone?: ReactNode;
  /** O destino aberto. Um por dock. */
  selecionado?: boolean;
  naoLida?: boolean;
  mencoes?: number;
}

/**
 * Um destino da dock de servidores: avatar (ou ícone) de 44px, marcador de 3px
 * na borda quando selecionado e, no canto, o ponto de não lida ou o contador de
 * menções. O marcador tem forma, então a seleção não depende só de cor.
 */
export function ItemDaDock({
  nome,
  id,
  icone,
  selecionado = false,
  naoLida = false,
  mencoes = 0,
  className,
  type = "button",
  ...resto
}: ItemDaDockProps) {
  return (
    <button
      {...resto}
      type={type}
      aria-label={nome}
      aria-current={selecionado ? "true" : undefined}
      className={juntar(css.item, selecionado && css.selecionado, className)}
    >
      <span className={css.rosto} aria-hidden="true">
        {icone ?? <Avatar nome={nome} id={id} tamanho={44} />}
      </span>
      {mencoes > 0 ? (
        <Pilula tipo="mencao" valor={mencoes} className={css.selo} />
      ) : (
        naoLida && <Pilula tipo="naoLida" className={css.selo} />
      )}
      {mencoes > 0 && <span className={css.soLeitor}>{ds.mencoes(mencoes)}</span>}
    </button>
  );
}
