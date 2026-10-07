import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type RefObject,
} from "react";

interface Opcoes {
  /** Controlado: quando definido, o estado interno é ignorado. */
  controlado?: boolean;
  inicial?: boolean;
  aoMudar?: (aberto: boolean) => void;
  /** Para onde o foco volta quando Esc fecha (ex.: a pílula). */
  focoAoFechar?: RefObject<HTMLElement | null>;
}

const focoVisivelDentro = (raiz: Element) => {
  const ativo = document.activeElement;
  return ativo !== null && raiz.contains(ativo) && ativo.matches(":focus-visible");
};

/**
 * Expansão por ponteiro, foco do teclado e Esc, para os três widgets de voz.
 *
 *  - ponteiro (mouse ou caneta) abre ao entrar e fecha ao sair, salvo se o
 *    foco do TECLADO está dentro (clique de mouse deixa foco, mas não conta);
 *  - foco de teclado (`:focus-visible`) abre; sair do foco fecha, salvo se o
 *    ponteiro ainda está em cima;
 *  - Esc fecha de qualquer lugar da página (o ponteiro pode estar em cima e o
 *    foco em outro lugar) e, se pedido, devolve o foco sem reabrir.
 * Toque não tem hover: abre pelo clique do chamador e fecha ao perder o foco.
 */
export function useExpansao({ controlado, inicial = false, aoMudar, focoAoFechar }: Opcoes) {
  const [interno, setInterno] = useState(inicial);
  const sobre = useRef(false);
  const suprimirFoco = useRef(false);
  const aberto = controlado ?? interno;

  const definir = (valor: boolean) => {
    if (controlado === undefined) setInterno(valor);
    if (valor !== aberto) aoMudar?.(valor);
  };

  const fechar = useEffectEvent(() => {
    sobre.current = false;
    const alvo = focoAoFechar?.current;
    if (alvo && document.activeElement !== alvo) {
      suprimirFoco.current = true;
      alvo.focus();
    }
    definir(false);
  });

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  const props = {
    onPointerEnter(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === "touch") return;
      sobre.current = true;
      definir(true);
    },
    onPointerLeave(e: PointerEvent<HTMLElement>) {
      if (e.pointerType === "touch") return;
      sobre.current = false;
      if (!focoVisivelDentro(e.currentTarget)) definir(false);
    },
    onFocus(e: FocusEvent<HTMLElement>) {
      if (suprimirFoco.current) {
        suprimirFoco.current = false;
        return;
      }
      if (e.target.matches(":focus-visible")) definir(true);
    },
    onBlur(e: FocusEvent<HTMLElement>) {
      const proximo = e.relatedTarget;
      if (proximo instanceof Node && e.currentTarget.contains(proximo)) return;
      if (!sobre.current) definir(false);
    },
  };

  return { aberto, definir, props };
}
