import { useEffect, useState, useSyncExternalStore } from "react";

import { assinarDev, lerDev } from "../store/dev";
import { assinarChamada, lerChamada } from "../store/chamada";
import { estatisticasDeVoz } from "../sdk/chamada";
import css from "./OverlayDeDebug.module.css";

/**
 * FPS, latência e commits, num canto da janela.
 *
 * ⚠ **NÃO é o gravador do arnês, e a diferença é de propósito.**
 * `dev/frames.ts` é instrumento de GATE: aquecimento de 1,5 s, detecção de
 * suspensão de rAF, `PerformanceObserver` de long task, percentis sobre uma
 * janela de 30 s. Nada disso serve a um mostrador que fica ligado o dia
 * inteiro — ele precisa responder "e agora?", numa janela de um segundo.
 *
 * O que as duas compartilham é a LIÇÃO e não o código: sem o intervalo de
 * vsync ao lado, "60 fps" num display de 165 Hz é uma afirmação sobre o
 * monitor errado. Aqui ele sai do menor delta da janela — a versão de um
 * segundo do que `estimarIntervalo` faz sobre trinta.
 *
 * ⚠ **Cada número vem de um instrumento DIFERENTE, e nenhum é estimado.** FPS
 * conta quadros de `requestAnimationFrame`; long task vem do
 * `PerformanceObserver`; a latência sai do `RTCStatsReport` do LiveKit. Onde
 * não há medida, a linha diz `—` em vez de um número plausível — é a mesma
 * decisão do "Conectado · 42 ms" que a faixa de voz recusou.
 *
 * ⚠ **`commits` só existe em DESENVOLVIMENTO, e a razão foi MEDIDA.** A
 * primeira versão contava commits com o `<Profiler>` do React em qualquer
 * build, e no de produção ele é INERTE: `onRender` não é chamado fora do build
 * de profiling. Medido em navegador — dez re-renders garantidos, e o
 * mostrador seguia em `0 commits`. Um número que marca zero para sempre lê
 * como "o app está parado" e significa "o instrumento está desligado", que é
 * exatamente o defeito que este projeto classifica como pior que a ausência.
 *
 * Trocar o React DOM pelo build de profiling faria o número existir em
 * produção — e cobraria de toda sessão um custo por commit, no app cujo gate
 * mede frames perdidos. Não vale por um mostrador de diagnóstico. O que sobra
 * em produção é LONG TASK, que responde a mesma pergunta ("o app travou a
 * thread?") e é medida de verdade em qualquer build.
 */
export function OverlayDeDebug() {
  const d = useSyncExternalStore(assinarDev, lerDev);
  if (!d.overlay) return null;
  return <Painel />;
}

/**
 * Contagem de commits do React, alimentada pelo `<Profiler>`.
 *
 * ⚠ **Module-level e não estado**, e é a lei nº 1 na sua forma mais literal:
 * quem escreve é o callback do `Profiler` no topo da árvore, e quem lê é um
 * painel numa esquina. Se o contador fosse estado, cada commit re-renderizaria
 * a árvore que ele está medindo — o instrumento como fonte do que ele mede.
 */
let commits = 0;
let duracaoTotal = 0;

/**
 * Se este navegador entrega `longtask`.
 *
 * Fora do React porque é propriedade do AMBIENTE e não muda durante a sessão —
 * e porque descobri-la acontece dentro de um efeito, onde escrever estado é
 * render em cascata.
 */
let suportado = true;

/** Chamado pelo `<Profiler>` que envolve o app. Ver `Cliente.tsx`. */
export function contarCommit(_id: string, _fase: unknown, duracao: number) {
  commits += 1;
  duracaoTotal += duracao;
}

