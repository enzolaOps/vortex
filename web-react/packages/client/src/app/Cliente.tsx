import type { ReactNode } from "react";

import { Amigos } from "../casa/Amigos";
import { CabecalhoDeCanal } from "../canais/CabecalhoDeCanal";
import { CartaoDeChamada } from "../voz/CartaoDeChamada";
import { Composer } from "../composer/Composer";
import { Configuracoes } from "../config/Configuracoes";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { ListaDeCanais } from "../canais/ListaDeCanais";
import { ListaDeMembros } from "../membros/ListaDeMembros";
import { MessageList } from "../list/MessageList";
import { Modais } from "../components/ui/Modais";
import { PainelDeEdicao } from "../layout/PainelDeEdicao";
import { PainelDeFixados } from "../fixados/PainelDeFixados";
import { Rail } from "../rail/Rail";
import { Shell } from "../shell/Shell";
import { useCanalAtivo, useLocal } from "../store/hooks";

/**
 * O cliente. O app de verdade, sem arnês.
 *
 * ⚠ **Isto não existia, e a ausência era a maior dívida estrutural do
 * projeto.** O `App.tsx` montava o `Shell` com a barra do firehose — "Semear
 * 10.000", "Firehose 500/s", "3 janelas" — e essa era a única composição de
 * shell que havia. Toda superfície construída da fase 3 em diante nasceu
 * dentro de uma tela de teste, e não havia como abrir o produto e vê-lo.
 *
 * A separação não é cosmética. O arnês importa o firehose, o gerador de
 * mensagens sintéticas e o gravador de frames; com ele na composição de
 * produto, tudo isso viaja no bundle de quem só quer conversar. Agora o arnês
 * ENVOLVE este componente em vez de ser ele — `App.tsx` só o alcança em
 * desenvolvimento, e em produção o `import.meta.env.DEV` apaga o ramo inteiro.
 *
 * `ferramentas` é a única concessão: é por onde o arnês injeta a própria
 * barra. Em produção chega `undefined` e a linha do grid colapsa sozinha.
 */
export function Cliente({ ferramentas }: { ferramentas?: ReactNode }) {
  /*
    O canal aberto vem do store de navegação. O shell não sabe qual é — ele
    declara ONDE as colunas ficam, e quem as preenche é este componente.
  */
  const canal = useCanalAtivo();
  const local = useLocal();

  /*
    A tela de pessoas ocupa a coluna de CONTEÚDO, no lugar da lista.

    Não é painel, e a distinção economizou um slot: ela não tem histórico nem
    composer, e gastar um dos três slots do shell com ela seria caro para o que
    ela é. É o conflito nº 3 do plano de paridade, resolvido sem crescer o
    shell.
  */
  const naCasaDeAmigos = local.tipo === "amigos";

  return (
    <Shell
      ferramentas={ferramentas}
      /* O shell recebe painéis por TIPO e pergunta ao store quem ocupa qual
         slot. Trocar dois de lado deixou de ser mudança de código. */
      paineis={{
        rail: <Rail />,
        canais: <ListaDeCanais />,
        membros: <ListaDeMembros />,
        fixados: <PainelDeFixados />,
      }}
      /*
        O cabeçalho é LINHA PRÓPRIA do shell agora, e não mais um irmão da
        lista dentro de um grid interno.

        A razão é a prancha: com a coluna de leitura travada em 1040 e
        centrada, um cabeçalho dentro dela deixaria o nome do canal e as ações
        flutuando no meio de uma janela ultrawide, longe das bordas onde a mão
        os procura. Ele tem de atravessar a coluna inteira.
      */
      cabecalho={
        canal && !naCasaDeAmigos ? <CabecalhoDeCanal channelId={canal} /> : null
      }
      /*
        `key` no canal: trocar de canal REMONTA a lista.

        Não é atalho — é o comportamento correto, e de graça. O virtualizador
        guarda cache de medição e âncora por instância; reaproveitá-los entre
        canais faria a lista nova abrir na posição de rolagem da anterior, com
        alturas medidas de mensagens que não existem mais. Remontar zera os
        dois e o `scrollToEnd` inicial roda de novo.

        O composer NÃO é remontado: o rascunho vive no store, keyed por canal,
        então ele troca de texto sem perder o que estava escrito em nenhum dos
        dois.
      */
      conteudo={
        naCasaDeAmigos ? (
          <Amigos />
        ) : canal ? (
          <MessageList key={canal} channelId={canal} />
        ) : (
          <EstadoVazio
            titulo="Nenhum canal aberto"
            detalhe="Escolha um canal na coluna à esquerda para começar a ler."
          />
        )
      }
      composer={canal && !naCasaDeAmigos ? <Composer channelId={canal} /> : undefined}
      sobreposto={
        <>
          <PainelDeEdicao />
          {/* Um ponto de montagem para os modais do plano de paridade, em vez
              de uma condicional por modal. O cliente não conhece nenhum. */}
          <Modais />
          {/* Tela cheia SOBRE o shell — a lista de mensagens continua montada
              atrás, com as linhas medidas. Ver `store/config.ts`. */}
          <Configuracoes />
          {/*
            O cartão de chamada vive AQUI, na camada sobreposta, e não dentro
            da coluna de canal.

            ⚠ Ele estava na coluna, e o defeito só apareceu no navegador: a
            coluna só existe quando há canal aberto, então ir para a casa
            durante uma chamada fazia o cartão SUMIR — exatamente o caso que o
            modo compacto existia para cobrir. Uma chamada que desaparece é uma
            chamada que a pessoa acha que caiu.
          */}
          <CartaoDeChamada />
        </>
      }
    />
  );
}
