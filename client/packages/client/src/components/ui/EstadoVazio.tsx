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
  preenche = false,
}: {
  /** Phosphor, 20px, weight regular — como todo ícone do projeto. */
  icone?: ReactNode;
  titulo: string;
  /** Uma linha, no máximo. Se precisar de duas, o título está errado. */
  detalhe?: string;
  acao?: { rotulo: string; aoClicar: () => void };
  /** Painel lateral estreito: sem ícone, texto menor, sem centralizar. */
  compacto?: boolean;
  /**
   * Ocupa a coluna inteira e centra no eixo de bloco.
   *
   * ⚠ **Só para o vazio que É a superfície, e não um pedaço dela.** O cartão
   * mede ~150px; solto numa coluna de mil ele fica grudado no topo, porque o
   * `align-items: center` do próprio cartão centra no eixo EM LINHA e nada
   * cuidava do outro. Foi assim que "Nenhum canal aberto" apareceu colado no
   * cabeçalho de uma coluna vazia de ponta a ponta.
   *
   * ⚠ **Não vale para todo vazio, e por isso é opção e não padrão.** O da
   * `MessageList` é alinhado ao RODAPÉ de propósito — a primeira mensagem
   * nasce rente ao composer, e o convite tem que apontar para onde a coisa
   * acontece. Os de painel lateral usam `compacto`, que alinha ao início pela
   * mesma família de razão. Centrar todos apagaria as três decisões.
   */
  preenche?: boolean;
}) {
  const cartao = (
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

  /*
    ⚠ **A moldura só existe quando pedida.** Envolver sempre acrescentaria um
    nó ao DOM dos outros dezoito consumidores para servir a um — e num deles
    (a lista de mensagens) o wrapper mudaria o alinhamento que ela escolheu de
    propósito.
  */
  return preenche ? <div className={css.moldura}>{cartao}</div> : cartao;
}
