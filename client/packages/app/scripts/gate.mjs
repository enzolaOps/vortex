/**
 * O gate do firehose no Chrome headless, dirigido por CDP.
 *
 *   pnpm --filter app build:gate         # constrói o bundle COM o arnês (modo `gate`)
 *   pnpm --filter app gate:servir        # vite preview em :4174 (outro terminal)
 *   pnpm --filter app gate [url] [throttle]
 *
 * ⚠ O gate mede o que estiver SERVIDO. Ele não constrói nem sobe servidor: rodá-lo
 * depois de mexer no código, sem construir antes, aprova o bundle anterior e o
 * relatório parece legítimo.
 *
 * Contrato (ADR-010): o arnês expõe `window.__vortexGate = { semear, firehose,
 * relatorio }` e este script só o chama. Não raspa texto de botão.
 *
 * Variáveis de ambiente:
 *   VORTEX_CHROME          caminho do Chrome/Chromium (também aceita CHROME_PATH)
 *   VORTEX_GATE_JANELAS    janelas de medição; o veredito sai da MEDIANA (padrão 3)
 *   VORTEX_GATE_MENSAGENS  mensagens semeadas (padrão 10000)
 *   VORTEX_GATE_DENSIDADE  "confortavel" (padrão) ou "compacto": a densidade das mensagens medida
 *   VORTEX_GATE_TEXTO      tamanho do texto em % (90 a 125; padrão 100)
 *   VORTEX_GATE_SW=1       compõe por software (--disable-gpu). Só para DIAGNOSTICAR: inválido para veredito.
 *
 * Saída: 0 = PASS, 1 = FAIL, 2 = INVÁLIDA (ambiente ou carga: nem aprovada nem reprovada).
 *
 * ⚠ NÃO é substituto da corrida em display real. Headless mede JS, layout e escopo de
 * update, e não rasterização. Serve para A/B dentro do mesmo ambiente.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** O caminho antigo (cache do puppeteer do dono) só entra como último recurso. */
const CHROME_ANTIGO =
  "C:\\Users\\lagun\\.cache\\puppeteer\\chrome\\win64-151.0.7922.47\\chrome-win64\\chrome.exe";
const CHROME = process.env.VORTEX_CHROME ?? process.env.CHROME_PATH ?? CHROME_ANTIGO;

if (!existsSync(CHROME)) {
  console.error(
    `Chrome não encontrado em "${CHROME}". Aponte VORTEX_CHROME (ou CHROME_PATH) para o executável.`,
  );
  process.exit(2);
}

const PORT = 9333;
const URL_APP = process.argv[2] ?? "http://localhost:4174/dev";
const THROTTLE = Number(process.argv[3] ?? 4);
const JANELAS = Number(process.env.VORTEX_GATE_JANELAS ?? 3);
const MENSAGENS = Number(process.env.VORTEX_GATE_MENSAGENS ?? 10_000);
const AQUECIMENTO_S = 1.5;
const JANELA_S = 30;

const perfil = mkdtempSync(join(tmpdir(), "vortex-gate-"));

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${perfil}`,
    "--window-size=1600,900",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=CalculateNativeWinOcclusion",
    "--hide-scrollbars",
    ...(process.env.VORTEX_GATE_SW === "1" ? ["--disable-gpu"] : []),
    ...(process.env.CI ? ["--no-sandbox"] : []),
  ],
  { stdio: "ignore" },
);

const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperar(fn, tentativas = 80) {
  for (let i = 0; i < tentativas; i++) {
    try {
      const v = await fn();
      if (v) return v;
    } catch {
      // Chrome ainda subindo: tentar de novo é o comportamento certo.
    }
    await dorme(250);
  }
  throw new Error("Chrome não respondeu");
}

function sair(codigo) {
  try {
    chrome.kill();
  } catch {
    // já morreu
  }
  process.exit(codigo);
}

const versao = await esperar(async () => {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  return r.ok ? await r.json() : null;
});

const ws = new WebSocket(versao.webSocketDebuggerUrl);
await new Promise((ok, err) => {
  ws.onopen = ok;
  ws.onerror = err;
});

let id = 0;
const pendentes = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pendentes.has(m.id)) {
    const { ok, err } = pendentes.get(m.id);
    pendentes.delete(m.id);
    if (m.error) err(new Error(JSON.stringify(m.error)));
    else ok(m.result);
  }
};

const enviar = (method, params = {}, sessionId) =>
  new Promise((ok, err) => {
    const n = ++id;
    pendentes.set(n, { ok, err });
    ws.send(JSON.stringify({ id: n, method, params, sessionId }));
  });

const { targetId } = await enviar("Target.createTarget", { url: "about:blank" });
const { sessionId } = await enviar("Target.attachToTarget", { targetId, flatten: true });

const av = async (expressao, ms = 300_000) => {
  const r = await Promise.race([
    enviar("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true }, sessionId),
    new Promise((_, e) => setTimeout(() => e(new Error("timeout")), ms)),
  ]);
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await enviar("Page.enable", {}, sessionId);
// Preferências de aparência valem ANTES do app carregar: os stores leem do localStorage ao ser avaliados.
const DENSIDADE = process.env.VORTEX_GATE_DENSIDADE ?? "confortavel";
const TEXTO = Number(process.env.VORTEX_GATE_TEXTO ?? 100);
await enviar(
  "Page.addScriptToEvaluateOnNewDocument",
  {
    source: `try{localStorage.setItem("vortex:densidade",${JSON.stringify(DENSIDADE)});localStorage.setItem("vortex:aparencia",JSON.stringify({texto:${String(TEXTO)}}))}catch{}`,
  },
  sessionId,
);
console.log(`densidade: ${DENSIDADE} · texto: ${String(TEXTO)}%`);
await enviar("Page.navigate", { url: URL_APP }, sessionId);

// O arnês publica a API quando monta. Sem ela, a URL não é o arnês (ou o build não o inclui).
try {
  await esperar(() => av("Boolean(window.__vortexGate)"), 60);
} catch {
  console.error(
    `ARNÊS AUSENTE: window.__vortexGate não existe em ${URL_APP}. Confira se a URL termina em /dev ` +
      `e se o bundle foi construído com \`pnpm --filter app build:gate\` (modo gate).`,
  );
  sair(2);
}

