import { At, ChatCircleDots } from "@phosphor-icons/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import { ATRIBUTO_DE_COLUNA } from "../dev/alinhamento";
import { aoTerminarArraste, estaArrastando } from "../store/arraste";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { definirAlvoDoMenu } from "../store/menuDeMensagem";
import { count, readCounters } from "../dev/stats";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import {
  ouvirFimDaLista,
  ouvirIrParaMensagem,
  pedirFocoNoComposer,
} from "../store/comandos";
import {
  messages,
  primeiraNaoLida,
  proximaMencao,
  temMencao,
} from "../sdk/adapter";
import { useChannelMessageIds } from "../store/hooks";
import css from "./MessageList.module.css";
import { MenuDaMensagem, MessageRow } from "./MessageRow";

/**
 * Quão longe do fim ainda conta como "no fim".
 *
 * Um número só, usado nos dois lugares que precisam concordar: o
 * `followOnAppend` do virtualizador e a nossa própria noção de estar colado.
 * Divergirem significaria a lista se achar colada enquanto o virtualizador já
 * desistiu de seguir — o estado exato que aprovou uma corrida de firehose
 * contra um app parado, na fase 0.
 */
const LIMIAR_DE_FIM = 80;

/**
 * Altura estimada de linha — MEDIDA, não chutada.
 *
 * Os 44px da fase 0 nunca foram medidos: foram estimados antes de existir
 * linha com agrupamento, divisor de data e estado de envio. O arnês mede a
 * altura real das linhas visíveis e reporta ao lado da estimada; deu 72,6px e
 * 72,7px em corridas distintas.
 *
 * Errar a estimativa não quebra nada — a compensação do virtualizador absorve
 * —, mas faz a barra de rolagem mentir sobre o tamanho do histórico e dá
 * trabalho de compensação a cada rolagem. Trocar 44 por 73 NÃO mudou o gate;
 * está aqui por correção, não por performance, e o relatório do arnês existe
 * para que o dia em que a linha mudar de forma isso apareça.
 *
 * **E apareceu, que é o ponto de o relatório existir.** O conserto do ritmo de
 * agrupamento (`py-0.5` era classe morta: a escala vai de 1 a 6 e
 * `--spacing-0.5` não existe, então a lista rodava com 0px dentro do grupo)
 * acrescentou 4px por linha, e o arnês passou a medir 75,6px em duas janelas
 * seguidas. 73 → 76.
 *
 * **E de novo com as reações.** Os chips deixaram de ser `<span>` e viraram
 * botões com borda e respiro; a média subiu para 78,3px. 76 → 78. É a terceira
 * vez que este número se move por mudança de forma da linha, e as três foram
 * pegas pelo mesmo relatório — a estimativa errada não quebra nada, mas faz a
 * barra de rolagem mentir sobre o tamanho do histórico.
 */
export const ALTURA_ESTIMADA = 78;

/**
 * A estimativa por TIPO de linha.
 *
 * A média única de 78px era um compromisso entre coisas que não se parecem:
 * uma linha de sistema é uma frase de uma linha com ícone, e uma linha que
 * abre grupo carrega nome, hora e o respiro de 16px que a continuação não tem.
 * Estimar as três pelo mesmo número faz a barra de rolagem errar na proporção
 * da frequência de cada tipo — e essa frequência muda com a conversa.
 *
 * **Os três números foram medidos, não escolhidos.** O arnês passou a reportar
 * a altura real partida por tipo justamente para isto: a ordem inversa —
 * escrever a constante e conferir depois — é como o `estimateSize: 44`
 * sobreviveu três fases errando 34px por linha.
 *
 * Medido no arnês, com o mesmo build e a mesma janela do gate: **92,5px abre
 * grupo · 60,6px continua · 37,1px sistema**. A constante única de 78px
 * superestimava a linha de continuação em quase 30% e a de sistema em mais do
 * DOBRO — e linha de sistema é a que mais aparece em servidor movimentado,
 * onde entra e sai gente o tempo todo.
 *
 * ⚠ **Estes números dependem da LARGURA da coluna**, e é honesto dizer isso:
 * a mesma medição no painel estreito do navegador embutido, com a coluna em
 * 538px em vez do teto de 1100px, deu 143px e 83px — o texto quebra em mais
 * linhas. A constante única tinha o mesmo problema e ninguém o havia
 * escrito. O que a torna aceitável é o que ela serve: a barra de rolagem
 * enquanto o histórico ainda não foi visto. Assim que a linha aparece, o
 * virtualizador mede a real. Um erro por largura é pequeno; a diferença entre
 * 37 e 78 numa linha de sistema não era.
 *
 * O que NÃO entra aqui: reações, citação e divisores. Todos mudam a altura, e
 * todos são condicionais que o virtualizador remede de qualquer jeito assim
 * que a linha aparece. Encher a fórmula de casos raros troca um erro pequeno e
 * constante por um erro pequeno e imprevisível.
 */
