import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ListaDeCanais } from "./canais/ListaDeCanais";
import { Composer } from "./composer/Composer";
import {
  editarUltima,
  falarEmOutroCanal,
  seed,
  SERVER_ID,
  startFirehose,
} from "./dev/firehose";
import { createFrameRecorder, verdict, type FrameReport } from "./dev/frames";
import { alternar, assinarOpcoes, lerOpcoes } from "./dev/opcoes";
import { medirPrepend, type ResultadoPrepend } from "./dev/prepend";
import { readCounters, resetCounters, type Counters } from "./dev/stats";
import { MessageList } from "./list/MessageList";
import { ListaDeMembros } from "./membros/ListaDeMembros";
import { Rail } from "./rail/Rail";
import { configurarSimulacaoDeEnvio } from "./sdk/adapter";
import { Shell } from "./shell/Shell";
import { useCanalAtivo } from "./store/hooks";
import { selecionarServidor } from "./store/navegacao";

const SEED_COUNT = 10_000;
const EVENTS_PER_SECOND = 500;
const WINDOW_SECONDS = 30;
const WARMUP_SECONDS = 1.5;

export function App() {
  const [seeded, setSeeded] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<FrameReport | null>(null);
  const [stats, setStats] = useState<Counters | null>(null);
  const [prepend, setPrepend] = useState<ResultadoPrepend | null>(null);
  const [distanciaDoFim, setDistanciaDoFim] = useState<number | null>(null);
  // Quem roda declara a condição — o gate não tem como detectar throttle de
  // CPU, e inferir daria um critério que muda sozinho conforme o resultado.
  const [throttled, setThrottled] = useState(true);

  /**
   * Falha de envio precisa ser VISÍVEL, não só representável.
   *
   * `sendState: "failed"` existe no domínio desde o primeiro dia, e um estado
   * que nunca foi renderizado é tipo, não comportamento. Enquanto não há rede
   * para falhar de verdade, o arnês falha por decreto.
   */
  const [falharEnvio, setFalharEnvio] = useState(false);
  useEffect(() => {
    configurarSimulacaoDeEnvio({ falhar: falharEnvio });
  }, [falharEnvio]);

  /**
   * Troca de tema é sobrescrever a camada 1 e nada mais.
   *
   * O Tailwind não sabe que temas existem: as utilities apontam para as
   * mesmas vars, e trocar `data-theme` no elemento raiz reflui tudo de
   * graça. É a razão de os tokens não morarem no `@theme`.
   */
  const [tema, setTema] = useState<"dark" | "light">("dark");
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
  }, [tema]);
  /**
   * O canal aberto vem do store de navegação, não de uma constante.
   *
   * O arnês continua semeando e medindo o CHANNEL_ID — é o canal que tem 10k
   * mensagens — mas quem decide o que a coluna do meio mostra é a lista de
   * canais, como no app de verdade.
   */
  const canal = useCanalAtivo();

  /**
   * A chave do A/B. Ver `dev/opcoes.ts` para o porquê de ela existir.
   *
   * Fica ao lado do "CPU 4x" de propósito: as duas descrevem a CONDIÇÃO da
   * corrida, e condição de corrida pertence ao mesmo canto do arnês que o
   * veredito.
   */
  const { semMenuPorLinha } = useSyncExternalStore(assinarOpcoes, lerOpcoes);

  const ids = useRef<readonly string[]>([]);
  const recorder = useRef(createFrameRecorder());


  async function handleSeed() {
    setSeeding(true);
    const started = performance.now();
    ids.current = await seed(SEED_COUNT);
    setSeeded(ids.current.length);
    // Abre o servidor semeado. `selecionarServidor` escolhe o primeiro canal
    // de TEXTO dele, que é o canal com as 10k mensagens.
    selecionarServidor(SERVER_ID);
    setSeeding(false);
    console.info(
      `[vortex] semeadas ${ids.current.length} mensagens em ` +
        `${Math.round(performance.now() - started)}ms`,
    );
  }

  function handleRun() {
    setRunning(true);
    setReport(null);
    setStats(null);
    const stop = startFirehose(EVENTS_PER_SECOND, ids.current);
    // Aquecimento de 1,5s: a janela mede regime permanente, não a ligada do
    // firehose nem o que sobrou do render de setup na fila.
    recorder.current.start(WARMUP_SECONDS * 1000);
    // Contadores começam junto com a medição, não com o firehose: o
    // aquecimento não deve entrar na conta.
    setTimeout(() => resetCounters(), WARMUP_SECONDS * 1000);

    setTimeout(() => {
      stop();
      const result = recorder.current.stop();
      const counters = readCounters();
      // Validade: se a lista não estava colada no fim, o followOnAppend
      // esteve desligado e a corrida mediu um app parado. Foi exatamente
      // assim que uma sequência de PASS sem throttle aprovou uma lista
      // ociosa enquanto a corrida real, a 4x, reprovava.
      const el = document.querySelector('div[role="log"]');
      setDistanciaDoFim(
        el ? Math.round(el.scrollHeight - el.clientHeight - el.scrollTop) : null,
      );
      setReport(result);
      setStats(counters);
      console.table(counters);
      setRunning(false);
      console.table(result);
    }, (WARMUP_SECONDS + WINDOW_SECONDS) * 1000);
  }

  const naoSeguia = distanciaDoFim !== null && distanciaDoFim > 120;
  const result = report ? verdict(report, { throttled }) : null;

  return (
    <Shell
      ferramentas={
        <header className="flex flex-wrap items-center gap-3 border-b border-border-subtle bg-surface-1 px-4 py-2">
          <button
            onClick={() => void handleSeed()}
            disabled={seeded > 0 || seeding || running}
            className="rounded-2 bg-surface-3 px-3 py-1 text-sm text-text-1 disabled:text-text-3"
          >
            {seeding ? "semeando…" : `Semear ${SEED_COUNT.toLocaleString("pt-BR")}`}
          </button>

          <button
            onClick={handleRun}
            disabled={seeded === 0 || seeding || running}
            className="rounded-2 bg-accent px-3 py-1 text-sm text-on-accent disabled:bg-surface-3 disabled:text-text-3"
          >
            {running
              ? `aquecendo + medindo ${WINDOW_SECONDS}s…`
              : `Firehose ${EVENTS_PER_SECOND}/s`}
          </button>

          <button
            onClick={() => {
              void medirPrepend(50).then((r) => {
                setPrepend(r);
                console.info("[vortex] prepend:", r);
              });
            }}
            disabled={seeded === 0}
            className="rounded-2 bg-surface-3 px-3 py-1 text-sm text-text-1 disabled:text-text-3"
          >
            Carregar histórico
          </button>

          {/* As duas fases aparecem separadas de propósito: um veredito único
              esconderia qual delas falhou, e elas falham por motivos
              diferentes — inserção é compensação sobre estimativa, remedição é
              compensação durante o scroll. */}
          {prepend ? (
            <span className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`rounded-2 px-2 py-1 ${
                  prepend.motivo
                    ? "bg-surface-3 text-text-2"
                    : Math.abs(prepend.deslocamentoVisual) <= 2
                      ? "bg-success text-surface-0"
                      : "bg-danger text-on-accent"
                }`}
              >
                {prepend.motivo
                  ? `inserção: ${prepend.motivo}`
                  : `inserção ${Math.abs(prepend.deslocamentoVisual) <= 2 ? "OK" : "SALTOU"} · ` +
                    `deslocou ${prepend.deslocamentoVisual}px · total +${prepend.crescimentoDoTotal}px · ` +
                    `scroll +${prepend.deslocamentoDoScroll}px`}
              </span>

              {prepend.remedicao ? (
                <span
                  className={`rounded-2 px-2 py-1 ${
                    prepend.remedicao.motivo
                      ? "bg-surface-3 text-text-2"
                      : prepend.remedicao.ok
                        ? "bg-success text-surface-0"
                        : "bg-danger text-on-accent"
                  }`}
                >
                  {prepend.remedicao.motivo
                    ? `remedição: ${prepend.remedicao.motivo}`
                    : `remedição ${prepend.remedicao.ok ? "OK" : "SALTOU"} · ` +
                      `pior salto ${prepend.remedicao.piorSalto}px em ${prepend.remedicao.passos} passos · ` +
                      `altura real somou ${prepend.remedicao.crescimentoPorRemedicao}px · ` +
                      `virtualizador compensou ${prepend.remedicao.compensacaoAplicada}px`}
                </span>
              ) : null}
            </span>
          ) : null}

          {/*
            Não-lida é observável só em canal FECHADO — e o firehose fala
            sempre no canal aberto, de propósito: mexer na mistura medida
            mudaria o gate. Este botão exercita a contabilidade sem tocar nela.
          */}
          <button
            onClick={() => falarEmOutroCanal()}
            disabled={seeded === 0}
            className="rounded-2 bg-surface-3 px-3 py-1 text-sm text-text-1 disabled:text-text-3"
          >
            Falar em outro canal
          </button>

          <button
            onClick={() => console.info("[vortex] editada:", JSON.stringify(editarUltima()))}
            disabled={seeded === 0}
            className="rounded-2 bg-surface-3 px-3 py-1 text-sm text-text-1 disabled:text-text-3"
          >
            Editar a última
          </button>

          <span className="text-xs text-text-3">
            {seeded > 0 ? `${seeded.toLocaleString("pt-BR")} carregadas` : "vazio"}
          </span>

          <button
            onClick={() => setTema((t) => (t === "dark" ? "light" : "dark"))}
            className="rounded-2 border border-border-subtle bg-surface-2 px-3 py-1 text-sm text-text-1"
          >
            {tema === "dark" ? "tema: escuro" : "tema: claro"}
          </button>

          <label className="flex items-center gap-2 text-xs text-text-2">
            <input
              type="checkbox"
              checked={throttled}
              onChange={(e) => setThrottled(e.target.checked)}
              disabled={running}
            />
            CPU 4x
          </label>

          <label className="flex items-center gap-2 text-xs text-text-2">
            <input
              type="checkbox"
              checked={falharEnvio}
              onChange={(e) => setFalharEnvio(e.target.checked)}
            />
            falhar envio
          </label>

          <label className="flex items-center gap-2 text-xs text-text-2">
            <input
              type="checkbox"
              checked={semMenuPorLinha}
              onChange={() => alternar("semMenuPorLinha")}
              disabled={running}
            />
            sem menu por linha (A/B)
          </label>

          {naoSeguia ? (
            <span className="rounded-2 bg-danger px-2 py-1 text-xs text-on-accent">
              INVÁLIDA — lista a {distanciaDoFim}px do fim, followOnAppend desligado
            </span>
          ) : null}

          {result ? (
            <span
              className={`rounded-2 px-2 py-1 text-xs ${
                result.pass ? "bg-success text-surface-0" : "bg-danger text-on-accent"
              }`}
            >
              {result.pass ? "PASS" : "FAIL"}
            </span>
          ) : null}

          {report ? (
            <span className="text-xs text-text-2">
              {report.fps} fps · refresh {report.intervalo}ms · p50 {report.p50}ms ·{" "}
              p95 {report.p95}ms ({report.p95EmIntervalos}×) · p99{" "}
              {report.p99}ms · pior {report.worst}ms · {report.dropped}/
              {report.frames} perdidos (
              {((report.dropped / Math.max(report.frames, 1)) * 100).toFixed(1)}%) ·{" "}
              {report.longTasks} long tasks (
              {report.longTaskMs}ms)
              {report.suspended > 0
                ? ` · ⚠ ${report.suspended} suspensões de rAF — rode com a janela visível e em foco`
                : ""}
            </span>
          ) : null}
          {stats ? (
            <span className="text-xs text-text-3">
              {stats.listRenders} lista · {stats.rowRenders} linha ·{" "}
              {stats.presenceRenders} presença · {stats.snapshots} snapshots ·{" "}
              {stats.publishes} publicações ({stats.publishMs}ms) · gerador{" "}
              {(stats.tickMs ?? 0).toFixed(0)}ms (pior tick {(stats.maxTickMs ?? 0).toFixed(1)}ms)
            </span>
          ) : null}
          {/* Colunas laterais em linha própria: somadas às da lista, viram
              média e não atribuem nada — que foi exatamente o que aconteceu
              na primeira corrida depois da fase 3. */}
          {stats ? (
            <span className="text-xs text-text-3">
              lateral: {stats.membrosListRenders} member list ·{" "}
              {stats.membrosRowRenders} linha de membro ·{" "}
              {stats.membrosPublishes} publicações ({stats.membrosPublishMs}ms) ·{" "}
              {stats.membroEfeitos} efeitos de membro
            </span>
          ) : null}
        </header>
      }
      rail={<Rail />}
      canais={<ListaDeCanais />}
      membros={<ListaDeMembros />}
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
        canal ? (
          <MessageList key={canal} channelId={canal} />
        ) : (
          <p className="p-4 text-md text-text-3">nenhum canal aberto</p>
        )
      }
      composer={canal ? <Composer channelId={canal} /> : undefined}
    />
  );
}
