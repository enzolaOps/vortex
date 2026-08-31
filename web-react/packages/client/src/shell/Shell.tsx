import { useRef, useSyncExternalStore, type ReactNode } from "react";

import { AlcaDeSlot } from "../layout/AlcaDeSlot";
import { NOME_DO_PAINEL, type PainelId, type SlotId } from "../preset/schema";
import { LimiteDeErro } from "../components/ui/LimiteDeErro";
import { assinarEdicao, lerEdicao } from "../store/edicao";
import { assinarLayout, lerLayout } from "../store/layout";
import css from "./Shell.module.css";

/**
 * Ordem das colunas no grid. Estática, e a âncora fica no meio.
 *
 * A âncora — coluna de mensagem + composer — não é um slot e não aparece aqui.
 * Não ser representável é o que garante que ela nunca vai mudar de lado, o que
 * é o que protege a virtualização.
 */
const ANTES: readonly SlotId[] = ["a", "b"];
const DEPOIS: readonly SlotId[] = ["d"];

export type Paineis = Readonly<Record<PainelId, ReactNode>>;

function Slot({
  id,
  lado,
  paineis,
}: {
  id: SlotId;
  lado: "inicio" | "fim";
  paineis: Paineis;
}) {
  const layout = useSyncExternalStore(assinarLayout, lerLayout);
  const editando = useSyncExternalStore(assinarEdicao, lerEdicao);
  const slot = layout.layout.slots[id];
  const ocupado = slot.painel !== null && slot.visivel;
  const elemento = useRef<HTMLDivElement>(null);

  /**
   * Escreve a largura direto no DOM, pulando o React de propósito.
   *
   * Vive AQUI, e não na alça, porque quem é dono do elemento é este
   * componente — a alça recebe a função, não a ref. Mutar ref recebida por
   * prop é o que o React Compiler reprova, com razão.
   */
  function aplicarLargura(px: number) {
    if (elemento.current) elemento.current.style.inlineSize = `${px}px`;
  }

  return (
    <div
      ref={elemento}
      className={`${css.coluna} ${css.slot}`}
      data-slot={id}
      data-painel={ocupado ? slot.painel : "vazio"}
      data-lado={lado}
      /**
       * A largura vive no elemento, não na lista de trilhas do grid.
       *
       * Custom property inline, e isso NÃO é arbitrary value: o valor vem do
       * store, é dado do usuário, e é exatamente o que a fase 4 existe para
       * deixar ele escolher. O que a lei nº 4 proíbe é número mágico escrito
       * por quem programa.
       *
       * `inline-size` e não `width`: o slot precisa funcionar nos dois lados.
       */
      style={{ inlineSize: ocupado ? `${slot.largura}px` : 0 }}
    >
      {/*
        Cada painel dentro do próprio limite de erro.

        Não é defensividade genérica: é a lei nº 6 sendo verdadeira em vez de
        aspiracional. O shell é feito de slots, e a promessa da fase 4 é que
        cada painel é peça independente. Um painel que lança e leva os outros
        quatro junto desmente isso — a independência era só de posição.

        A chave é o painel: trocar qual painel ocupa o slot remonta o limite, e
        um limite que herda o erro do painel anterior mostraria falha de algo
        que nem está mais ali.
      */}
      {slot.painel !== null && slot.visivel ? (
        <LimiteDeErro key={slot.painel} oQue={`O painel de ${NOME_DO_PAINEL[slot.painel]}`}>
          {paineis[slot.painel]}
        </LimiteDeErro>
      ) : null}

      {/* A alça só existe no modo edição. Fora dele o slot não tem nada
          sobreposto na borda, e a borda volta a ser só uma linha. */}
      {editando && ocupado && slot.painel ? (
        <AlcaDeSlot
          id={id}
          painel={slot.painel}
          largura={slot.largura}
          lado={lado}
          aplicar={aplicarLargura}
        />
      ) : null}
    </div>
  );
}

/**
 * O shell de quatro colunas.
 *
 * Existe desde a fase 1, porque retrofitar layout raiz é reescrever tela — a
 * mesma razão pela qual a virtualização veio antes de tudo na fase 0.
 *
 * Na fase 4 ele parou de saber o que vai em cada coluna. Recebe um mapa de
 * painéis por TIPO e pergunta ao store qual slot ocupa qual posição, com que
 * largura, visível ou não. Trocar dois painéis de lado deixou de ser uma
 * mudança de código.
 *
 * Cada `Slot` assina o store por conta própria em vez de o shell assinar e
 * repassar: é a lei nº 1 na granularidade certa. Arrastar a borda de um slot
 * acorda aquele slot, não os quatro — e não acorda a âncora, que é onde a
 * lista de mensagens mora.
 */
export function Shell({
  paineis,
  ferramentas,
  cabecalho,
  conteudo,
  composer,
  sobreposto,
}: {
  paineis: Paineis;
  /** A barra do arnês. `undefined` no cliente de produto. */
  ferramentas?: ReactNode;
  /**
   * O cabeçalho do canal.
   *
   * Linha PRÓPRIA do grid, largura cheia, e não dentro da prancha — é o que o
   * design pede e é o que ele precisa: as ações dele (fixados, membros, busca)
   * ancoram na borda da coluna, não na borda da coluna de leitura. Um
   * cabeçalho centrado em 1040 deixaria os ícones flutuando no meio da tela
   * numa janela ultrawide.
   */
  cabecalho?: ReactNode;
  conteudo: ReactNode;
  composer?: ReactNode;
  /** Camada acima do grid — modo edição, e mais nada no fluxo. */
  sobreposto?: ReactNode;
}) {
  return (
    <div className={css.shell}>
      {ANTES.map((id) => (
        <Slot key={id} id={id} lado="inicio" paineis={paineis} />
      ))}

      <main className={`${css.coluna} ${css.conteudo}`}>
        {ferramentas}
        {cabecalho}
        {/*
          A PRANCHA: a moldura que resolve o ultrawide.

          Ela ocupa a trilha inteira e pinta o fundo de gutter; dentro dela, a
          coluna de leitura trava em `--vx-timeline-max-w` e CENTRA. É a
          correção da fase 1, que travava a coluna sem centrá-la e produzia
          908px de vazio só do lado direito — que lê como alinhamento
          quebrado, não como coluna de leitura.

          Lista e composer moram os dois aqui dentro, e é o que mantém a
          invariante do briefing literal: "composer alinhado à coluna de
          mensagem". Eles compartilham a mesma caixa, então não há como um
          divergir do outro.
        */}
        <div className={css.prancha}>
          <div className={css.pranchaInterna}>
            {/* minmax(0,1fr) na linha: sem isto o conteúdo empurra e o grid
                estoura. */}
            <div className={css.celulaDeConteudo}>{conteudo}</div>
            {/* Linha `auto`: o composer cresce e a lista encolhe, nunca o
                contrário. Sem a linha própria, um campo de dez linhas
                empurraria a lista para fora do grid em vez de tomar espaço
                dela. */}
            {composer}
          </div>
        </div>
      </main>

      {DEPOIS.map((id) => (
        <Slot key={id} id={id} lado="fim" paineis={paineis} />
      ))}

      {sobreposto}
    </div>
  );
}
