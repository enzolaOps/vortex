import { useVirtualizer } from "@tanstack/react-virtual";
import { count } from "nucleo/arnes/stats";
import { remedir } from "nucleo/lib/remedir";
import { messages } from "nucleo/sdk/adapter";
import { useChannelMessageIds } from "nucleo/store/hooks";
import { useEffect, useRef } from "react";

import { chat } from "../../textos";
import {
  ALTURA_DO_DIVISOR,
  ALTURA_ESTIMADA,
  ALTURA_POR_TIPO,
  LIMIAR_DE_FIM,
  amostrarAltura,
  type TipoDeLinha,
} from "./alturas";
import { LinhaDeMensagem } from "./LinhaDeMensagem";
import css from "./ListaDeMensagens.module.css";

export interface ListaDeMensagensProps {
  canalId: string;
  servidorId: string;
}

/** Rolagem iniciada por gente: só ela pode DESCOLAR a lista do fim. */
const TECLAS_DE_ROLAGEM = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

/**
 * Lista de mensagens virtualizada, em modo chat (lei nº 2: virtualização desde a
 * primeira linha). Ordem normal e container de scroll normal: nada de
 * `column-reverse`, transform invertido ou compensação manual de `scrollTop`.
 *
 * Mecânica herdada do spike (ver o `MessageList` do `client`, que tem as
 * medições):
 *  - `anchorTo: "end"` + `followOnAppend` com o MESMO limiar que a nossa noção
 *    de "colado" (se divergirem, a lista acha que segue enquanto o virtualizador
 *    já desistiu, e o gate mede uma lista parada);
 *  - `getItemKey` por ID de entidade, nunca índice;
 *  - `useFlushSync` no default: sem o flush a compensação estimativa-real não
 *    segura a âncora (os avisos de flushSync no console de dev são o preço);
 *  - rede de segurança por `ResizeObserver` do medidor: se o conteúdo cresce e a
 *    pessoa estava no fim, volta ao fim, mesmo que o virtualizador já tenha
 *    desistido (o desengate dele é irreversível);
 *  - largura do container mudou = remedir (`remedir`, nunca `measure()` cru);
 *    altura mudou = reancorar.
 */