function Painel() {
  const [linha, setLinha] = useState("medindo…");
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const naSala = chamada.estado === "dentro";
  const [rtt, setRtt] = useState<number | undefined>(undefined);
  const [travas, setTravas] = useState("0 travas");
  const [canto, setCanto] = useState<"fim" | "inicio">("fim");

  /* --------------------------------------------------- quadros e commits */
  useEffect(() => {
    let quadros = 0;
    let deltaMin = Infinity;
    let ultimo = performance.now();
    let janela = performance.now();
    let vivo = true;
    let raf = 0;

    /* Zera na montagem: o contador é module-level e sobrevive a fechar e
       reabrir o overlay, o que faria a primeira janela reportar acumulado. */
    commits = 0;
    duracaoTotal = 0;

    function quadro(agora: number) {
      if (!vivo) return;
      const delta = agora - ultimo;
      ultimo = agora;
      quadros += 1;
      /*
        O MENOR delta da janela é o intervalo de vsync — não a média. Um
        quadro não pode ser mais curto que um vsync, então o mínimo é o
        próprio, e é imune à cauda que estraga qualquer média. É a versão de
        um segundo do que `estimarIntervalo` faz sobre 30 s.
      */
      if (delta > 0.5 && delta < deltaMin) deltaMin = delta;

      if (agora - janela >= 1000) {
        const fps = Math.round((quadros * 1000) / (agora - janela));
        const hz = deltaMin === Infinity ? 0 : Math.round(1000 / deltaMin);
        /*
          O trecho de commits só entra em desenvolvimento — em produção o
          `<Profiler>` não reporta, e `0 commits` seria uma afirmação falsa.
        */
        const parteDeCommits = import.meta.env.DEV
          ? ` · ${String(commits)} commits · ${
              commits > 0 ? (duracaoTotal / commits).toFixed(1) : "0,0"
            }ms`
          : "";
        setLinha(`${String(fps)}/${String(hz)} fps${parteDeCommits}`);
        quadros = 0;
        commits = 0;
        duracaoTotal = 0;
        deltaMin = Infinity;
        janela = agora;
      }
      raf = requestAnimationFrame(quadro);
    }
    raf = requestAnimationFrame(quadro);

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  /* ----------------------------------------------------------- long task */
  useEffect(() => {
    /*
      ⚠ **`longtask` é o que mede jank em PRODUÇÃO.** É a mesma fonte que o
      gravador do gate usa, e a única das três que sobrevive ao build de
      produção — ver o comentário do módulo sobre o `<Profiler>` inerte.

      Nem todo navegador implementa a entrada; `observe` LANÇA em vez de
      ignorar quando o tipo é desconhecido, então o `try` não é cerimônia.
    */
    let n = 0;
    let ms = 0;
    let obs: PerformanceObserver | undefined;
    try {
      obs = new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) {
          n += 1;
          ms += e.duration;
        }
      });
      obs.observe({ entryTypes: ["longtask"] });
    } catch {
      /*
        ⚠ Não escreve estado aqui — `setState` direto no efeito é render em
        cascata, e o lint do projeto reprova. O suporte é constante durante a
        sessão, então quem decide o rótulo é a LEITURA, com `suportado` fora
        do React.
      */
      suportado = false;
      return;
    }

    const t = setInterval(() => {
      setTravas(
        n === 0
          ? "0 travas"
          : `${String(n)} travas · ${String(Math.round(ms))}ms`,
      );
      n = 0;
      ms = 0;
    }, 1000);

    return () => {
      clearInterval(t);
      obs?.disconnect();
    };
  }, []);

  /* ------------------------------------------------------------ latência */
  useEffect(() => {
    if (!naSala) return;
    /*
      ⚠ **Do `RTCStatsReport` e nunca de um valor pedido.** O LiveKit expõe
      `ConnectionQuality`, que é CLASSIFICAÇÃO — derivar milissegundos dela
      seria inventar o número, e esta pendência foi escrita depois de a faixa
      de voz já ter recusado exatamente isso. O RTT existe de verdade no
      relatório do WebRTC, e é ele ou nada.

      Um segundo entre amostras: `getStats()` percorre todos os transceptores,
      e a latência de rede não muda em 16ms.
    */
    let vivo = true;
    const t = setInterval(() => {
      void estatisticasDeVoz().then((ms) => {
        if (vivo) setRtt(ms);
      });
    }, 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [naSala]);

  return (
    <div
      className={css.overlay}
      data-canto={canto}
      /*
        ⚠ **`aria-live="off"` e não `polite`.** Um mostrador que muda uma vez
        por segundo em `polite` faria o leitor de tela falar por cima de tudo,
        para sempre. Quem quiser o número o alcança pelo foco do botão.
      */
      aria-live="off"
      role="status"
    >
      <span className={css.numeros}>{linha}</span>
      <span className={css.numeros}>{suportado ? travas : "travas n/d"}</span>
      <span className={css.numeros}>
        {/* `—` e não `0 ms`: fora de chamada não há rede de voz para medir, e
            zero seria uma afirmação sobre uma conexão que não existe. */}
        rtt {naSala && rtt !== undefined ? `${String(rtt)}ms` : "—"}
      </span>
      {/* O canto troca porque o overlay fica sobre a interface o dia inteiro,
          e o lado onde ele estorva depende do que a pessoa está fazendo. Um
          botão e não arrasto: dois cantos não pagam um gesto exclusivo de
          ponteiro. */}
      <button
        type="button"
        className={css.trocar}
        aria-label="Trocar o canto do overlay"
        onClick={() => setCanto((c) => (c === "fim" ? "inicio" : "fim"))}
      >
        ⇄
      </button>
    </div>
  );
}
