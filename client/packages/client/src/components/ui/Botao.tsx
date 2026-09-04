import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn } from "../../lib/cn";
import { Girador } from "./Girador";
import css from "./Botao.module.css";

/**
 * Botão.
 *
 * Existe porque a fase 4 escreveu a mesma pilha de classes em seis lugares e
 * cada cópia entregou um conjunto diferente de estados — uma tinha `:hover`,
 * nenhuma tinha `:focus-visible`, e `:disabled` só existia como atributo sem
 * aparência correspondente.
 *
 * A referência chama os oito estados de "o que separa protótipo de produto".
 * Centralizá-los num componente é a diferença entre lembrar deles e não
 * conseguir esquecê-los.
 */
export type VarianteDeBotao =
  | "primario"
  | "neutro"
  | "sutil"
  | "perigo"
  | "perigoSutil"
  | "avisoSutil";

export function Botao({
  variante = "neutro",
  tamanho = "medio",
  icone,
  carregando = false,
  rotuloCarregando,
  children,
  className,
  disabled,
  ...props
}: {
  variante?: VarianteDeBotao;
  /** 28 dentro de lista · 34 no caso comum · 40 em ação de modal. */
  tamanho?: "pequeno" | "medio" | "grande";
  icone?: ReactNode;
  /**
   * Em curso.
   *
   * Ele DESABILITA junto, e não é conveniência: um botão que ainda parece
   * clicável durante o envio recebe o segundo clique, que é como se manda a
   * mesma mensagem duas vezes. `aria-busy` conta a quem não vê o anel.
   */
  carregando?: boolean;
  /**
   * Substitui o rótulo enquanto carrega — "Salvando" no lugar de "Salvar".
   *
   * Sem ele o texto original fica, o que é o certo para botão curto: trocar
   * "Entrar" por "Entrando" muda a largura e o botão pula debaixo do ponteiro.
   */
  rotuloCarregando?: string;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const inerte = disabled === true || carregando;

  return (
    <button
      type="button"
      disabled={inerte}
      aria-busy={carregando || undefined}
      className={cn(
        css.botao,
        css[variante],
        tamanho !== "medio" && css[tamanho],
        carregando && css.carregando,
        className,
      )}
      {...props}
    >
      {/*
        O anel OCUPA o lugar do ícone em vez de somar a ele: com os dois, a
        largura do botão muda ao entrar em carregamento, e um botão que cresce
        no clique escapa do ponteiro.

        `rotulo=""` porque o texto ao lado já diz o que está acontecendo —
        `role="status"` aqui faria o leitor anunciar "Salvando, Carregando".
      */}
      {carregando ? <Girador tamanho={12} rotulo="" /> : icone}
      {carregando && rotuloCarregando ? rotuloCarregando : children}
    </button>
  );
}
