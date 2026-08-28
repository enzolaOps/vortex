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
/*
  ⚠ **`/dev`, e o caminho é obrigatório.** O arnês deixou de ser o `App` quando
  o cliente de produto passou a existir; ele agora mora numa rota própria, e o
  gate media a tela de login sem dizer isso — estourava procurando a caixa de
  seleção da condição.
*/
const URL_APP = process.argv[2] ?? "http://localhost:4174/dev";
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
await dorme(1200);

/*
  O gate entra com SESSÃO, não com um botão.

  O portão da fase 6 vem antes do shell — sem alguém logado não há canal, autor
  nem permissão —, e a barra de ferramentas do arnês vive dentro do shell. Sem
  isto o gate estourava procurando uma caixa de seleção numa tela de login.

  E não dá para usar o botão de desenvolvimento: ele não existe no bundle de
  produção, que é justamente o que o gate mede. O caminho honesto é escrever no
  armazenamento a mesma sessão que uma pessoa logada teria, e deixar
  `restaurarSessao` fazer o trabalho dela. Simula o ESTADO, não fura o portão.

  O ID é o mesmo "eu" do firehose — sem isso o composer não teria autor e a
  mensagem otimista nasceria sem cabeçalho.
*/
await av(`localStorage.setItem('vortex.sessao', JSON.stringify({
  _id: 'gate', token: 'gate', user_id: '01JQ0000000000000001000000'
})), 1`);
await enviar("Page.navigate", { url: URL_APP }, sessionId);
await dorme(2500);

// Cadência de frame ANTES de qualquer medição: se o ambiente não entrega
// frames, o resto do relatório descreve o ambiente e não o código.
const cadencia = await av(`
new Promise(r=>{const t0=performance.now();let ultimo=t0;const d=[];
const tick=()=>{const agora=performance.now();d.push(agora-ultimo);ultimo=agora;
if(agora-t0<2000)requestAnimationFrame(tick)};
requestAnimationFrame(tick);
setTimeout(()=>{const o=[...d].sort((a,b)=>a-b);
const med=o[Math.floor(o.length/2)]||16.7;
const b=new Map();for(const x of o){const k=Math.floor(x/0.5);b.set(k,(b.get(k)||0)+1)}
const piso=Math.max(1,Math.floor(o.length*0.02));
const base=[...b.entries()].filter(([,n])=>n>=piso).map(([k])=>k).sort((p,q)=>p-q)[0];
const vsync=base===undefined?med:(base+0.5)*0.5;
r({frames:d.length,fps:Math.round(d.length/2),
mediana:Number(med.toFixed(2)),vsync:Number(vsync.toFixed(2)),
regulares:d.filter(x=>x<vsync*1.5).length})},2200)})`);
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
/*
  A barra do arnês tem de estar na tela ANTES de qualquer clique.

  Sem esta guarda o gate falhava com `Cannot read properties of undefined` — a
  mensagem descreve o sintoma (não achou a caixa) e esconde a causa (não estava
  no arnês). Guarda que explica o próprio erro é a diferença entre corrigir em
  um minuto e procurar por meia hora.
*/
await av(`(()=>{
  if (!document.querySelector('input[type=checkbox]'))
    throw new Error('ARNÊS AUSENTE — a barra de ferramentas não está na tela. '
      + 'Confira se a URL termina em /dev e se o build inclui o arnês '
      + '(ver src/dev/arnesAtivo.ts). Tela atual: '
      + document.body.innerText.slice(0, 120).replace(/ +/g, ' '));
  return 1;
})()`);

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
 subVsync: spans.find(t=>/abaixo de um vsync/.test(t)) ? 'SIM — ver distribuicao' : 'nao',
 contadores: spans.find(t=>/lista ·/.test(t)) ?? '',
 lateral: spans.find(t=>/^lateral:/.test(t)) ?? '',
 espalhamento: spans.find(t=>/espalhamento/.test(t)) ?? '',
 invalida: spans.find(t=>/INVÁLIDA/.test(t)) ?? '',
})}},1000)})`,
  400_000,
);

/*
  A corrida entregou a carga que anunciou?

  Este é o detector de máquina disputada, e ele veio depois de eu construir o
  errado — DUAS vezes, e a segunda foi restaurar a primeira sem perceber. A
  tentativa que insiste em voltar exige que 85% dos frames EM REPOUSO caiam num
  intervalo único: premissa boa para display real e FALSA para headless, que
  não tem display e não compõe frame quando nada muda. Numa máquina a 23% de
  carga ela reprovou três corridas seguidas, com a mediana ociosa em exatamente
  2× o vsync — que é o comportamento normal de uma página parada.

  A vazão é o sinal honesto porque mede TRABALHO FIXO: o gerador tem uma
  quantidade determinada de eventos para despejar, e quanto disso ele entregou
  na janela é medida direta de quanta CPU sobrou para o app.

  O piso de 90% saiu dos dados: máquina limpa dá 93–98%, sob um jogo em cinco
  núcleos deu 83–87%, e o corte cai no vão entre os dois grupos.
*/
const mVazao = String(relatorio.contadores).match(/vazão (\d+) ev\/s de (\d+)/);
if (mVazao) {
  const entregue = Number(mVazao[1]);
  const pedida = Number(mVazao[2]);
  if (entregue / pedida < 0.9) {
    console.log(
      `\nCORRIDA INVÁLIDA — o gerador entregou ${entregue} de ${pedida} ev/s ` +
        `(${Math.round((entregue / pedida) * 100)}%). O app foi medido sob ` +
        `menos carga do que o gate afirma cobrar, então nem PASS nem FAIL valem.`,
    );
    ws.close();
    chrome.kill();
    process.exit(1);
  }
}

console.log("\n===== RESULTADO =====");
for (const [k, v] of Object.entries(relatorio)) if (v) console.log(`${k}: ${v}`);

ws.close();
chrome.kill();
