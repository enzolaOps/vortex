import { useRef, type PointerEvent } from "react";

import type { CantoVoz } from "./Controles";

/** Quanto o ponteiro precisa andar para contar como arrasto e não como clique torto. */
const LIMIAR_DE_ARRASTO = 4;

/** Quem tem ação própria não inicia arrasto: o clique é dele. */
const SELETOR_DE_CONTROLE = "button, a, input, select, textarea, [role='slider'], [role='switch']";

/**
 * O canto mais próximo do centro de `caixa`, dentro de `area`.
 *
 * Pura: o hook só mede e chama. Metade de cima/baixo e de início/fim da área —
 * o widget "cai" no quadrante onde foi solto, que é o que a mão espera.
 */
export function cantoMaisProximo(
  caixa: { left: number; top: number; width: number; height: number },
  area: { left: number; top: number; width: number; height: number },
): CantoVoz {
  const cx = caixa.left + caixa.width / 2 - area.left;
  const cy = caixa.top + caixa.height / 2 - area.top;
  const vertical = cy < area.height / 2 ? "t" : "b";
  const horizontal = cx < area.width / 2 ? "l" : "r";
  return `${vertical}${horizontal}` as CantoVoz;
}

/**
 * Arrastar o widget e soltá-lo preso ao canto mais próximo.
 *
 * ⚠ **A posição do arrasto vai direto ao DOM (`translate`), nunca ao store.**
 * Cada `pointermove` num estado compartilhado re-renderizaria o que assina o
 * canto; aqui só o `drop` escreve, uma vez, em `onCanto`. É a mesma regra do
 * arrasto de borda do modo de edição.
 *
 * ⚠ **`translate` e não `transform`**: o widget já usa `transform: scale()` ao
 * ampliar, e a propriedade individual compõe com ela em vez de substituí-la.
 *
 * Teclado: o arrasto é só de ponteiro, e por isso o widget MANTÉM os quatro
 * botões de canto (`CantosDeFixacao`) — a mesma ação, sem mouse.
 */
export function useArrastoParaCanto(onCanto: ((canto: CantoVoz) => void) | undefined) {
  const arrasto = useRef<{ id: number; x: number; y: number; moveu: boolean } | null>(null);

  if (!onCanto) return {};

  const encerrar = (e: PointerEvent<HTMLElement>, soltou: boolean) => {
    const atual = arrasto.current;
    if (!atual || atual.id !== e.pointerId) return;
    arrasto.current = null;
    const el = e.currentTarget;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      // Já solto (cancelamento, elemento removido).
    }
    const pai = el.offsetParent;
    const moveu = atual.moveu;
    // Mede ANTES de limpar o deslocamento: o retângulo solto é o que decide o canto.
    const caixa = el.getBoundingClientRect();
    el.style.translate = "";
    delete el.dataset.arrastando;
    if (soltou && moveu && pai) onCanto(cantoMaisProximo(caixa, pai.getBoundingClientRect()));
  };

  return {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      if (e.button !== 0 || e.defaultPrevented) return;
      if ((e.target as Element).closest(SELETOR_DE_CONTROLE)) return;
      arrasto.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moveu: false };
      try {
        // Sem captura o arrasto perde o ponteiro ao sair do widget; com ela, segue até soltar.
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ponteiro que o navegador não reconhece (evento sintético): o arrasto segue sem captura.
      }
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const atual = arrasto.current;
      if (!atual || atual.id !== e.pointerId) return;
      const dx = e.clientX - atual.x;
      const dy = e.clientY - atual.y;
      if (!atual.moveu && Math.hypot(dx, dy) < LIMIAR_DE_ARRASTO) return;
      atual.moveu = true;
      e.currentTarget.dataset.arrastando = "true";
      e.currentTarget.style.translate = `${String(dx)}px ${String(dy)}px`;
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      encerrar(e, true);
    },
    onPointerCancel(e: PointerEvent<HTMLElement>) {
      encerrar(e, false);
    },
  };
}
