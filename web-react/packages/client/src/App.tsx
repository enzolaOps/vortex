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
import { Segmentado } from "./components/ui/Segmentado";
import { createFrameRecorder, verdict, type FrameReport } from "./dev/frames";
import { medirPrepend, type ResultadoPrepend } from "./dev/prepend";
import { readCounters, resetCounters, type Counters } from "./dev/stats";
import { CabecalhoDeCanal } from "./canais/CabecalhoDeCanal";
import cssCabecalho from "./canais/CabecalhoDeCanal.module.css";
import { EstadoVazio } from "./components/ui/EstadoVazio";
import { ALTURA_ESTIMADA, MessageList } from "./list/MessageList";
import { PainelDeEdicao } from "./layout/PainelDeEdicao";
import { ListaDeMembros } from "./membros/ListaDeMembros";
import { PainelDeFixados } from "./fixados/PainelDeFixados";
import { Paleta } from "./paleta/Paleta";
import {
  assinarPaleta,
  fecharPaleta,
  ligarAtalhoDaPaleta,
  paletaAberta,
} from "./store/paleta";
import { Rail } from "./rail/Rail";
import { configurarSimulacaoDeEnvio } from "./sdk/adapter";
import { Shell } from "./shell/Shell";
import { useCanalAtivo } from "./store/hooks";
import { entrar } from "./store/edicao";
import { assinarLayout, definirSemente, lerSemente } from "./store/layout";
import { SEMENTE_PADRAO } from "./tema/derivar";
import { selecionarServidor } from "./store/navegacao";

/**
 * Tamanhos de semeadura, para o teste de LENGTH.
 *
 * A pergunta que isto responde: o custo por frame escala com o total da lista
 * ou só com a janela visível? Publicar a lista de IDs copia o array inteiro —
 * `[...idsOf(channelId)]` — e a 10k isso mediu 0,57ms por publicação. Se o p95
 * cair um degrau ao semear 1.000, o total é o driver e carregamento
 * progressivo paga; se não cair, janela deslizante resolveria memória e não
 * resolveria o gate.
 *
 * Um seletor de duas opções é infinitamente mais barato que construir a
 * janela para descobrir isso depois.
 */
const TAMANHOS = [1_000, 10_000] as const;
const EVENTS_PER_SECOND = 500;
const WINDOW_SECONDS = 30;
const WARMUP_SECONDS = 1.5;

