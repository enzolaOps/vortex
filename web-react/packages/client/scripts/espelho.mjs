/**
 * O design RENDERIZADO, em árvore, com o estilo computado de cada caixa.
 *
 * ⚠ **Este script existe porque o `espec.mjs` não bastava, e a falha dele tem
 * nome: ele lista VALORES, não ESTRUTURA.**
 *
 * O `espec` varre uma seção do design e devolve os valores distintos que ela
 * usa, já traduzidos para tokens. Isso matou a classe de erro "arredondei 28
 * para 24". Não mata a seguinte, que foi a que apareceu nas configurações de
 * canal: com uma LISTA de valores na mão, eu monto um modelo mental da
 * estrutura e preencho com o que a lista oferece — e onde o design não tem
 * nada, eu ponho o que parece certo.
 *
 * Foi assim que duas divisórias que não existem entraram na coluna de
 * navegação: uma embaixo do cabeçalho e uma em cima do rodapé. Nenhuma guarda
 * podia ver, porque uma borda a mais não é valor errado — é elemento a mais.
 *
 * A saída aqui é a árvore: cada caixa com fundo, borda, respiro, raio e tipo
 * COMPUTADOS pelo navegador, com a herança já resolvida. Implementar contra ela
 * é implementar contra o que o design É, não contra o que ele usa.
 *
 * Uso:
 *
 *   node scripts/espelho.mjs "<arquivo .dc.html>" "<texto âncora>" [profundidade]
 *
 * A âncora é um texto que aparece na tela que interessa — "Canal de texto",
 * "Quem pode acessar", "Nome do evento". O script sobe da âncora até a caixa
 * que tem largura de tela (>= 600px) e imprime a subárvore dela.
 *
 * ⚠ Ele precisa dos arquivos SERVIDOS por http: `file://` não deixa o CDP
 * avaliar no documento em vários casos, e o `support.js` do design é um módulo.
 * O script sobe o servidor sozinho no diretório do arquivo.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, basename, extname } from "node:path";

const CHROME =
  "C:\\Users\\lagun\\.cache\\puppeteer\\chrome\\win64-151.0.7922.47\\chrome-win64\\chrome.exe";
const PORT = 9334;
const HTTP = 4177;

const [, , arquivo, ancora, profundidadeMax = "4"] = process.argv;
if (!arquivo || !ancora) {
  console.error(
    'uso: node scripts/espelho.mjs "<arquivo .dc.html>" "<texto âncora>" [profundidade]',
  );
  process.exit(2);
}

/* ------------------------------------------------- servidor estático */

const RAIZ_HTML = dirname(arquivo);
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const servidor = createServer((req, res) => {
  const nome = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "");
  const caminho = join(RAIZ_HTML, nome);
  try {
    if (!statSync(caminho).isFile()) throw new Error("não é arquivo");
    res.writeHead(200, {
      "content-type": `${TIPOS[extname(caminho)] ?? "application/octet-stream"}; charset=utf-8`,
    });
    res.end(readFileSync(caminho));
  } catch {
    res.writeHead(404).end("não achado");
  }
});
await new Promise((ok) => servidor.listen(HTTP, "127.0.0.1", ok));

/* ------------------------------------------------------------ chrome */

const perfil = mkdtempSync(join(tmpdir(), "vortex-espelho-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${perfil}`,
    "--window-size=1600,1000",
    "--no-first-run",
    "--no-default-browser-check",
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
      /* Chrome ainda subindo. */
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
const { sessionId } = await enviar("Target.attachToTarget", {
  targetId,
  flatten: true,
});

const av = async (expr) => {
  const r = await enviar(
    "Runtime.evaluate",
    { expression: expr, awaitPromise: true, returnByValue: true },
    sessionId,
  );
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? "erro no page");
  }
  return r.result.value;
};

const url = `http://127.0.0.1:${HTTP}/${encodeURIComponent(basename(arquivo))}`;
await enviar("Page.navigate", { url }, sessionId);
await dorme(2200);

/* ------------------------------------------------------- a varredura */

const arvore = await av(`(() => {
  const ANCORA = ${JSON.stringify(ancora)};
  const MAX = ${Number(profundidadeMax)};

  const alvo = [...document.querySelectorAll("*")].find(
    (e) => e.children.length === 0 && (e.textContent || "").trim().includes(ANCORA),
  );
  if (!alvo) return { erro: "âncora não encontrada: " + ANCORA };

  /* Sobe até a caixa que é uma TELA: larga o bastante para ser a composição
     inteira, e não um dos cartões dentro dela. */
  let raiz = alvo;
  while (raiz.parentElement && raiz.getBoundingClientRect().width < 600) {
    raiz = raiz.parentElement;
  }

  const hex = (c) => {
    const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/.exec(c);
    if (!m) return c;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a === 0) return "-";
    const h =
      "#" + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, "0")).join("");
    return a === 1 ? h : h + " @" + Math.round(a * 100) + "%";
  };

  /* A borda é reportada LADO A LADO: o defeito que este script existe para
     pegar foi uma borda a mais em um lado só, e um resumo "1px solid" a
     esconderia. */
  const bordas = (s) => {
    const lados = ["Top", "Right", "Bottom", "Left"];
    const partes = [];
    for (const l of lados) {
      const w = parseFloat(s["border" + l + "Width"]);
      if (w > 0) partes.push(l[0].toLowerCase() + ":" + s["border" + l + "Width"] + " " + hex(s["border" + l + "Color"]));
    }
    return partes.length ? partes.join(" ") : "-";
  };

  const olhar = (e, nivel) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return null;
    const texto = [...e.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .slice(0, 26);
    return {
      tag: e.tagName.toLowerCase(),
      texto,
      caixa: Math.round(r.width) + "x" + Math.round(r.height),
      bg: hex(s.backgroundColor),
      borda: bordas(s),
      raio: s.borderRadius === "0px" ? "-" : s.borderRadius,
      pad: s.padding === "0px" ? "-" : s.padding,
      gap: s.gap === "normal" || s.rowGap === "normal" ? "-" : s.gap,
      tipo: s.fontSize + "/" + s.fontWeight,
      cor: hex(s.color),
      filhos:
        nivel >= MAX
          ? []
          : [...e.children].map((c) => olhar(c, nivel + 1)).filter(Boolean),
    };
  };

  return olhar(raiz, 0);
})()`);

if (arvore?.erro) {
  console.error(arvore.erro);
} else {
  console.log(`\n${basename(arquivo)} — âncora “${ancora}”\n`);
  const linha = (n, nivel) => {
    const recuo = "  ".repeat(nivel);
    const partes = [
      `${recuo}${n.tag}`,
      n.caixa,
      n.bg !== "-" ? `bg ${n.bg}` : "",
      n.borda !== "-" ? `borda ${n.borda}` : "",
      n.raio !== "-" ? `raio ${n.raio}` : "",
      n.pad !== "-" ? `pad ${n.pad}` : "",
      n.gap !== "-" ? `gap ${n.gap}` : "",
      n.texto ? `“${n.texto}”` : "",
    ].filter(Boolean);
    console.log(partes.join("  ·  "));
    for (const f of n.filhos) linha(f, nivel + 1);
  };
  linha(arvore, 0);
  console.log(
    "\nImplemente contra a ÁRVORE, não contra a lista de valores. Borda que\n" +
      "não aparece aqui não existe no design — e foi assim que duas divisórias\n" +
      "inventadas entraram na coluna de configurações de canal.\n",
  );
}

ws.close();
chrome.kill();
servidor.close();
process.exit(0);
