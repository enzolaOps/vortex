import { cn } from "../../lib/cn";
import css from "./Lamina.module.css";

/**
 * A lâmina — o elemento de assinatura do Vortex.
 *
 * A marca são três pás espiralando para dentro, cada uma afinando da borda até
 * a ponta, com opacidade escalonada. Este componente é o que sobra dessa curva
 * em escala de interface: um traço que afina, marcando onde está o foco.
 *
 * Por que ISTO e não um gradiente ou um brilho: a referência de design é
 * explícita que personalidade num app denso vem de tipografia, densidade e um
 * elemento de assinatura — não de gradiente e blur. E a marca já resolveu o
 * problema da profundidade sem sombra, com opacidade escalonada; a interface
 * herda a solução em vez de inventar outra.
 *
 * Custo: um `clip-path` estático numa peça de 3×20px, pintada uma vez por item
 * ativo — há um por painel, não um por linha. É o oposto do ponto de presença,
 * que aparece 50 vezes na tela e por isso não pode ter máscara.
 */
export function Lamina({
  ativa,
  className,
}: {
  /** Fora do estado ativo ela existe, com altura zero — a transição é o gesto. */
  ativa: boolean;
  className?: string;
}) {
  return <span aria-hidden className={cn(css.lamina, className)} data-ativa={ativa} />;
}
