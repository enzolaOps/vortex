import type { ReactNode } from "react";

import { Botao } from "./Botao";
import css from "./EstadoVazio.module.css";

/**
 * Estado vazio.
 *
 * O design system define há três fases o que ele tem que ser: *"convite para
 * agir: uma linha de texto e a ação primária. Sem ilustração genérica, sem
 * texto de consolo."* A auditoria dos oito estados encontrou cinco superfícies
 * com vazio — e as cinco eram um `<p>` solto com uma frase, nenhuma com ação.
 *
 * Por isso é primitivo e não cinco cópias: escrito uma vez, a próxima
 * superfície herda a decisão em vez de repetir a metade fácil dela.
 *
 * **A ação é OPCIONAL de propósito, e isso é honestidade e não frouxidão.**
 * Nem todo vazio tem o que oferecer hoje: "sem servidores" só vira convite
 * quando existir um fluxo de entrar em servidor, que é fase 6. Botão que não
 * leva a lugar nenhum é pior que ausência de botão — ensina que os botões
 * deste app não funcionam.
 */
export function EstadoVazio({
  icone,
  titulo,
  detalhe,
  acao,
  compacto = false,
}: {
  /** Phosphor, 20px, weight regular — como todo ícone do projeto. */
  icone?: ReactNode;
  titulo: string;
  /** Uma linha, no máximo. Se precisar de duas, o título está errado. */
  detalhe?: string;
  acao?: { rotulo: string; aoClicar: () => void };
  /** Painel lateral estreito: sem ícone, texto menor, sem centralizar. */
  compacto?: boolean;
}) {
  return (
    <div className={css.vazio} data-compacto={compacto}>
      {icone && !compacto ? (
        <span className={css.icone} aria-hidden>
          {icone}
        </span>
      ) : null}

      <p className={css.titulo}>{titulo}</p>
      {detalhe ? <p className={css.detalhe}>{detalhe}</p> : null}

      {acao ? (
        <Botao variante="primario" onClick={acao.aoClicar}>
          {acao.rotulo}
        </Botao>
      ) : null}
    </div>
  );
}