export function App() {
  const [seedCount, setSeedCount] = useState<number>(TAMANHOS[1]);
  const [seeded, setSeeded] = useState(0);
  const [seeding, setSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<FrameReport | null>(null);
  const [faixa, setFaixa] = useState<{ min: number; max: number } | null>(null);
  const [progresso, setProgresso] = useState(0);
  const [repeticoes, setRepeticoes] = useState(1);
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
   * O Tailwind não sabe que temas existem: as utilities apontam para as mesmas
   * vars, e trocar a semente reescreve as vars na raiz de graça. É a razão de
   * os tokens não morarem no `@theme`.
   *
   * Desde o picker, o botão mexe na SEMENTE em vez de no `data-theme`: duas
   * fontes decidindo o modo dariam um botão que troca o tema e um picker que o
   * troca de volta.
   */
  const semente = useSyncExternalStore(assinarLayout, lerSemente);

  /**
   * O canal aberto vem do store de navegação, não de uma constante.
   *
   * O arnês continua semeando e medindo o CHANNEL_ID — é o canal que tem 10k
   * mensagens — mas quem decide o que a coluna do meio mostra é a lista de
   * canais, como no app de verdade.
   */
  const canal = useCanalAtivo();

  /**
   * A paleta, e o atalho que a abre.
   *
   * `ligarAtalhoDaPaleta` é module-level e idempotente — chamá-lo aqui é só
   * garantir que aconteça uma vez. O listener NÃO vive num `useEffect` deste
   * componente: um atalho de teclado no `document` não pertence a árvore de
   * componente nenhuma, e prendê-lo aqui faria o App re-renderizar a cada
   * abertura.
   */
  ligarAtalhoDaPaleta();
  const paletaVisivel = useSyncExternalStore(assinarPaleta, paletaAberta);

  const ids = useRef<readonly string[]>([]);
  const recorder = useRef(createFrameRecorder());


  async function handleSeed() {
    setSeeding(true);
    const started = performance.now();
    ids.current = await seed(seedCount);
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

  /**
   * Uma janela de medição. Devolve o relatório e os contadores.
   *
   * Extraída de `handleRun` para poder repetir — ver `REPETICOES`.
   */
  function medirUmaJanela(): Promise<{ report: FrameReport; stats: Counters }> {
    return new Promise((resolve) => {
      const stop = startFirehose(EVENTS_PER_SECOND, ids.current);
      // Aquecimento de 1,5s: a janela mede regime permanente, não a ligada do
      // firehose nem o que sobrou do render de setup na fila.
      recorder.current.start(WARMUP_SECONDS * 1000);
      // Contadores começam junto com a medição, não com o firehose: o
      // aquecimento não deve entrar na conta.
      setTimeout(() => resetCounters(), WARMUP_SECONDS * 1000);

      setTimeout(
        () => {
          stop();
          const report = recorder.current.stop();
          const stats = readCounters();
          // Validade: se a lista não estava colada no fim, o followOnAppend
          // esteve desligado e a corrida mediu um app parado. Foi exatamente
          // assim que uma sequência de PASS sem throttle aprovou uma lista
          // ociosa enquanto a corrida real, a 4x, reprovava.
          const el = document.querySelector('div[role="log"]');
          setDistanciaDoFim(
            el ? Math.round(el.scrollHeight - el.clientHeight - el.scrollTop) : null,
          );
          resolve({ report, stats });
        },
        (WARMUP_SECONDS + WINDOW_SECONDS) * 1000,
      );
    });
  }

  /**
   * Roda N janelas e fica com a MEDIANA.
   *
   * Existe porque uma corrida só não decide mais nada. Cinco configurações
   * medidas deram entre 5,4% e 6,3% de frames perdidos — 0,9 ponto percentual
   * de espalhamento — enquanto a diferença que separa o gate de passar é 0,72
   * ponto. O ruído entre corridas ficou MAIOR que o efeito procurado, e a
   * partir daí todo A/B de corrida única vira cara ou coroa com aparência de
   * medição.
   *
   * Mediana e não média: uma janela azarada — um pico do próprio gerador, uma
   * coleta de lixo — desloca a média e não desloca a mediana. E a faixa
   * min–max é reportada junto, porque esconder o espalhamento é como se chegou
   * aqui.
   */
  async function handleRun() {
    setRunning(true);
    setReport(null);
    setStats(null);
    setFaixa(null);

    const corridas: { report: FrameReport; stats: Counters }[] = [];
    for (let i = 0; i < repeticoes; i++) {
      setProgresso(i + 1);
      corridas.push(await medirUmaJanela());
    }
    setProgresso(0);

    // Mediana pelo critério que decide o gate: frames perdidos.
    const perda = (c: { report: FrameReport }) =>
      c.report.dropped / Math.max(c.report.frames, 1);
    const ordenadas = [...corridas].sort((a, b) => perda(a) - perda(b));
    const meio = ordenadas[Math.floor(ordenadas.length / 2)]!;

    setReport(meio.report);
    setStats(meio.stats);
    setFaixa(
      corridas.length > 1
        ? {
            min: Math.min(...corridas.map(perda)) * 100,
            max: Math.max(...corridas.map(perda)) * 100,
          }
        : null,
    );
    setRunning(false);
    console.table(corridas.map((c) => c.report));
    console.table(meio.stats);
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
            {seeding ? "semeando…" : `Semear ${seedCount.toLocaleString("pt-BR")}`}
          </button>

          {/* Condição da corrida, como o CPU 4x: fica ao lado do botão que a
              usa, e trava depois de semear — trocar o tamanho com a lista
              carregada mediria uma coisa e diria outra. */}
          <Segmentado
            rotulo="Tamanho da semeadura"
            valor={String(seedCount)}
            desabilitado={seeded > 0 || seeding || running}
            opcoes={TAMANHOS.map((n) => ({
              id: String(n),
              rotulo: `${n.toLocaleString("pt-BR")} msgs`,
            }))}
            aoEscolher={(id) => setSeedCount(Number(id))}
          />

          <button
            onClick={() => void handleRun()}
            disabled={seeded === 0 || seeding || running}
            className="rounded-2 bg-accent px-3 py-1 text-sm text-on-accent disabled:bg-surface-3 disabled:text-text-3"
          >
            {running
              ? `janela ${progresso}/${repeticoes} — ${WINDOW_SECONDS}s`
              : `Firehose ${EVENTS_PER_SECOND}/s`}
          </button>

          {/* Repetição é condição de corrida, como o CPU 4x. Uma janela só
              deixou de decidir quando o ruído entre corridas passou o efeito
              procurado. */}
          <Segmentado
            rotulo="Janelas de medição"
            valor={String(repeticoes)}
            desabilitado={running}
            opcoes={[
              { id: "1", rotulo: "1 janela" },
              { id: "3", rotulo: "3 janelas" },
            ]}
            aoEscolher={(id) => setRepeticoes(Number(id))}
          />

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

          {/* Entrada do modo edição.
              Mora no cabeçalho do arnês porque o produto ainda não tem menu de
              configuração; no cliente de verdade é de lá que ela sai. */}
          <button
            onClick={() => entrar()}
            className="rounded-2 border border-border-subtle bg-surface-2 px-3 py-1 text-sm text-text-1"
          >
            editar layout
          </button>

          <button
            onClick={() =>
              definirSemente({
                ...SEMENTE_PADRAO[semente.modo === "escuro" ? "claro" : "escuro"],
                matiz: semente.matiz,
                croma: semente.croma,
              })
            }
            className="rounded-2 border border-border-subtle bg-surface-2 px-3 py-1 text-sm text-text-1"
          >
            {semente.modo === "escuro" ? "tema: escuro" : "tema: claro"}
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

          {faixa ? (
            <span className="text-xs text-text-3">
              espalhamento entre janelas: {faixa.min.toFixed(1)}%–
              {faixa.max.toFixed(1)}% de frames perdidos
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
              {stats.publishes} publicações ({stats.publishMs}ms ·{" "}
              {(stats.publishMs / Math.max(stats.publishes, 1)).toFixed(2)}ms cada) ·
              gerador {(stats.tickMs ?? 0).toFixed(0)}ms (pior tick{" "}
              {(stats.maxTickMs ?? 0).toFixed(1)}ms) · vazão{" "}
              {report ? Math.round((stats.eventos ?? 0) / Math.max(report.seconds, 1)) : "?"}{" "}
              ev/s de {EVENTS_PER_SECOND} · altura real{" "}
              {(stats.alturaSoma / Math.max(stats.alturaAmostras, 1)).toFixed(1)}px
              {/* Importado, nunca repetido: escrito à mão aqui, o relatório
                  passou a dizer 73 depois de a estimativa virar 76, e o
                  instrumento mediria uma coisa afirmando outra. */}
              (estimando {ALTURA_ESTIMADA}px)
            </span>
          ) : null}
          {/* Colunas laterais em linha própria: somadas às da lista, viram
              média e não atribuem nada — que foi exatamente o que aconteceu
              na primeira corrida depois da fase 3. */}
          {/* A distribuição responde a pergunta que `perdidos` não responde:
              quanto disto um usuário de monitor rápido enxerga. */}
          {report ? (
            <span className="text-xs text-text-3">
              frames por refresh: {report.intervalos.um} em 1× ·{" "}
              {report.intervalos.dois} em 2× · {report.intervalos.tres} em 3× ·{" "}
              {report.intervalos.quatroOuMais} em 4×+ · dentro do orçamento de{" "}
              {report.intervalo}ms:{" "}
              {(
                (report.intervalos.um / Math.max(report.frames, 1)) *
                100
              ).toFixed(1)}
              %
              {/*
                Delta menor que um vsync é impossível, então este número
                deveria ser zero. Quando não é, o relógio da máquina está
                perturbado — e foi uma rajada desses que quebrou o estimador
                de intervalo antes. Aparece no relatório para que a próxima
                corrida estranha se explique sozinha.
              */}
              {report.subIntervalo > 0
                ? ` · ⚠ ${report.subIntervalo} delta(s) abaixo de um vsync`
                : null}
            </span>
          ) : null}
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
      /* O shell recebe painéis por TIPO e pergunta ao store quem ocupa qual
         slot. Trocar dois de lado deixou de ser mudança de código. */
      paineis={{
        rail: <Rail />,
        canais: <ListaDeCanais />,
        membros: <ListaDeMembros />,
        fixados: <PainelDeFixados />,
      }}
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
          /*
            O cabeçalho vive DENTRO do conteúdo, e não na linha `ferramentas`
            do shell, porque aquela linha é a barra do arnês. Num app sem
            arnês os dois trocariam de lugar — e o `min-h-0` que o shell põe
            nesta célula continua valendo, com o grid interno abaixo.
          */
          <div className={cssCabecalho.coluna}>
            <CabecalhoDeCanal channelId={canal} />
            <MessageList key={canal} channelId={canal} />
          </div>
        ) : (
          <EstadoVazio
            titulo="Nenhum canal aberto"
            detalhe="Escolha um canal na coluna à esquerda para começar a ler."
          />
        )
      }
      composer={canal ? <Composer channelId={canal} /> : undefined}
      sobreposto={
        <>
          <PainelDeEdicao />
          {paletaVisivel ? <Paleta aoFechar={fecharPaleta} /> : null}
        </>
      }
    />
  );
}
