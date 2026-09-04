import type { ReactNode } from "react";

import { cn } from "../lib/cn";
import css from "./Pagina.module.css";

/**
 * As quatro peças de uma página de PREFERÊNCIAS.
 *
 * ⚠ **Extraídas na terceira cópia**, que é a régua deste projeto. Notificações
 * escreveu cartão, linha e sobrancelha-com-régua; Privacidade e Voz e vídeo
 * precisavam das três idênticas. O custo de não extrair não é o CSS repetido —
 * é que a cópia que alguém mexer deixa de concordar com as outras, e ninguém
 * descobre até abrir a que ficou para trás.
 *
 * Não confundir com `Secao.module.css`: aquele é o FORMULÁRIO estreito das
 * telas de servidor e canal (campo, bloco, régua). Este é a página de
 * preferência — cartão de linhas com controle à direita.
 */
export function PaginaDeAjustes({
  cheia = false,
  children,
}: {
  /**
   * Sem o teto de 840.
   *
   * ⚠ Atalhos de teclado é a única hoje, e a razão está no CSS: ela é uma
   * grade que se reflui sozinha, e o teto deixaria duas colunas onde cabem
   * três.
   */
  cheia?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(css.pagina, cheia && css.cheia)}>{children}</div>
  );
}

export function CabecalhoDeSecao({ titulo }: { titulo: string }) {
  return (
    <div className={css.cabecalhoDeSecao}>
      {/*
        `h2` porque o `h1` é o título da página, que o shell renderiza. A régua
        é decorativa e sai da árvore de acessibilidade.
      */}
      <h2 className={css.tituloDeSecao}>{titulo}</h2>
      <span aria-hidden className={css.reguaDaSecao} />
    </div>
  );
}

/** O cartão de linhas divididas. */
export function GrupoDeAjustes({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(css.grupo, className)}>{children}</div>;
}

/** Um cartão de bloco único, sem divisórias internas. */
export function CartaoDeAjustes({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn(css.cartao, className)}>{children}</div>;
}

export function LinhaDeAjuste({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  /** Opcional: nem toda linha precisa explicar o que faz. */
  detalhe?: string;
  /** O controle, à direita. */
  children: ReactNode;
}) {
  return (
    <div className={css.linha}>
      <div className={css.texto}>
        <div className={css.titulo}>{titulo}</div>
        {detalhe !== undefined ? (
          <p className={css.detalhe}>{detalhe}</p>
        ) : null}
      </div>
      <div className={css.controle}>{children}</div>
    </div>
  );
}

/** As classes que as páginas usam direto, sem componente em volta. */
export const classes = {
  faixa: css.faixa,
  recado: css.recado,
  texto: css.texto,
  titulo: css.titulo,
  detalhe: css.detalhe,
};
