import type { ReactNode } from "react";

import { cn } from "../../lib/cn";
import { MarcaDeOpcao } from "./Marcador";
import css from "./CartaoDeOpcao.module.css";

/**
 * Escolha única em que o alvo é o CARTÃO inteiro.
 *
 * ⚠ **`MarcaDeOpcao` e não `Opcao`.** Aquele é um `<button>`, e botão dentro
 * de botão é HTML inválido — o navegador reestrutura a árvore e o clique
 * interno aciona os dois. O erro já aconteceu de verdade nas ações da linha de
 * canal, e é por isso que a marca sozinha existe.
 *
 * ⚠ **Quem usa precisa envolver num `role="radiogroup"` com rótulo.** Sem ele
 * o leitor de tela anuncia botões de rádio soltos, sem dizer de que escolha
 * fazem parte — e a contagem ("2 de 5") também some.
 *
 * O alvo é o cartão porque o ponto tem 16px: abaixo do mínimo confortável de
 * ponteiro, e num cartão com título e explicação o que a pessoa mira é o
 * texto.
 */
export function CartaoDeOpcao({
  marcado,
  titulo,
  detalhe,
  selo,
  forte = false,
  disabled,
  className,
  aoEscolher,
}: {
  marcado: boolean;
  titulo: string;
  /** Opcional: há cartão cujo título já diz tudo. */
  detalhe?: string;
  /** O selo ao lado do título — "RESTRITIVO", "RECOMENDADO". */
  selo?: ReactNode;
  /**
   * Título um degrau maior (14 em vez de 13).
   *
   * O design usa o maior quando o grupo de cartões é a decisão de ABERTURA da
   * página, e o menor quando é uma seção entre outras.
   */
  forte?: boolean;
  disabled?: boolean;
  className?: string;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      disabled={disabled}
      className={cn(css.cartao, forte && css.forte, className)}
      onClick={aoEscolher}
    >
      <MarcaDeOpcao />
      <span className={css.textos}>
        <span className={css.titulo}>
          {titulo}
          {selo}
        </span>
        {detalhe !== undefined ? (
          <span className={css.detalhe}>{detalhe}</span>
        ) : null}
      </span>
    </button>
  );
}
