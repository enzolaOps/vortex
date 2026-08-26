import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useSyncExternalStore } from "react";

import { ATRIBUTO_DE_COLUNA } from "../dev/alinhamento";
import { assinarOpcoes, lerOpcoes } from "../dev/opcoes";
import { count } from "../dev/stats";
import { ouvirFimDaLista } from "../store/comandos";
import { useChannelMessageIds } from "../store/hooks";
import css from "./MessageList.module.css";
import { MessageRow } from "./MessageRow";

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
 * O chute original da fase 0, e a altura REAL média medida no prepend.
 *
 * Os 44px nunca foram medidos — foram estimados antes de existir linha com
 * agrupamento, divisor de data e estado de envio. A medição do prepend
 * mostrou 1441px de crescimento em 50 linhas: ~73px cada.
 */
const ALTURA_CHUTADA = 44;
const ALTURA_MEDIDA = 73;

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
  // Lido UMA vez aqui e repassado por prop: assinar dentro da linha
  // acrescentaria uma subscrição por linha à medição que a chave existe para
  // fazer. Ver `dev/opcoes.ts`.
  const { semMenuPorLinha, estimativaMedida } = useSyncExternalStore(
    assinarOpcoes,
    lerOpcoes,
  );
  count("listRenders");
  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => scrollRef.current,
    // A MEDIDA é o default agora. Não porque acelerou — ela não moveu o gate
    // — mas porque está certa: 72,6px reais contra 73 estimados, medido no
    // arnês. A estimativa antiga errava ~38px por linha, o que faz a barra de
    // rolagem mentir sobre o tamanho do histórico e dá trabalho de compensação
    // ao virtualizador a cada rolagem. Correção vale por si; a chave inverte
    // para o chute antigo quando alguém quiser refazer o A/B.
    estimateSize: () => (estimativaMedida ? ALTURA_CHUTADA : ALTURA_MEDIDA),
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

  const items = virtualizer.getVirtualItems();

  // Altura real das linhas na tela, para o relatório dizer se a estimativa
  // escolhida está perto. Chutar 73 e não conferir seria repetir o erro dos 44.
  for (const item of items) {
    if (item.size > 0) {
      count("alturaSoma", item.size);
      count("alturaAmostras");
    }
  }

  /**
   * Linha medindo zero é bug, não estado.
   *
   * É o que realimenta o virtualizador e termina em "Maximum update depth
   * exceeded" — sem que o `getSnapshot` tenha alocado nada. Falha alto em dev;
   * some em produção.
   */
  if (import.meta.env.DEV) {
    const zero = items.find((item) => item.size === 0);
    if (zero) {
      console.error(
        `[vortex] linha ${String(zero.key)} mediu 0px. Linha não resolvida deve ` +
          `renderizar placeholder com altura, nunca null — zero realimenta a ` +
          `medição e trava a aba.`,
      );
    }
  }

  return (
    <div
      ref={scrollRef}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      className={css.scroll}
    >
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
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <MessageRow id={String(item.key)} semMenu={semMenuPorLinha} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
