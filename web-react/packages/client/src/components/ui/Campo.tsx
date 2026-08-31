import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import css from "./Campo.module.css";

/**
 * Um campo de texto com rótulo.
 *
 * Existe porque as 42 páginas de configuração do plano de paridade precisam de
 * um, e porque sem ele cada tela inventa o seu — que é como o app chegou aqui
 * com dois campos de texto e nenhum componente.
 *
 * ⚠ **A paleta de comandos NÃO usa isto, e a diferença é de projeto, não
 * descuido.** O campo dela é uma barra de busca: sem borda, fundo
 * transparente, uma régua embaixo e corpo maior. Unificar os dois faria a
 * paleta parecer um formulário no meio de um painel flutuante. Duas coisas que
 * se parecem não são a mesma coisa.
 *
 * **Nenhum token novo.** O plano previa uma família `--vx-field-*`; medindo o
 * que o campo do login já usava, ela não precisa existir — `--vx-surface-0`,
 * `--vx-border-subtle`, `--vx-accent` e `--vx-danger` cobrem os cinco estados.
 * Token novo exigiria par de contraste novo, e inventar dívida de garantia
 * para um valor que já existe é o oposto do que a fase 4 estabeleceu.
 */
export function Campo({
  rotulo,
  dica,
  erro,
  id,
  ...resto
}: {
  rotulo: string;
  /** Explicação abaixo do campo. Some quando há erro — ver `descrito`. */
  dica?: ReactNode;
  /** A mensagem, quando o valor não serve. Assume o lugar da dica. */
  erro?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  /*
    `useId` e não o `label` envolvendo o `input`.

    Envolver funciona para o clique e é o que o login fazia. Não funciona para
    `aria-describedby`: a dica e o erro precisam de ID próprio para o leitor de
    tela lê-los DEPOIS do rótulo, e não como parte dele.
  */
  const gerado = useId();
  const meu = id ?? gerado;
  const idDaDica = `${meu}-dica`;
  const idDoErro = `${meu}-erro`;

  /*
    Um descritor por vez, e o erro ganha.

    Encadear os dois faria o leitor anunciar a explicação de como preencher
    logo depois de dizer que o preenchimento está errado — que é a ordem
    inversa da útil.
  */
  const descrito = erro !== undefined ? idDoErro : dica !== undefined ? idDaDica : undefined;

  return (
    <div className={css.campo}>
      <label className={css.rotulo} htmlFor={meu}>
        {rotulo}
      </label>

      <input
        {...resto}
        id={meu}
        className={css.entrada}
        /*
          `aria-invalid` e não só a borda vermelha.

          Cor sozinha não comunica nada para quem não a distingue, e o piso
          deste projeto diz isso em `design-system.md`. A borda é o sinal para
          quem enxerga; este é o sinal para quem escuta.
        */
        aria-invalid={erro !== undefined || undefined}
        aria-describedby={descrito}
      />

      {erro !== undefined ? (
        /*
          `role="alert"` só no erro, e sem ele na dica.

          O erro é resposta a algo que a pessoa ACABOU de fazer, e interromper
          o leitor é o comportamento certo. A dica é contexto, e interromper
          por causa dela seria ruído em toda abertura de tela.
        */
        <p className={css.erro} id={idDoErro} role="alert">
          {erro}
        </p>
      ) : dica !== undefined ? (
        <p className={css.dica} id={idDaDica}>
          {dica}
        </p>
      ) : null}
    </div>
  );
}
