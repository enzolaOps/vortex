/**
 * O firehose num Chrome headless, dirigido por CDP.
 *
 * `pnpm gate [url] [throttle]` — sobe o Chrome, semeia, roda a janela e imprime
 * o relatório. Serve para CI e para quem não quer clicar.
 *
 * ⚠ O QUE ELE NÃO É: um substituto da corrida em display real.
 *
 * Headless não pinta numa superfície de verdade, e a diferença é grande.
 * Mesmo build, mesmo throttle nominal de 4x, medido lado a lado:
 *
 *              headless      display real (160Hz)
 *   p95        12,5ms        18,7ms
 *   perdidos   0,5%          5,4% a 6,3%
 *
 * Não é o headless estando errado nem o display estando errado: são coisas
 * diferentes. O headless mede JS, layout e escopo de update; o display mede
 * isso MAIS rasterização e composição. A distância entre os dois é, muito
 * provavelmente, o custo de pintura — que é justamente o termo que este
 * arquivo é incapaz de ver.
 *
 * Use-o para A/B: dentro do mesmo ambiente, a comparação vale e é barata. Não
 * o use para declarar que o app "passa no gate" — isso continua exigindo a
 * corrida em tela de verdade, e o arnês continua tendo os botões para ela.
 *
 * O throttle de CPU aqui é `Emulation.setCPUThrottlingRate`, o mesmo comando
 * que o DevTools usa. Ele estrangula o AGENDAMENTO entre tarefas, não cada
 * instrução: um `[...array]` de 10k dentro de uma tarefa só quase não sente,
 * enquanto uma semeadura com yields fica 4,8x mais lenta. Ler os números com
 * isso em mente.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  "C:\\Users\\lagun\\.cache\\puppeteer\\chrome\\win64-151.0.7922.47\\chrome-win64\\chrome.exe";
const PORT = 9333;
const URL_APP = process.argv[2] ?? "http://localhost:4174";
const THROTTLE = Number(process.argv[3] ?? 4);

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

const av = async (expr, ms = 300_000) => {
  const r = await Promise.race([
    enviar(
      "Runtime.evaluate",
      { expression: expr, awaitPromise: true, returnByValue: true },
      sessionId,
    ),
    new Promise((_, e) => setTimeout(() => e(new Error("timeout")), ms)),
  ]);
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
};

await enviar("Page.enable", {}, sessionId);
await enviar("Page.navigate", { url: URL_APP }, sessionId);
await dorme(2500);

// Cadência de frame ANTES de qualquer medição: se o ambiente não entrega
// frames, o resto do relatório descreve o ambiente e não o código.
const cadencia = await av(`
new Promise(r=>{const t0=performance.now();let n=0;
const tick=()=>{n++;if(performance.now()-t0<2000)requestAnimationFrame(tick)};
requestAnimationFrame(tick);
setTimeout(()=>r({frames:n,fps:Math.round(n/2)}),2200)})`);
console.log("cadência sem carga:", JSON.stringify(cadencia));

if (cadencia.fps < 30) {
  console.log("AMBIENTE INVÁLIDO — headless não está compondo frames.");
  ws.close();
  chrome.kill();
  process.exit(1);
}

if (THROTTLE > 1) {
  await enviar("Emulation.setCPUThrottlingRate", { rate: THROTTLE }, sessionId);
  console.log(`throttle de CPU aplicado: ${THROTTLE}x`);
}

// A caixa "CPU 4x" do arnês declara a CONDIÇÃO, e é ela que escolhe o teto.
await av(`(()=>{const c=[...document.querySelectorAll('input[type=checkbox]')][0];
if(c.checked !== ${THROTTLE > 1}) c.click(); return c.checked})()`);

await av(`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.startsWith('Semear')).click();return 1})()`);

const semeou = await av(`
new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{
const b=[...document.querySelectorAll('button')].find(x=>x.textContent.startsWith('Semear'));
if((b&&b.disabled)||Date.now()-t0>240000){clearInterval(iv);r(Date.now()-t0)}},500)})`);
console.log(`semeadura: ${semeou}ms`);

await av(`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.startsWith('Firehose')).click();return 1})()`);

const relatorio = await av(
  `
new Promise(r=>{const t0=Date.now();const iv=setInterval(()=>{
const b=[...document.querySelectorAll('button')].find(x=>x.textContent.startsWith('Firehose 500'));
if((b&&!b.disabled)||Date.now()-t0>200000){clearInterval(iv);
const spans=[...document.querySelectorAll('span')].map(s=>s.textContent);
r({
 veredito: spans.find(t=>t==='PASS'||t==='FAIL') ?? '(sem veredito)',
 frames: spans.find(t=>/fps · refresh/.test(t)) ?? '',
 distribuicao: spans.find(t=>/frames por refresh/.test(t)) ?? '',
 contadores: spans.find(t=>/lista ·/.test(t)) ?? '',
 lateral: spans.find(t=>/^lateral:/.test(t)) ?? '',
 espalhamento: spans.find(t=>/espalhamento/.test(t)) ?? '',
 invalida: spans.find(t=>/INVÁLIDA/.test(t)) ?? '',
})}},1000)})`,
  400_000,
);

console.log("\n===== RESULTADO =====");
for (const [k, v] of Object.entries(relatorio)) if (v) console.log(`${k}: ${v}`);

ws.close();
chrome.kill();