export function ListaDeMensagens({ canalId, servidorId }: ListaDeMensagensProps) {
  count("listRenders");
  const ids = useChannelMessageIds(canalId);
  const rolagem = useRef<HTMLDivElement | null>(null);
  const medidor = useRef<HTMLDivElement | null>(null);
  const temLista = ids.length > 0;

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual: o compiler pula este componente; o memo da linha cobre os filhos
  const virtualizer = useVirtualizer({
    count: ids.length,
    getScrollElement: () => rolagem.current,
    // Lê do store direto: `getSnapshot` é leitura de Map, e o virtualizador pergunta
    // por linhas que ainda nem estão na tela (não há componente para perguntar).
    estimateSize: (i) => {
      const m = messages.getSnapshot(ids[i] ?? "");
      if (!m) return ALTURA_ESTIMADA;
      const tipo: TipoDeLinha = m.sistema ? "sistema" : m.iniciaGrupo ? "abreGrupo" : "continua";
      return ALTURA_POR_TIPO[tipo] + (m.dia === undefined ? 0 : ALTURA_DO_DIVISOR);
    },
    getItemKey: (i) => ids[i] ?? i,
    measureElement: (el) => (el as HTMLElement).offsetHeight,
    anchorTo: "end",
    followOnAppend: true,
    scrollEndThreshold: LIMIAR_DE_FIM,
    overscan: 6,
  });

  // Estava colado no fim ANTES da mudança? Guardado no scroll, não perguntado
  // depois: quando o observador dispara, o layout novo já valeu.
  const colado = useRef(true);
  const dirigindo = useRef(false);

  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    let limpeza = 0;
    const aoDirigir = () => {
      dirigindo.current = true;
      if (limpeza !== 0) clearTimeout(limpeza);
      // 150ms: uma roda de mouse emite uma rajada com o `scroll` vindo atrás.
      limpeza = window.setTimeout(() => {
        dirigindo.current = false;
      }, 150);
    };
    const aoTeclar = (e: KeyboardEvent) => {
      if (TECLAS_DE_ROLAGEM.has(e.key)) aoDirigir();
    };
    // Descolar exige gesto; colar não. Posição sozinha mente: a lista também se
    // afasta do fim quando o conteúdo cresce embaixo.
    const aoRolar = () => {
      const noFim = el.scrollHeight - el.clientHeight - el.scrollTop <= LIMIAR_DE_FIM;
      if (noFim) colado.current = true;
      else if (dirigindo.current) colado.current = false;
    };
    el.addEventListener("scroll", aoRolar, { passive: true });
    el.addEventListener("wheel", aoDirigir, { passive: true });
    el.addEventListener("touchstart", aoDirigir, { passive: true });
    el.addEventListener("keydown", aoTeclar);
    return () => {
      el.removeEventListener("scroll", aoRolar);
      el.removeEventListener("wheel", aoDirigir);
      el.removeEventListener("touchstart", aoDirigir);
      el.removeEventListener("keydown", aoTeclar);
      if (limpeza !== 0) clearTimeout(limpeza);
    };
    // `temLista`: sem lista não há container, e o efeito não ligaria na primeira
    // abertura de um canal que nasce vazio.
  }, [canalId, temLista]);

  // O CONTEÚDO cresceu: reancora quem queria estar no fim. Observa o medidor (cuja
  // altura é `getTotalSize()`), não o container: são eventos diferentes.
  useEffect(() => {
    const m = medidor.current;
    if (!m) return;
    let ultima = m.getBoundingClientRect().height;
    const obs = new ResizeObserver(() => {
      const altura = m.getBoundingClientRect().height;
      const cresceu = altura > ultima;
      ultima = altura;
      // Encolher é mensagem apagada: a posição de leitura vale mais que a âncora.
      if (cresceu && colado.current) virtualizer.scrollToEnd();
    });
    obs.observe(m);
    return () => {
      obs.disconnect();
    };
  }, [virtualizer, temLista]);

  // Largura mudou = remedir; altura mudou = reancorar. Assertions em dev para o
  // dia em que alguém mexer aqui e esquecer uma das duas.
  const ultimaLargura = useRef(0);
  const ultimaAltura = useRef(0);
  useEffect(() => {
    const el = rolagem.current;
    if (!el) return;
    const obs = new ResizeObserver(([entrada]) => {
      const largura = entrada?.contentRect.width ?? 0;
      const altura = entrada?.contentRect.height ?? 0;
      if (largura !== ultimaLargura.current) {
        ultimaLargura.current = largura;
        remedir(virtualizer);
        if (import.meta.env.DEV && virtualizer.getVirtualItems().length > 0) {
          const medidas = virtualizer.measurementsCache.length;
          const total = virtualizer.options.count;
          if (medidas !== total) {
            console.warn(
              `[vortex] largura do container mudou e a remedição não cobriu todas as linhas (${medidas}/${total}). A âncora vai saltar.`,
            );
          }
        }
      }
      if (altura !== ultimaAltura.current) {
        ultimaAltura.current = altura;
        if (colado.current) virtualizer.scrollToEnd();
      }
    });
    obs.observe(el);
    return () => {
      obs.disconnect();
    };
    // `ids.length` fora de propósito: reconectar o observador a cada frame do firehose.
  }, [virtualizer, temLista]);

  // `scrollToEnd` depois da carga inicial: o drift entre altura estimada e real
  // soma ~1000px em 10k linhas, a lista passa do limiar e `followOnAppend`
  // desliga em silêncio. O sintoma não é visual: é o firehose medindo uma lista parada.
  const ancorou = useRef(false);
  useEffect(() => {
    if (ancorou.current || ids.length === 0) return;
    ancorou.current = true;
    virtualizer.scrollToEnd();
  }, [ids.length, virtualizer]);

  if (!temLista) {
    return (
      <div className={css.vazio}>
        <p>{chat.comecoDoCanal}</p>
        <p>{chat.semMensagens}</p>
      </div>
    );
  }

  const itens = virtualizer.getVirtualItems();

  // Altura real por tipo para o relatório do arnês: chutar e não conferir é como
  // os 44px sobreviveram. Mede no render, depois do virtualizador ter medido.
  for (const item of itens) {
    const m = messages.getSnapshot(String(item.key));
    if (!m) continue;
    amostrarAltura(
      m.sistema ? "sistema" : m.iniciaGrupo ? "abreGrupo" : "continua",
      item.size,
      m.dia !== undefined,
    );
  }

  // Linha medindo 0px é bug, não estado: realimenta o virtualizador e trava a aba.
  // `offsetParent` distingue NÃO RENDERIZADO (display: none, painel colapsado) de
  // renderizado com zero, e só o segundo é bug.
  if (import.meta.env.DEV && rolagem.current?.offsetParent) {
    const zero = itens.find((item) => item.size === 0);
    if (zero) {
      console.error(
        `[vortex] linha ${String(zero.key)} mediu 0px. Linha não resolvida deve renderizar placeholder com altura, nunca null.`,
      );
    }
  }

  return (
    <div
      ref={rolagem}
      role="log"
      aria-label={chat.listaDeMensagens}
      aria-live="polite"
      aria-relevant="additions"
      // Região que rola e não recebe foco é inoperável por teclado.
      tabIndex={0}
      className={css.rolagem}
    >
      <div className={css.coluna}>
        <div ref={medidor} className={css.medidor} style={{ blockSize: `${virtualizer.getTotalSize()}px` }}>
          {itens.map((item) => (
            <div
              key={item.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className={css.linha}
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <LinhaDeMensagem id={String(item.key)} servidorId={servidorId} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
