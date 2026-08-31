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

/**
 * Os estados da lâmina, e por que ela deixou de ser um booleano.
 *
 * `atencao` é o canal não lido, e é ele que quebra o booleano. Com `ativa:
 * boolean`, "não lido" só podia ser `false` — e a regra de hover, que faz um
 * item em repouso CRESCER até a metade, encolheria a lâmina de um canal não
 * lido no instante em que o ponteiro passasse por cima. Um estado a mais
 * escondido dentro de um booleano é um estado que a interface contradiz.
 *
 * A escala é uma só, e a leitura acompanha:
 *
 * | estado    | altura | cor     | significa            |
 * |-----------|--------|---------|----------------------|
 * | `repouso` | toco   | neutra  | o indicador mora aqui|
 * | `atencao` | cheia  | texto   | tem algo aqui        |
 * | `ativa`   | cheia  | acento  | você está aqui       |
 *
 * O acento fica reservado para posição — atual ou pretendida no hover. Não
 * lido é informação, não destino, e por isso é a cor de TEXTO em altura cheia:
 * encontrável varrendo a coluna, sem disputar com "onde eu estou".
 */
export type EstadoDaLamina = "repouso" | "atencao" | "ativa";

export function Lamina({
  estado,
  className,
}: {
  estado: EstadoDaLamina;
  className?: string;
}) {
  return (
    <span aria-hidden className={cn(css.lamina, className)} data-estado={estado} />
  );
}