// Cadência de frame ANTES de qualquer medição: se o ambiente não entrega frames,
// o resto do relatório descreve o ambiente e não o código.
const cadencia = await av(`
new Promise(r=>{const t0=performance.now();let ultimo=t0;const d=[];
const tick=()=>{const agora=performance.now();d.push(agora-ultimo);ultimo=agora;
if(agora-t0<2000)requestAnimationFrame(tick)};
requestAnimationFrame(tick);
setTimeout(()=>{const o=[...d].sort((a,b)=>a-b);
r({frames:d.length,fps:Math.round(d.length/2),mediana:Number((o[Math.floor(o.length/2)]||0).toFixed(2))})},2200)})`);
console.log("cadência sem carga:", JSON.stringify(cadencia));

if (cadencia.fps < 30) {
  console.log("AMBIENTE INVÁLIDO: o headless não está compondo frames.");
  sair(2);
}

if (THROTTLE > 1) {
  await enviar("Emulation.setCPUThrottlingRate", { rate: THROTTLE }, sessionId);
  console.log(`throttle de CPU aplicado: ${THROTTLE}x`);
}

const throttled = THROTTLE > 1;

const t0 = Date.now();
const semeadas = await av(`window.__vortexGate.semear(${MENSAGENS})`);
console.log(`semeadura: ${semeadas} mensagens em ${Date.now() - t0}ms`);

const relatorios = [];
for (let i = 1; i <= JANELAS; i++) {
  await av(`window.__vortexGate.firehose(true, { throttled: ${throttled} })`);
  await dorme((AQUECIMENTO_S + JANELA_S) * 1000);
  await av("window.__vortexGate.firehose(false)");
  const r = await av("window.__vortexGate.relatorio()");
  relatorios.push(r);
  const perdidos = (r.frames.dropped / Math.max(r.frames.frames, 1)) * 100;
  console.log(
    `janela ${i}/${JANELAS}: ${r.veredito} · ${perdidos.toFixed(1)}% perdidos · p95 ${r.frames.p95}ms · ` +
      `vazão ${r.vazao}/${r.condicao.eventosPorSegundo} ev/s` +
      (r.motivoInvalido ? ` · ${r.motivoInvalido}` : ""),
  );
}

const validas = relatorios.filter((r) => r.veredito !== "INVALIDA");
console.log("\n===== RESULTADO =====");
if (validas.length === 0) {
  console.log(
    `CORRIDA INVÁLIDA: nenhuma das ${JANELAS} janelas mediu o que diz medir. Nem PASS nem FAIL.\n` +
      `motivo: ${relatorios[0]?.motivoInvalido ?? "?"}`,
  );
  sair(2);
}

const perda = (r) => r.frames.dropped / Math.max(r.frames.frames, 1);
const ordenadas = [...validas].sort((a, b) => perda(a) - perda(b));
const mediana = ordenadas[Math.floor(ordenadas.length / 2)];
console.log(`janelas válidas: ${validas.length}/${JANELAS} (mediana por frames perdidos)`);
console.log(`veredito: ${mediana.veredito}`);
for (const c of mediana.checks) console.log(`  ${c.ok ? "ok " : "FALHA"} ${c.name}: ${c.got}`);
console.log(
  `faixa de perdidos: ${(perda(ordenadas[0]) * 100).toFixed(1)}% a ` +
    `${(perda(ordenadas.at(-1)) * 100).toFixed(1)}%`,
);
console.log(
  `condição: ${throttled ? `CPU ${THROTTLE}x` : "sem throttle"} · ${mediana.condicao.mensagens} mensagens · ` +
    `${mediana.condicao.eventosPorSegundo} ev/s pedidos, ${mediana.vazao} entregues`,
);
const c = mediana.contadores;
console.log(
  `lista ${c.listRenders} · linha ${c.rowRenders} · publicações ${c.publishes} (${c.publishMs}ms) · ` +
    `gerador ${Math.round(c.tickMs ?? 0)}ms (pior tick ${(c.maxTickMs ?? 0).toFixed(1)}ms)`,
);
const media = (soma, n) => (n > 0 ? `${(soma / n).toFixed(1)}px (${n})` : "sem amostra");
console.log(
  `altura real: abre grupo ${media(c.alturaGrupoSoma, c.alturaGrupoAmostras)} · ` +
    `continua ${media(c.alturaContinuaSoma, c.alturaContinuaAmostras)} · ` +
    `sistema ${media(c.alturaSistemaSoma, c.alturaSistemaAmostras)}`,
);
const f = mediana.frames;
console.log(
  `frames: ${f.frames} em ${f.seconds}s · p50 ${f.p50}ms · p95 ${f.p95}ms · p99 ${f.p99}ms · pior ${f.worst}ms · ` +
    `refresh ${f.intervalo}ms · long tasks ${f.longTasks} (${f.longTaskMs}ms) · suspensões ${f.suspended}`,
);
console.log(`distância do fim: ${mediana.distanciaDoFim}px`);

sair(mediana.veredito === "PASS" ? 0 : 1);
