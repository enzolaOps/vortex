import { useState, type FocusEvent, type ReactNode } from "react";

import css from "./SalasEmFaixa.module.css";

/**
 * A coluna de salas quando o palco ocupa a tela: uma faixa estreita que abre a
 * lista ao passar o mouse e também ao receber foco, por teclado.
 *
 * ⚠ **A coluna não é desmontada nem recriada: ela está sempre aqui, só fica
 * `inert` e transparente enquanto fechada.** Desmontar a lista a cada passada
 * de mouse perderia a rolagem, o foco e o estado de quem a usa; também
 * deixaria o teclado sem caminho até as salas. `inert` tira a lista fechada da
 * ordem de tabulação e do leitor de tela — sem isso ela seria lida duas vezes,
 * uma na faixa e outra na lista.
 *
 * A faixa continua focável com a lista aberta (a lista a cobre): sair do
 * conjunto — mouse e foco — fecha. Quem fecha é o ESTADO dos dois, e não só o
 * mouse: sair com o mouse enquanto o foco está dentro não pode deixar o foco
 * numa lista que ficou `inert`.
 */
export function SalasEmFaixa({ faixa, lista }: { faixa: ReactNode; lista: ReactNode }) {
  const [ponteiro, setPonteiro] = useState(false);
  const [foco, setFoco] = useState(false);
  const aberta = ponteiro || foco;

  function aoPerderFoco(e: FocusEvent<HTMLDivElement>) {
    if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false);
  }

  return (
    <div
      className={css.raiz}
      data-faixa-raiz=""
      data-aberta={aberta || undefined}
      onPointerEnter={() => {
        setPonteiro(true);
      }}
      onPointerLeave={() => {
        setPonteiro(false);
      }}
      onFocus={() => {
        setFoco(true);
      }}
      onBlur={aoPerderFoco}
    >
      <div className={css.faixa} data-testid="faixa-de-salas">
        {faixa}
      </div>
      <div className={css.lista} data-lista-de-salas="" data-testid="lista-de-salas" inert={!aberta || undefined}>
        {lista}
      </div>
    </div>
  );
}
