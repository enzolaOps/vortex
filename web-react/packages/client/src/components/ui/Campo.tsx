import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";

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
  acaoDoRotulo,
  prefixo,
  revelavel = false,
  id,
  type,
  ...resto
}: {
  rotulo: string;
  /** Explicação abaixo do campo. Some quando há erro — ver `descrito`. */
  dica?: ReactNode;
  /** A mensagem, quando o valor não serve. Assume o lugar da dica. */
  erro?: string;
  /**
   * Um alvo na OUTRA ponta da linha do rótulo — "Esqueci a senha".
   *
   * O design o põe ali e não abaixo do campo por um motivo prático: abaixo ele
   * disputaria o lugar da dica e do erro, que é onde o olho vai quando o login
   * falha.
   */
  acaoDoRotulo?: ReactNode;
  /**
   * Um sinal fixo ANTES do valor — o `@` do nome de usuário.
   *
   * Dentro da caixa e não como texto do rótulo: ele faz parte do que se lê da
   * esquerda para a direita ao conferir o que foi digitado, e fora da borda
   * pareceria legenda.
   */
  prefixo?: ReactNode;
  /**
   * Botão de olho, para campo de senha.
   *
   * ⚠ Ele troca o `type` entre `password` e `text`, e por isso o `type` passa
   * a ser controlado aqui. Sem revelar, uma senha digitada errado só é
   * descoberta depois de a tentativa falhar — e o design diz por extenso que o
   * caso comum é a maiúscula.
   */
  revelavel?: boolean;
} & InputHTMLAttributes<HTMLInputElement>) {
  /*
    `useId` e não o `label` envolvendo o `input`.

    Envolver funciona para o clique e é o que o login fazia. Não funciona para
    `aria-describedby`: a dica e o erro precisam de ID próprio para o leitor de
    tela lê-los DEPOIS do rótulo, e não como parte dele.
  */
  const [revelado, setRevelado] = useState(false);
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
      {acaoDoRotulo === undefined ? (
        <label className={css.rotulo} htmlFor={meu}>
          {rotulo}
        </label>
      ) : (
        <div className={css.linhaDoRotulo}>
          <label className={css.rotulo} htmlFor={meu}>
            {rotulo}
          </label>
          {acaoDoRotulo}
        </div>
      )}

      <div className={revelavel || prefixo !== undefined ? css.caixa : undefined}>
      {prefixo !== undefined ? (
        <span className={css.prefixo} aria-hidden>
          {prefixo}
        </span>
      ) : null}
      <input
        {...resto}
        type={revelavel && revelado ? "text" : type}
        id={meu}
        className={
          revelavel || prefixo !== undefined ? css.entradaNua : css.entrada
        }
        /*
          `aria-invalid` e não só a borda vermelha.

          Cor sozinha não comunica nada para quem não a distingue, e o piso
          deste projeto diz isso em `design-system.md`. A borda é o sinal para
          quem enxerga; este é o sinal para quem escuta.
        */
        aria-invalid={erro !== undefined || undefined}
        aria-describedby={descrito}
      />
      {revelavel ? (
        /*
          ⚠ O rótulo nomeia a AÇÃO e não o estado, ao contrário do
          `aria-pressed` do microfone. A diferença é que aqui não há estado
          pressionado a anunciar: o botão faz uma coisa e o texto diz qual.
        */
        <button
          type="button"
          className={css.olho}
          aria-label={revelado ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setRevelado((v) => !v)}
        >
          {revelado ? <EyeSlash size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      ) : null}
      </div>

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