const ALTURA_POR_TIPO = {
  sistema: 37,
  abreGrupo: 93,
  continua: 61,
};

/**
 * A estimativa ainda descreve a linha que existe?
 *
 * Este número já se moveu quatro vezes — 44 → 73 → 76 → 78 — e nas quatro
 * quem percebeu foi uma pessoa lendo o relatório do arnês e reparando na
 * diferença. Relatório depende de alguém olhar; assertion não.
 *
 * Sobe um degrau na ordem do `enforcement.md`, de "checklist" para "assertion
 * em dev", e o custo é uma divisão por frame com 30 linhas na tela. Some em
 * produção.
 *
 * 15% é frouxo de propósito: mensagem longa e mensagem curta variam muito
 * dentro do mesmo tipo, e o alvo aqui é mudança de FORMA da linha — um chip
 * que ganhou borda, um respiro que apareceu —, não a variação natural de
 * conteúdo. Uma vez por tipo por sessão, senão vira ruído a 150fps.
 */
const AVISADO = new Set<string>();

function conferirEstimativa(tipo: keyof typeof ALTURA_POR_TIPO, media: number) {
  if (AVISADO.has(tipo)) return;
  const esperada = ALTURA_POR_TIPO[tipo];
  if (esperada <= 0) return;
  const erro = Math.abs(media - esperada) / esperada;
  if (erro < 0.15) return;

  AVISADO.add(tipo);
  console.error(
    `[vortex] a estimativa de altura da linha "${tipo}" está a ` +
      `${(erro * 100).toFixed(0)}% do real: estima ${esperada}px, mede ` +
      `${media.toFixed(1)}px. A linha mudou de forma. Estimativa errada não ` +
      `quebra nada — só faz a barra de rolagem mentir sobre o tamanho do ` +
      `histórico, a cada rolagem, para sempre.`,
  );
}

/**
 * Lista de mensagens virtualizada, em modo chat.
 *
 * Ordem normal e container de scroll normal — nada de `column-reverse`,
 * transform invertido ou compensação manual de `scrollTop`. Essas gambiarras
 * clássicas de chat deixaram de ser necessárias, e cada uma quebra seleção de
 * texto ou acessibilidade.
 */
