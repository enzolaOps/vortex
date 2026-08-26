import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";

import { count } from "../dev/stats";
import { useChannelMessageIds } from "../store/hooks";
import { MessageRow } from "./MessageRow";

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
    estimateSize: () => 44,
    // ID de entidade, nunca índice: índice corrompe o estado da linha a cada
    // inserção no topo.
    getItemKey: (i) => ids[i] ?? i,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: 80,
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
   * Lei nº 6, antecipada para a fase 0.
   *
   * Largura do container mudou = remedir e reancorar. Na fase 4 a causa será o
   * usuário arrastando a borda de um slot, mas as causas já existem: janela
   * redimensionada, sidebar colapsando, popout, painel de thread abrindo.
   *
   * A assertion existe para o dia em que alguém mexer aqui e esquecer o
   * `measure()` — falha alto em dev, custa zero em produção.
   */
  const lastWidth = useRef(0);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      if (width === lastWidth.current) return;
      lastWidth.current = width;
      virtualizer.measure();

      if (import.meta.env.DEV && virtualizer.getVirtualItems().length > 0) {
        const measured = virtualizer.measurementsCache.length;
        if (measured !== ids.length) {
          console.warn(
            "[vortex] largura do container mudou e a remedição não cobriu " +
              `todas as linhas (${measured}/${ids.length}). A âncora vai saltar.`,
          );
        }
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [virtualizer, ids.length]);

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
      className="h-full overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
    >
      {/* Teto de linha legível. Sem isto o texto estica até 3000px em
          ultrawide, que é o bug de layout que motivou o redesign. */}
      <div className="max-w-message">
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
              <MessageRow id={String(item.key)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
