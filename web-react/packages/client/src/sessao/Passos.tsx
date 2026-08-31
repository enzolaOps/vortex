import css from "./TelaDeLogin.module.css";

/**
 * O indicador de passo do design — `1 · Email  2 · Código  3 · Nova senha`.
 *
 * ⚠ **O rótulo do passo 2 mudou, e a razão é o protocolo.** O design escreve
 * "Código" e desenha seis quadradinhos para seis dígitos. O Stoat não tem
 * código: `DataPasswordReset` exige um `token` opaco, que chega por LINK de
 * e-mail. Seis caixas sem nada para digitar seriam a tela mais convincente
 * possível de um caminho que não existe.
 *
 * A FORMA do design fica — três passos, com o atual em destaque e os
 * concluídos marcados — porque ela é o que diz "isto tem começo e fim, você
 * está no meio". Só o segundo nome corresponde ao que de fato acontece.
 *
 * ⚠ `aria-hidden` e não `role="list"`: cada tela já anuncia onde está no
 * próprio título, e uma lista de três itens repetiria a informação antes do
 * conteúdo em toda navegação.
 */
export function Passos({
  atual,
  nomes,
}: {
  /** 1-based, como o design numera. */
  atual: number;
  readonly nomes: readonly string[];
}) {
  return (
    <div className={css.passos} aria-hidden>
      {nomes.map((nome, i) => (
        <span
          key={nome}
          className={css.passo}
          data-estado={
            i + 1 === atual ? "atual" : i + 1 < atual ? "feito" : "adiante"
          }
        >
          <span className={css.numeroDoPasso}>{i + 1}</span>
          {nome}
        </span>
      ))}
    </div>
  );
}

/** Os três desta jornada, num lugar só — as duas telas precisam concordar. */
export const PASSOS_DA_SENHA = ["E-mail", "Link", "Nova senha"] as const;