export function MessageList({ channelId }: { channelId: string }) {
  const ids = useChannelMessageIds(channelId);
  count("listRenders");
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    /*
      Lê o snapshot direto do store, e isso é seguro: `getSnapshot` de um
      `EntityStore` é uma leitura de `Map`, não um hook. O virtualizador chama
      isto fora do render, para índices que ainda não estão na tela — é
      exatamente o caso onde não há componente para perguntar.
    */
    estimateSize: (i) => {
      const m = messages.getSnapshot(ids[i] ?? "");
      if (!m) return ALTURA_ESTIMADA;
      const porTipo = m.sistema
        ? ALTURA_POR_TIPO.sistema
        : m.iniciaGrupo
          ? ALTURA_POR_TIPO.abreGrupo
          : ALTURA_POR_TIPO.continua;

      /*
        Nunca zero, e isto não é paranoia: `estimateSize` devolvendo 0 é a
        MESMA armadilha da linha que mede 0px — o total encolhe, a janela
        visível muda e o ciclo se realimenta. Uma constante ainda não medida
        cai na média única, que é o valor que existia antes.
      */
      return porTipo > 0 ? porTipo : ALTURA_ESTIMADA;
    },
    // ID de entidade, nunca índice: índice corrompe o estado da linha a cada
    // inserção no topo.
    getItemKey: (i) => ids[i] ?? i,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: LIMIAR_DE_FIM,
    overscan: 6,
    // NÃO passar `useFlushSync: false`. Medido no spike: sem o flush
    // síncrono a compensação estimativa→real não segura a âncora — o
    // scrollToEnd inicial fica ~1000px atrás do fim, o followOnAppend nunca
    // engata (threshold 80px) e a lista deriva ~880px/s. Com o default, a
    // distância oscila 1–23px. O preço são warnings "flushSync was called
    // from inside a lifecycle method" no console em dev — o adapter React
    // do TanStack chama flushSync no ciclo de vida e o React cai no
    // fallback assíncrono. Barulhento, funcional.
  });

  /**
   * Estava colado no fim ANTES da mudança?
   *
   * Precisa ser lido no scroll e guardado, não perguntado depois: quando o
   * ResizeObserver dispara, o layout novo já valeu e a distância até o fim já
   * é a de depois. Perguntar tarde responde sempre a pergunta errada — é a
   * mesma armadilha da medição do prepend, onde a linha de base tinha que ser
   * a intenção e não o resultado observado.
   */
  const colado = useRef(true);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const aoRolar = () => {
      colado.current =
        element.scrollHeight - element.clientHeight - element.scrollTop <=
        LIMIAR_DE_FIM;
    };

    element.addEventListener("scroll", aoRolar, { passive: true });
    return () => element.removeEventListener("scroll", aoRolar);
  }, []);

  /**
   * Lei nº 6, antecipada para a fase 0 — e agora nas duas dimensões.
   *
   * LARGURA mudou = remedir. Na fase 4 a causa será o usuário arrastando a
   * borda de um slot, mas as causas já existem: janela redimensionada, sidebar
   * colapsando, popout, painel de thread abrindo.
   *
   * ALTURA mudou = reancorar. Esta causa nasceu com o composer, que cresce
   * enquanto a pessoa escreve.
   *
   * As assertions existem para o dia em que alguém mexer aqui e esquecer uma
   * das duas — falham alto em dev, custam zero em produção.
   */
  const ultimaLargura = useRef(0);
  const ultimaAltura = useRef(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    let ativo = true;

    const observer = new ResizeObserver(([entry]) => {
      const largura = entry?.contentRect.width ?? 0;
      const altura = entry?.contentRect.height ?? 0;

      if (largura !== ultimaLargura.current) {
        ultimaLargura.current = largura;

        /**
         * Durante o arraste de um slot, NÃO remede.
         *
         * A regra vem da referência da fase 4 — "remedir e reancorar após o
         * commit, nunca durante o arraste" — e o motivo é o custo: a coluna
         * muda de largura a cada frame do arraste, e este callback remede
         * todas as linhas. Somados, viram uma remedição completa por frame
         * enquanto alguém segura o mouse.
         *
         * O trabalho não é descartado, é adiado: `aoTerminarArraste` abaixo
         * faz a mesma coisa uma vez só, quando o commit acontece.
         */
        if (estaArrastando()) return;

        virtualizer.measure();

        if (import.meta.env.DEV && virtualizer.getVirtualItems().length > 0) {
          const medidas = virtualizer.measurementsCache.length;
          const total = virtualizer.options.count;
          if (medidas !== total) {
            console.warn(
              "[vortex] largura do container mudou e a remedição não cobriu " +
                `todas as linhas (${medidas}/${total}). A âncora vai saltar.`,
            );
          }
        }
      }

      /**
       * ALTURA mudou — e o navegador não devolve a âncora sozinho.
       *
       * O composer crescendo uma linha encolhe este container. O `scrollTop`
       * continua válido e é preservado, então a distância até o fim AUMENTA
       * pela altura que sumiu. Duas ou três linhas digitadas bastam para
       * passar do `LIMIAR_DE_FIM`, e aí `followOnAppend` desliga em silêncio:
       * a pessoa digita e as mensagens dos outros param de aparecer.
       *
       * É o mesmo modo de falha que fez uma bateria de PASS medir uma lista
       * parada na fase 0, por outra causa. Por isso a defesa é a mesma: quem
       * estava no fim, volta ao fim.
       */
      if (altura !== ultimaAltura.current) {
        const encolheu = altura < ultimaAltura.current;
        ultimaAltura.current = altura;

        if (colado.current) {
          virtualizer.scrollToEnd();

          if (import.meta.env.DEV && encolheu) {
            // Dois frames: um para o scroll valer, outro para a remedição.
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                if (!ativo) return;
                const distancia =
                  element.scrollHeight -
                  element.clientHeight -
                  element.scrollTop;
                if (distancia > LIMIAR_DE_FIM) {
                  console.warn(
                    "[vortex] a altura do container encolheu, a lista estava " +
                      `no fim e terminou a ${Math.round(distancia)}px dele. ` +
                      "followOnAppend vai desligar em silêncio.",
                  );
                }
              }),
            );
          }
        }
      }
    });

    observer.observe(element);
    return () => {
      ativo = false;
      observer.disconnect();
    };
    // `ids.length` NÃO entra aqui: durante o firehose isso desconectaria e
    // reconectaria o observer a cada frame. A contagem vem do virtualizador,
    // que já a conhece.
  }, [virtualizer]);

  /**
   * Fim do arraste de slot: remede agora, uma vez.
   *
   * Precisa de evento próprio porque o commit no store não muda tamanho
   * nenhum — a largura já foi escrita no DOM durante o arraste, então o
   * `ResizeObserver` não dispara de novo. Sem isto, a remedição adiada
   * simplesmente nunca aconteceria, e a lista ficaria com alturas medidas
   * numa largura que não existe mais.
   */
  useEffect(
    () =>
      aoTerminarArraste(() => {
        virtualizer.measure();
        if (colado.current) virtualizer.scrollToEnd();
      }),
    [virtualizer],
  );

  /**
   * "Enviei — me leva para o fim."
   *
   * Effect é o uso correto aqui: sincronizar com um sistema externo. O
   * composer não conhece esta lista, e continua não conhecendo quando os dois
   * estiverem em painéis diferentes.
   */
  useEffect(
    () => ouvirFimDaLista(channelId, () => virtualizer.scrollToEnd()),
    [channelId, virtualizer],
  );

  /**
   * "Me leva até a mensagem citada."
   *
   * O índice é procurado NA HORA, não guardado: a lista muda de tamanho o
   * tempo todo, e um índice memoizado apontaria para a linha errada depois do
   * primeiro prepend. `indexOf` num array de 10 mil é microssegundos, e isto
   * roda por clique humano.
   *
   * `align: "center"` e não `"start"`: quem salta quer LER o contexto em volta
   * da mensagem, e encostá-la no topo esconde justamente o que veio antes
   * dela — que é metade da razão de ter clicado.
   */
  useEffect(
    () =>
      ouvirIrParaMensagem(channelId, (messageId) => {
        const indice = ids.indexOf(messageId);
        // Fora do histórico carregado: silêncio é a resposta certa por ora.
        // Buscar o trecho anterior é caminho de rede, e é fase 6.
        if (indice === -1) return;
        virtualizer.scrollToIndex(indice, { align: "center" });
      }),
    [channelId, ids, virtualizer],
  );

  /**
   * `scrollToEnd()` após a carga inicial — a regra de component-primitives.md
   * que eu tinha pulado, e o custo de pulá-la é traiçoeiro: o drift entre
   * altura estimada e real acumula ~1000px em 10k linhas, a lista fica além
   * do `scrollEndThreshold`, e `followOnAppend` desliga silenciosamente.
   *
   * O sintoma não é visual — é o firehose medindo uma lista PARADA e
   * aprovando um app que não estava fazendo nada.
   */
  const ancorou = useRef(false);
  useEffect(() => {
    if (ancorou.current || ids.length === 0) return;
    ancorou.current = true;
    virtualizer.scrollToEnd();
  }, [ids.length, virtualizer]);

  /**
   * A barra de "ir para a primeira não lida".
   *
   * Sem ela o divisor existe e ninguém o alcança: num canal com dez mil
   * mensagens, "você parou aqui" a quatro mil linhas de distância é a mesma
   * coisa que não saber. A barra é o que transforma posição em NAVEGAÇÃO — e
   * é a metade que o Discord tem e quase todo clone não.
   *
   * Lido a cada render e não assinado: o cursor muda ao SAIR do canal, e a
   * lista é remontada por `key` quando o canal troca. Não há atualização a
   * perder enquanto ela está montada.
   */
  const alvoNaoLida = primeiraNaoLida(channelId);
  const indiceNaoLida = alvoNaoLida ? ids.indexOf(alvoNaoLida) : -1;

  /**
   * A última menção para a qual pulamos, para "próxima" significar próxima.
   *
   * `useRef` e não estado: mudar de menção não muda nada na tela — a rolagem é
   * imperativa e o botão continua idêntico. Estado aqui seria um re-render da
   * lista inteira por clique, e a lista é o componente mais caro do app.
   */
  const ultimaMencao = useRef<string | undefined>(undefined);
  // O(1): a lista de menções tem cache pela identidade do array de IDs.
  // Perguntar isto com uma varredura custou 18,6% de frames perdidos.
  const há = temMencao(channelId);

  const items = virtualizer.getVirtualItems();

  /*
    Altura real das linhas na tela, para o relatório dizer se a estimativa está
    perto. Chutar 73 e não conferir seria repetir o erro dos 44.

    Partida por TIPO desde agora, e é o que permite estimar por tipo em vez de
    por média: uma média só esconde que linha de sistema é uma fração de uma
    linha de fala. Os números vêm da tela antes de virarem constante — a ordem
    inversa é como o `estimateSize: 44` sobreviveu três fases.
  */
  for (const item of items) {
    if (item.size <= 0) continue;
    count("alturaSoma", item.size);
    count("alturaAmostras");

    const m = messages.getSnapshot(String(item.key));
    if (!m) continue;
    if (m.sistema) {
      count("alturaSistemaSoma", item.size);
      count("alturaSistemaAmostras");
    } else if (m.iniciaGrupo) {
      count("alturaGrupoSoma", item.size);
      count("alturaGrupoAmostras");
    } else {
      count("alturaContinuaSoma", item.size);
      count("alturaContinuaAmostras");
    }
  }

  if (import.meta.env.DEV) {
    // Precisa de amostra o bastante para a média significar algo: com dez
    // linhas, uma mensagem longa sozinha desloca o número.
    const c = readCounters();
    if (c.alturaGrupoAmostras > 200) {
      conferirEstimativa("abreGrupo", c.alturaGrupoSoma / c.alturaGrupoAmostras);
    }
    if (c.alturaContinuaAmostras > 200) {
      conferirEstimativa("continua", c.alturaContinuaSoma / c.alturaContinuaAmostras);
    }
    if (c.alturaSistemaAmostras > 200) {
      conferirEstimativa("sistema", c.alturaSistemaSoma / c.alturaSistemaAmostras);
    }
  }

  /**
   * Linha medindo zero é bug, não estado.
   *
   * É o que realimenta o virtualizador e termina em "Maximum update depth
   * exceeded" — sem que o `getSnapshot` tenha alocado nada. Falha alto em dev;
   * some em produção.
   */
  /*
    Painel NÃO EXIBIDO não é linha quebrada.

    A coluna colapsa a `display: none` por container query — em 768px a de
    membros some inteira — e a lista continua MONTADA ali dentro. Sem caixa,
    tudo mede 0, e a assertion acusava dezenas de linhas quebradas num painel
    que ninguém está vendo.

    Guarda que grita à toa é guarda que alguém desliga, e essa é a única que
    protege a invariante que trava a aba. `offsetParent === null` é o teste
    certo e não "tamanho zero": ele distingue NÃO RENDERIZADO de renderizado
    com zero, e é o segundo que é bug.
  */
  if (import.meta.env.DEV && scrollRef.current?.offsetParent) {
    const zero = items.find((item) => item.size === 0);
    if (zero) {
      console.error(
        `[vortex] linha ${String(zero.key)} mediu 0px. Linha não resolvida deve ` +
          `renderizar placeholder com altura, nunca null — zero realimenta a ` +
          `medição e trava a aba.`,
      );
    }
  }

  /*
    Canal sem histórico: o vazio É o começo do canal.

    Antes, renderizava NADA — uma coluna em branco, indistinguível de "ainda
    carregando" e de "quebrou". É o melhor padrão da categoria, e a razão de
    ele ser o melhor é que não trata a ausência como falta: o canal começou
    aqui, e essa é uma informação verdadeira e útil, não um consolo.

    A ação leva de fato ao composer — `pedirFocoNoComposer` atravessa o mesmo
    barramento de `pedirFimDaLista`, porque a lista não alcança o composer pelo
    nome (lei nº 6) e na fase 4 os dois podem estar em painéis diferentes.

    FORA do container de scroll virtualizado, de propósito: dentro, ele viraria
    conteúdo com altura que o virtualizador não mede e a `getTotalSize` passaria
    a mentir.
  */
  if (ids.length === 0) {
    return (
      <div className={css.scroll}>
        <div className={css.coluna} {...{ [ATRIBUTO_DE_COLUNA]: "mensagem" }}>
          <EstadoVazio
            icone={<ChatCircleDots size={20} />}
            titulo="Este é o começo do canal."
            detalhe="Ainda não há nada aqui — o que você escrever será a primeira mensagem."
            acao={{
              rotulo: "Escrever a primeira",
              aoClicar: () => pedirFocoNoComposer(channelId),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    /*
      UM `ContextMenu` para a lista inteira.

      Ele estava em cada `MessageRow` — Root, Trigger, Portal e Content por
      linha — e linha monta e desmonta na velocidade do scroll. Eram dezenas de
      árvores de menu do Radix criadas e destruídas por segundo enquanto
      ninguém tinha aberto menu nenhum.

      O `Trigger` envolve o container rolável, então o clique direito abre no
      ponteiro como antes. Quem é o alvo vem do store, escrito pela linha.
    */
    <ContextMenu>
      <ContextMenuTrigger asChild>
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      /*
        Limpa o alvo na CAPTURA, antes de a linha escrever o seu na bolha.

        Sem isto, clique direito no vão entre linhas abriria o menu com o alvo
        do clique anterior, e "Copiar texto" copiaria outra mensagem. Bug que
        não dá erro e só aparece quando alguém repara que colou coisa errada.

        E fora de uma linha o menu não abre. Isto é decidível AQUI, na captura,
        porque a pergunta é sobre o alvo do evento e não sobre o que a bolha
        vai escrever — sem `preventDefault` o Radix abriria uma caixa vazia,
        que é pior que nenhuma resposta.
      */
      onContextMenuCapture={(evento) => {
        definirAlvoDoMenu(null);
        if (!(evento.target as Element).closest("article")) {
          evento.preventDefault();
        }
      }}
      // Região que rola e não recebe foco é inoperável por teclado: setas e
      // Page Down agem sobre o que está focado. Zero e não menos um — a
      // parada de tabulação É o recurso.
      tabIndex={0}
      className={css.scroll}
    >
      {/* Fora do container rolável não dá: ela precisa flutuar SOBRE a lista,
          e uma barra no fluxo empurraria a primeira linha para baixo — numa
          lista ancorada, isso é a âncora se movendo por causa de um aviso. */}
      {indiceNaoLida !== -1 ? (
        <button
          type="button"
          className={css.barraNaoLidas}
          onClick={() =>
            virtualizer.scrollToIndex(indiceNaoLida, { align: "start" })
          }
        >
          novas mensagens · ir para a primeira
        </button>
      ) : null}

      {/*
        Ir para a próxima menção.

        É a terceira perna de "leitura como posição", e a que faltava. As outras
        duas — primeira não lida e linha de novas mensagens — respondem "onde eu
        parei"; esta responde "onde falaram comigo", que é a pergunta que faz
        alguém abrir um canal de 10 mil mensagens.

        O badge de menção continua sendo CONTAGEM, e é a divisão certa: número
        responde "quantas", posição responde "onde", e o número nunca vai
        conseguir responder a segunda por mais que cresça.

        Flutua no canto em vez de ocupar a largura como a barra de não lidas: a
        barra é sobre o canal inteiro e aparece uma vez; este é um controle que
        se usa repetidamente, e um alvo que atravessa a coluna toda a cada uso
        seria ruído. As duas podem coexistir na tela.
      */}
      {há ? (
        <button
          type="button"
          className={css.irParaMencao}
          onClick={() => {
            const alvo = proximaMencao(channelId, ultimaMencao.current);
            if (!alvo) return;
            ultimaMencao.current = alvo;
            const i = ids.indexOf(alvo);
            if (i !== -1) virtualizer.scrollToIndex(i, { align: "center" });
          }}
        >
          <At size={20} aria-hidden />
          próxima menção
        </button>
      ) : null}
      {/* Teto de linha legível. Sem isto o texto estica até 3000px em
          ultrawide, que é o bug de layout que motivou o redesign.

          O marcador é o contrato com o composer, que precisa ocupar esta
          mesma caixa — verificado em dev, não confiado à disciplina. */}
      <div className={css.coluna} {...{ [ATRIBUTO_DE_COLUNA]: "mensagem" }}>
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {items.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              data-mid={String(item.key)}
              ref={virtualizer.measureElement}
              className={css.linhaVirtual}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MessageRow id={String(item.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
      </ContextMenuTrigger>

      <MenuDaMensagem />
    </ContextMenu>
  );
}
