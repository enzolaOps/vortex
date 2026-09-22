/**
 * O que a coluna de canais pendura DENTRO de si sem ser linha de canal: o
 * tópico seguido sob o canal pai e a soma da categoria recolhida.
 *
 * Arquivo próprio e não dentro de `ListaDeCanais.tsx`, e a razão é de
 * convivência: aquele arquivo passa de mil e quinhentas linhas e é tocado por
 * mais de uma frente ao mesmo tempo. As duas peças daqui só dependem de IDs e
 * de hooks do store, então sair de lá custa um import e poupa um conflito.
 */
import { memo } from "react";

import { Selo } from "../components/ui/Selo";
import { contagem } from "../lib/plural";
import { useChannel, useSomaDeCanais, useTopico } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import css from "./Aninhados.module.css";

/**
 * A soma dos canais de uma categoria recolhida — D-CANAIS-35.
 *
 * Componente próprio e não um hook no cabeçalho, e a razão é de ESCOPO: ele
 * só monta com a categoria fechada, então uma coluna com tudo aberto não paga
 * subscrição nenhuma a mais. Com o hook lá em cima, toda categoria assinaria
 * todos os canais dela o tempo todo — e a coluna já monta três nós por linha.
 *
 * ⚠ **Mesma disciplina do rail: menção é CONTAGEM, não-lida é presença.** O
 * design desenha um badge só, em `danger`, com o número; aqui o vermelho fica
 * para a menção e a não-lida sem menção sai em neutro, que é o vocabulário
 * que esta coluna já usa em toda linha de canal. Pintar "12 não-lidas" de
 * vermelho diria que alguém te chamou.
 */
export function SomaDaCategoria({ ids }: { ids: readonly string[] }) {
  const soma = useSomaDeCanais(ids);

  if (soma.mencoes > 0) {
    return (
      <Selo forma="contagem" tom="perigo" className={css.somaDaSecao}>
        {contagem(soma.mencoes)}
      </Selo>
    );
  }
  if (soma.naoLidas > 0) {
    return (
      <Selo forma="contagem" tom="neutro" className={css.somaDaSecao}>
        {contagem(soma.naoLidas)}
      </Selo>
    );
  }
  return null;
}

/**
 * Um tópico seguido, sob o canal pai.
 *
 * ⚠ **Tópico É canal no protocolo** — daí `useChannel` para o contador e
 * `selecionarCanal` para abrir. `useTopico` traz o NOME, que é o que o
 * cabeçalho do tópico mostra e o snapshot de canal não tem.
 *
 * Assina os dois por ID e nada mais: alguém responder num tópico acorda esta
 * linha, não a coluna.
 */
export const LinhaDeTopico = memo(function LinhaDeTopico({
  id,
  ativo,
}: {
  id: string;
  ativo: boolean;
}) {
  const topico = useTopico(id);
  const canal = useChannel(id);

  if (!topico) return null;

  const novas = canal?.naoLidas ?? 0;

  return (
    <button
      type="button"
      className={css.topicoAninhado}
      aria-current={ativo}
      onClick={() => selecionarCanal(id)}
    >
      {/*
        O cotovelo do design: um quadradinho com duas bordas e o canto
        arredondado embaixo à esquerda. Ele é DESENHO de parentesco — é o que
        diz "este item pertence à linha de cima" sem gastar um rótulo.

        `aria-hidden` porque a relação já está na árvore: a linha vem logo
        depois do canal e o nome do tópico é a única coisa que se lê.
      */}
      <span className={css.cotovelo} aria-hidden />
      <span className={css.nomeDoTopico}>{topico.nome}</span>
      {novas > 0 ? (
        <>
          {/*
            Neutro, não vermelho — "novas" num tópico que eu sigo é presença,
            e o vermelho desta coluna é reservado para menção. É o tom que o
            design usa aqui (`--vx-track`), e o contraste com o badge da
            categoria recolhida é deliberado.
          */}
          <Selo forma="contagem" tom="neutro" className={css.novasDoTopico}>
            {contagem(novas)}
          </Selo>
          <span className="sr-only">
            {novas === 1 ? "1 mensagem nova" : `${contagem(novas)} mensagens novas`}
          </span>
        </>
      ) : null}
    </button>
  );
});
