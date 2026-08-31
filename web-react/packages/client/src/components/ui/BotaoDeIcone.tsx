import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "../../lib/cn";
import css from "./BotaoDeIcone.module.css";

/** 26 régua · 28 barra e composer · 30 cabeçalho · 34 alvo isolado. */
export type TamanhoDeIcone = "xs" | "sm" | "md" | "lg";

export type TomDeIcone = "padrao" | "acento" | "perigo" | "sucesso";

/* `string | undefined` porque o tipo do CSS Module é um índice aberto e o
   projeto roda com `noUncheckedIndexedAccess` — o `cn` já ignora `undefined`. */
const TAMANHO: Record<TamanhoDeIcone, string | undefined> = {
  xs: css.xs,
  sm: css.sm,
  md: css.md,
  lg: css.lg,
};

const TOM: Record<TomDeIcone, string | undefined> = {
  padrao: css.padrao,
  acento: css.acento,
  perigo: css.perigo,
  sucesso: css.sucesso,
};

export type BotaoDeIconeProps = {
  /**
   * Obrigatório, e não opcional.
   *
   * O botão é só um glifo: sem isto ele não tem nome nenhum para quem usa
   * leitor de tela. Deixá-lo opcional é como as quinze cópias à mão nasceram —
   * algumas com `aria-label`, algumas sem, e nenhuma forma de saber quais.
   */
  rotulo: string;
  icone: ReactNode;
  tamanho?: TamanhoDeIcone;
  tom?: TomDeIcone;
  /**
   * Ligado/selecionado. Vira `aria-pressed`.
   *
   * ⚠ Quando você passar isto, o `rotulo` tem que nomear o RECURSO e não a
   * ação: "Microfone", não "Silenciar microfone". Um rótulo que alterna junto
   * do estado faz o leitor anunciar o inverso — regra que o lint do projeto já
   * pegou uma vez.
   */
  ativo?: boolean;
  /** Pílula em vez de quadrado. */
  redondo?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "aria-pressed">;

/**
 * Um alvo quadrado com um glifo dentro.
 *
 * ⚠ **Ele existia quinze vezes, à mão, em onze arquivos** — barra de ações da
 * mensagem, ferramentas do composer, ações do cabeçalho, rail dos seletores,
 * lightbox, reprodutor de voz, cartão de chamada, encaminhar, enquete, emojis
 * e configurações. Cada cópia com o próprio tamanho, o próprio hover e o
 * próprio anel de foco; três delas com o glifo em tamanho diferente do vizinho.
 *
 * É a mesma história do `Avatar`, que tinha seis cópias antes de virar peça: o
 * custo não é a duplicação, é que mudar o tratamento de foco vira quinze
 * edições que ninguém garante completas — e o `pnpm utilities` só acusa a
 * regra órfã DEPOIS que o último consumidor sai dela.
 */
export const BotaoDeIcone = forwardRef<HTMLButtonElement, BotaoDeIconeProps>(
  function BotaoDeIcone(
    {
      rotulo,
      icone,
      tamanho = "md",
      tom = "padrao",
      ativo,
      redondo = false,
      className,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={rotulo}
        aria-pressed={ativo}
        className={cn(
          css.botao,
          TAMANHO[tamanho],
          TOM[tom],
          redondo && css.redondo,
          className,
        )}
        {...props}
      >
        {icone}
      </button>
    );
  },
);
