import { Profiler, useEffect, useSyncExternalStore, type ReactNode } from "react";

import { Amigos } from "../casa/Amigos";
import { CabecalhoDeCanal } from "../canais/CabecalhoDeCanal";
import { Popout } from "../voz/Popout";
import { ComposerDoCanal, ConteudoDoCanal } from "./ConteudoDoCanal";
import { Configuracoes } from "../config/Configuracoes";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { ListaDeCanais } from "../canais/ListaDeCanais";
import { ListaDeMembros } from "../membros/ListaDeMembros";
import { Modais } from "../components/ui/Modais";
import { Drawer } from "../shell/Drawer";
import { PainelDeEdicao } from "../layout/PainelDeEdicao";
import { PainelDeFixados } from "../fixados/PainelDeFixados";
import { PainelDeBusca } from "../busca/PainelDeBusca";
import { CaixaDeEntrada } from "../caixa/CaixaDeEntrada";
import { Rail } from "../rail/Rail";
import { Shell } from "../shell/Shell";
import { PainelDeUsuario } from "../usuario/PainelDeUsuario";
import { OverlayDeDebug, contarCommit } from "../dev/OverlayDeDebug";
import { observarTamanhoDeIcone } from "../dev/tamanhoDeIcone";
import { assinarDev, lerDev } from "../store/dev";
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
  const overlay = useSyncExternalStore(assinarDev, () => lerDev().overlay);

  /*
    A assertion de tamanho de ícone.

    Mora AQUI e não numa superfície específica porque ela varre o documento
    inteiro: modal, painel, seletor e configurações montam fora desta árvore,
    e é justamente o que monta depois que o analisador estático não alcança.

    Some do bundle de produção — a função devolve um no-op fora de `DEV`.
  */
  useEffect(() => observarTamanhoDeIcone(), []);

  /*
    A tela de pessoas ocupa a coluna de CONTEÚDO, no lugar da lista.

    Não é painel, e a distinção economizou um slot: ela não tem histórico nem
    composer, e gastar um dos três slots do shell com ela seria caro para o que
    ela é. É o conflito nº 3 do plano de paridade, resolvido sem crescer o
    shell.
  */
  const naCasaDeAmigos = local.tipo === "amigos";

  /*
    ⚠ **O `<Profiler>` envolve o app inteiro, em DESENVOLVIMENTO.** É de onde
    sai a contagem de commits do overlay: ela é MEDIDA pelo React, não contada
    à mão num hook espalhado pelos componentes. Em produção ele não reporta —
    ver a condição abaixo —, e o que o overlay mostra ali é long task.

    ⚠ **A condição é lida do store, não de `import.meta.env.DEV`.** O overlay
    existe para quem vai reportar um problema — em produção, na máquina de quem
    o encontrou. Amarrá-lo a `DEV` o tornaria inútil exatamente onde ele serve.
  */
  const arvore = (
    <Shell
      ferramentas={ferramentas}
      /* O shell recebe painéis por TIPO e pergunta ao store quem ocupa qual
         slot. Trocar dois de lado deixou de ser mudança de código. */
      paineis={{
        rail: <Rail />,
        canais: <ListaDeCanais />,
        membros: <ListaDeMembros />,
        fixados: <PainelDeFixados />,
        caixaDeEntrada: <CaixaDeEntrada />,
        busca: <PainelDeBusca />,
      }}
      /*
        O cabeçalho é LINHA PRÓPRIA do shell agora, e não mais um irmão da
        lista dentro de um grid interno.

        A razão é a prancha: com a coluna de leitura travada em 1040 e
        centrada, um cabeçalho dentro dela deixaria o nome do canal e as ações
        flutuando no meio de uma janela ultrawide, longe das bordas onde a mão
        os procura. Ele tem de atravessar a coluna inteira.
      */
      usuario={<PainelDeUsuario />}
      cabecalho={
        canal && !naCasaDeAmigos ? (
          <CabecalhoDeCanal channelId={canal} />
        ) : (
          <CabecalhoDeCanal />
        )
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
          /*
            ⚠ **Quem escolhe entre a conversa e a SALA DE VOZ é ele, e não este
            componente.** A escolha depende do store de chamada, e assiná-lo
            aqui faria o shell inteiro re-renderizar a cada mudo, câmera ou
            participante entrando. Ver `ConteudoDoCanal`.
          */
          <ConteudoDoCanal channelId={canal} />
        ) : (
          <EstadoVazio
            preenche
            titulo="Nenhum canal aberto"
            detalhe="Escolha um canal na coluna à esquerda para começar a ler."
          />
        )
      }
      composer={
        canal && !naCasaDeAmigos ? <ComposerDoCanal channelId={canal} /> : undefined
      }
      sobreposto={
        <>
          <PainelDeEdicao />
          {/* Um ponto de montagem para os modais do plano de paridade, em vez
              de uma condicional por modal. O cliente não conhece nenhum. */}
          <Modais />
          <Drawer />
          {/* Tela cheia SOBRE o shell — a lista de mensagens continua montada
              atrás, com as linhas medidas. Ver `store/config.ts`. */}
          <Configuracoes />
          {/*
            O popout da chamada vive AQUI, na camada sobreposta, e não dentro
            da coluna de canal.

            ⚠ Ele estava na coluna, e o defeito só apareceu no navegador: a
            coluna só existe quando há canal aberto, então ir para a casa
            durante uma chamada fazia a chamada SUMIR da tela. Uma chamada que
            desaparece é uma chamada que a pessoa acha que caiu. A âncora dele
            é a JANELA.
          */}
          <Popout />
          {/* O overlay de depuração — devolve `null` com a preferência
              desligada, que é o caso de quase toda sessão. */}
          <OverlayDeDebug />
        </>
      }
    />
  );

  /*
    ⚠ **`import.meta.env.DEV` na condição, e não é zelo.** O `<Profiler>` é
    INERTE no build de produção do React — medido: dez re-renders garantidos e
    o mostrador em `0 commits`. Sem esta guarda o app de produção pagaria o
    wrapper para alimentar um contador que nunca conta, e o ramo inteiro some
    do bundle com ela.
  */
  return overlay && import.meta.env.DEV ? (
    <Profiler id="app" onRender={contarCommit}>
      {arvore}
    </Profiler>
  ) : (
    arvore
  );
}
