/**
 * O design e o app, renderizados lado a lado, comparados pela MÁQUINA.
 *
 * ⚠ **Este é o terceiro instrumento da mesma família, e ele existe porque os
 * dois primeiros deixavam a comparação comigo.**
 *
 *   `pnpm espec`     quais VALORES o design usa       (mata "arredondei 28→24")
 *   `pnpm espelho`   que ESTRUTURA o design tem       (mata "inventei uma régua")
 *   `pnpm confronto` o que DIFERE entre os dois       (mata "esqueci de conferir")
 *
 * A lista de divergências que motivou este arquivo é a prova de que os dois
 * primeiros não bastam: fundo, borda, raio e respiro entraram certos em três
 * telas seguidas, e tipografia e cor de texto ficaram erradas nas três — porque
 * o `espelho` COLETAVA as duas e não as imprimia. Eu conferia o que o relatório
 * mostrava, e o relatório mostrava metade.
 *
 * O conserto do relatório resolve aquele caso. Não resolve a classe: enquanto a
 * comparação for humana, ela cobre o que a pessoa lembra de olhar. Aqui as duas
 * árvores são percorridas em paralelo e cada propriedade é comparada — o que
 * sobra no relatório é exatamente o que está diferente, e nada mais.
 *
 * Uso:
 *
 *   node scripts/confronto.mjs [filtro]
 *
 * ⚠ **Regra de manutenção deste arquivo: NADA de crase dentro dos template
 * literals que viram código de página.** Uma crase num comentário fecha a
 * string, e isso quebrou este script quatro vezes — uma delas em silêncio, com
 * a conversão de cor ficando inerte enquanto o relatório seguia acusando
 * diferenças falsas. Foi por isso que o coletor saiu para `scripts/coletor.js`;
 * o que sobrou aqui de JS-em-string está sem crase de propósito.
 *
 * O app precisa estar SERVIDO e CONSTRUÍDO em `localhost:4174` — mesma regra do
 * `pnpm gate`, e pela mesma razão: medir o dev server é medir outra coisa.
 *
 * ⚠ **O que ele deliberadamente NÃO compara:** texto e largura. O texto do
 * design é fictício ("Júlia Prado", "4 / 25") e o do app vem do arnês; a
 * largura depende da coluna, que difere por construção. O que ele compara é o
 * que deveria ser igual: fundo, borda por lado, raio, respiro, gap, tamanho e
 * peso de fonte, entrelinha, família e cor.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join } from "node:path";

import { DISPENSAS, ROTEIROS } from "./confronto.roteiros.mjs";

const CHROME =
  "C:\\Users\\lagun\\.cache\\puppeteer\\chrome\\win64-151.0.7922.47\\chrome-win64\\chrome.exe";
const PORT = 9335;
const HTTP = 4178;

const filtro = process.argv[2];
const roteiros = filtro
  ? ROTEIROS.filter((r) => r.nome.toLowerCase().includes(filtro.toLowerCase()))
  : ROTEIROS;

if (roteiros.length === 0) {
  console.error(`nenhum roteiro casa com “${filtro}”`);
  process.exit(2);
}

/* ------------------------------------------------- servidor do design */

const RAIZ_HTML = dirname(roteiros[0].arquivo);
const TIPOS = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const servidor = createServer((req, res) => {
  const nome = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "");
  try {
    const caminho = join(RAIZ_HTML, nome);
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

const perfil = mkdtempSync(join(tmpdir(), "vortex-confronto-"));
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
      /* subindo */
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

async function abaNova() {
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
      throw new Error(
        r.exceptionDetails.exception?.description ?? "erro na página",
      );
    }
    return r.result.value;
  };
  const ir = (url) => enviar("Page.navigate", { url }, sessionId);
  const fechar = () => enviar("Target.closeTarget", { targetId });
  return { av, ir, fechar };
}

/* ------------------------------------------- o coletor, um só para os dois */

/**
 * O coletor vive em `scripts/coletor.js` e é injetado como TEXTO.
 *
 * ⚠ **Ele estava aqui dentro, num template literal, e eu quebrei este script
 * três vezes por causa disso.** Uma crase num comentário fecha a string; `\d`
 * numa regex precisa virar `\d`. O segundo erro passou despercebido: a
 * conversão de oklab ficou inerte e o relatório seguiu acusando diferença onde
 * o pixel era o mesmo — instrumento quebrado que parece funcionar.
 *
 * Num arquivo, é JS normal, com o editor conferindo. A MESMA função roda nos
 * dois lados: duas cópias seria a armadilha do `corDeFundoDeMatiz`, em que a
 * que ficou para trás fazia o teste medir um programa que não existia mais.
 */
const COLETOR = readFileSync(new URL("./coletor.js", import.meta.url), "utf8");

/* --------------------------------------------------------- a comparação */

/** Propriedades comparadas, e o rótulo que aparece no relatório. */
const CAMPOS = [
  ["bg", "fundo"],
  ["borda", "borda"],
  ["raio", "raio"],
  ["pad", "respiro"],
  ["gap", "gap"],
  ["tipo", "tipo"],
  ["entrelinha", "entrelinha"],
  ["fonte", "fonte"],
  ["cor", "cor"],
];

/**
 * Nós que um lado tem e o outro deliberadamente não tem.
 *
 * ⚠ **A poda era de UM LADO SÓ, e isso reprovava as páginas de servidor em
 * bloco.** `pular` tira nós do DESIGN — a omissão declarada, o banner de
 * dessincronização. Só que a dívida corre nas duas direções: as nossas páginas
 * de servidor carregam um `Banner` de pendência que o design não tem (sem ele,
 * cartões que não mudam parecem quebrados) e um rodapé dizendo o que o
 * protocolo não guarda. Os dois são ACRÉSCIMOS deliberados, e cada um
 * desalinhava a árvore inteira a partir do primeiro filho — em Modelo isso
 * sozinho produzia 34 "diferenças", nenhuma delas real.
 *
 * `pularApp` é o simétrico, com a mesma disciplina: motivo escrito no roteiro,
 * e o que não estiver nomeado continua reprovando.
 *
 * ⚠ **Isto NÃO é uma válvula de escape, e a diferença está no default.** Sem
 * ela, uma omissão declarada (o banner de dessincronização, que depende de
 * dado que o protocolo não tem) desalinha a árvore inteira a partir dali e
 * afoga as diferenças de verdade em ruído posicional. Com ela, a omissão é
 * NOMEADA no roteiro — e tudo o que não estiver nomeado continua reprovando.
 *
 * A regra é a mesma de `EXCECOES` no contraste: a lista precisa de motivo e o
 * que não está nela falha.
 */
function podar(filhos, pular) {
  if (!pular || pular.length === 0) return filhos;
  /*
    ⚠ **Casamento EXATO por padrão, e `~` para "contém".**

    A primeira versão usava `includes` sempre, e "Permissões" podou três nós de
    uma vez — o título, o subtítulo que menciona "Permissões avançadas" e o
    cartão de atalho. Um filtro largo demais é pior que nenhum: ele esconde
    exatamente o que o confronto existe para mostrar, e em silêncio.
  */
  return filhos.filter(
    (f) =>
      !pular.some((t) =>
        t.startsWith("~")
          ? (f.todo || "").includes(t.slice(1))
          : (f.todo || "") === t,
      ),
  );
}

function comparar(d, a, caminho, saida, pular, pularApp, soFilhos) {
  if (!d || !a) return;
  const onde = caminho || d.tag;

  /*
    ⚠ **`soFilhos` compara os BLOCOS e não a raiz, e não é preguiça.** Nas
    páginas de configuração as duas raízes são caixas de PAPÉIS diferentes: do
    lado do design é o rolável do pane, que carrega o respiro da tela e o
    título; do nosso é a página dentro de um rolável que a casca desenha. Elas
    nunca terão o mesmo respiro nem a mesma altura, e comparar as duas produzia
    três linhas de ruído por categoria — trinta e nove no total — encobrindo as
    diferenças reais logo abaixo. O que os dois lados desenharam igual são os
    blocos, e é neles que a comparação começa.
  */
  if (soFilhos) {
    const dRaiz = podar(d.filhos, pular);
    const aRaiz = podar(a.filhos, pularApp);
    if (dRaiz.length !== aRaiz.length) {
      saida.push({
        onde,
        texto: d.texto || a.texto,
        rotulo: "nº de blocos",
        design: String(dRaiz.length),
        app: String(aRaiz.length),
      });
      return;
    }
    dRaiz.forEach((f, i) =>
      comparar(f, aRaiz[i], `${f.tag}[${i}]`, saida, pular, pularApp, false),
    );
    return;
  }

  const alturaBate = Math.abs(d.alt - a.alt) <= 2;

  for (const [chave, rotulo] of CAMPOS) {
    /* Cor vinda de dado não é comparável — ver `dado` no coletor. */
    if ((chave === "cor" || chave === "bg") && (d.dado || a.dado)) continue;
    /*
      ⚠ **`gap` só conta quando a ALTURA não bate.**

      O design espaça filhos com margem e nós com `gap`; o valor computado
      difere sempre, e o resultado na tela é o mesmo. Reportar isso em toda
      caixa é ruído permanente — e guarda com falso positivo é guarda que se
      aprende a ignorar, que foi o que aconteceu com o `pnpm utilities` antes
      de ele ganhar mutação. Quando o espaçamento realmente diverge, a altura
      denuncia, e aí o gap aparece junto para dizer onde mexer.
    */
    if (chave === "gap" && alturaBate) continue;
    if (d[chave] !== a[chave]) {
      saida.push({ onde, texto: d.texto || a.texto, rotulo, design: d[chave], app: a[chave] });
    }
  }

  /*
    A altura é comparada com folga de 2px — e SÓ quando os dois lados carregam
    aproximadamente o mesmo tanto de texto.

    ⚠ **Sem essa segunda condição, altura era 28 das 65 linhas do relatório, e
    nenhuma delas era uma diferença de desenho.** O cabeçalho deste arquivo já
    diz que TEXTO não se compara — o do design é fictício e o nosso vem do
    arnês —, mas a altura de um parágrafo É o texto: "O volume aqui é o volume
    de origem do som" quebra em duas linhas e a nossa frase equivalente em uma,
    e o relatório chamava isso de diferença de 13px.

    O corte é proporcional e frouxo (30%): quem tem quase o mesmo texto e mede
    diferente tem mesmo um problema de caixa — que é o caso que a checagem
    existe para pegar.
  */
  const dTexto = (d.todo || "").length;
  const aTexto = (a.todo || "").length;
  const textoComparavel =
    Math.abs(dTexto - aTexto) <= 0.3 * Math.max(dTexto, aTexto, 1);
  if (textoComparavel && Math.abs(d.alt - a.alt) > 2) {
    saida.push({ onde, texto: d.texto || a.texto, rotulo: "altura", design: d.alt + "px", app: a.alt + "px" });
  }

  const dFilhos = podar(d.filhos, pular);
  const aFilhos = podar(a.filhos, pularApp);
  if (dFilhos.length !== aFilhos.length) {
    saida.push({
      onde,
      texto: d.texto || a.texto,
      rotulo: "nº de filhos",
      design: String(dFilhos.length),
      app: String(aFilhos.length),
    });
    return; /* alinhar filhos depois de um descasamento produz ruído. */
  }
  dFilhos.forEach((f, i) =>
    comparar(f, aFilhos[i], `${onde} > ${f.tag}[${i}]`, saida, pular, pularApp),
  );
}

/* ------------------------------------------------------------- execução */

let totalDeDiferencas = 0;

for (const r of roteiros) {
  const aba = await abaNova();

  await aba.ir(`http://127.0.0.1:${HTTP}/${encodeURIComponent(basename(r.arquivo))}`);
  await dorme(2200);
  for (const alvo of r.cliques) {
    /*
      ⚠ **O casamento olha o PRIMEIRO NÓ DE TEXTO, e não só a folha.** A versão
      anterior exigia `children.length === 0`, e por isso não achava metade dos
      itens de navegação das configurações de servidor: no design eles são um
      `div` com o rótulo solto MAIS um `span` com o contador, ou seja
      `textContent` vale "Emoji24/50" e `children.length` vale 1. Sete das
      treze categorias eram inclicáveis — e o sintoma era o roteiro comparar a
      página que já estava aberta, calado, contra a tela errada.
    */
    const achado = await aba.av(`(() => {
      const t = ${JSON.stringify(alvo)};
      const rotulo = (x) => {
        const p = x.firstChild;
        return p && p.nodeType === 3
          ? p.textContent.trim()
          : (x.textContent || "").trim();
      };
      const e = [...document.querySelectorAll("*")].find(
        (x) => x.children.length <= 1 && rotulo(x) === t);
      if (!e) return false;
      (e.closest("[onclick],button,a") ?? e).click();
      return true;
    })()`);
    if (achado !== true) {
      console.error(`  ⚠ ${r.nome}: não achei “${alvo}” para clicar no design`);
    }
    await dorme(900);
  }
  /*
    ⚠ **`raizDesign` existe porque o escalador por LARGURA não mira.** Ele sobe
    do texto da âncora até o primeiro ancestral da largura declarada — e numa
    tabela a LINHA tem a largura da tabela. Oito das treze categorias de
    servidor acabaram comparando uma linha contra uma página inteira, e o
    relatório então dizia "nº de filhos: design 5 · app 2" sobre dois nós que
    não são a mesma coisa. Quem sabe qual caixa quer, diz; o escalador
    continua para quem não sabe.

    ⚠ **Montado por CONCATENAÇÃO, e a regra do topo deste arquivo já avisava.**
    A primeira versão pôs um template literal ANINHADO aqui; a crase dele
    fechou a string e o script parou de carregar. Quinta vez que essa
    armadilha morde — por isso o trecho nasce fora do literal.
  */
  const trechoDaRaiz =
    r.raizDesign === undefined
      ? ""
      : "const escolhida = (() => {" +
        r.raizDesign +
        "})(); if (!escolhida) return { erro: 'raizDesign nao achou nada' };" +
        " return olhar(escolhida, 0, " +
        String(r.profundidade) +
        ");";

  const doDesign = await aba.av(`(async () => {
    ${COLETOR}
    ${trechoDaRaiz}
    const alvo = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && (e.textContent || "").trim().includes(${JSON.stringify(r.ancora ?? "")}));
    if (!alvo) return { erro: "âncora não achada" };
    /*
      ⚠ **Coluna estreita não chega pelo heurístico de largura.** O rail tem 72
      e a coluna de canais 248; exigir 600 faz as duas subirem até a tela
      inteira, e o confronto compara o app contra a composição errada. Quando o
      roteiro sabe a largura do alvo, ele a informa e o escalador mira nela.
    */
    const larguraAlvo = ${r.larguraDoDesign ?? "null"};
    let raiz = alvo;
    const vistas = [];
    if (larguraAlvo !== null) {
      while (raiz.parentElement) {
        const w = Math.round(raiz.getBoundingClientRect().width);
        vistas.push(w);
        if (Math.abs(w - larguraAlvo) <= 2 && raiz.children.length >= 1) break;
        raiz = raiz.parentElement;
      }
      const w = Math.round(raiz.getBoundingClientRect().width);
      if (Math.abs(w - larguraAlvo) > 2) {
        return { erro: "nenhum ancestral com largura " + larguraAlvo + "; vi " + vistas.join(", ") };
      }
    } else {
      while (raiz.parentElement && (raiz.getBoundingClientRect().width < 600 || raiz.children.length < 2)) {
        raiz = raiz.parentElement;
      }
    }
    for (let i = 0; i < ${r.subir}; i++) if (raiz.parentElement) raiz = raiz.parentElement;
    return olhar(raiz, 0, ${r.profundidade});
  })()`);

  await aba.ir(r.app);
  await dorme(2500);
  /* A sessão do arnês: o portão vem antes do shell, e sem ela o app pára na
     tela de login. Mesma semeadura do `pnpm gate`. */
  await aba.av(`localStorage.setItem('vortex.sessao', JSON.stringify({
    _id:'confronto', token:'confronto', user_id:'01JQ0000000000000001000000'})), 1`);
  await aba.ir(r.app);
  await dorme(2800);
  const doApp = await aba.av(`(async () => {
    ${COLETOR}
    ${r.preparar}
    /*
      raiz e EXPRESSAO, nao seletor — ver a nota no topo do roteiro.
      (Sem crase aqui: este bloco vive dentro de um template literal, e uma
      crase fecha a string. Ja quebrou este script quatro vezes.)
    */
    const raiz = (() => { ${r.raiz} })();
    if (!raiz) return { erro: "raiz não achada" };
    return olhar(raiz, 0, ${r.profundidade});
  })()`);

  await aba.fechar();

  console.log(`\n\x1b[1m${r.nome}\x1b[0m`);
  if (doDesign?.erro || doApp?.erro) {
    console.log(`  ⚠ ${doDesign?.erro ?? ""} ${doApp?.erro ?? ""}`.trimEnd());
    totalDeDiferencas += 1;
    continue;
  }

  const bruto = [];
  comparar(doDesign, doApp, "", bruto, r.pular, r.pularApp, r.soFilhos);

  /*
    As divergências adotadas saem do relatório, e a CONTAGEM delas fica — ver
    `DISPENSAS`. Sem a contagem, a lista viraria depósito: entrada que parou de
    casar sumiria sem ninguém notar, e a dispensa passaria a esconder um
    defeito novo em vez da decisão que ela registra.
  */
  const saida = bruto.filter(
    (d) =>
      !DISPENSAS.some(
        (x) => x.rotulo === d.rotulo && x.design === d.design && x.app === d.app,
      ),
  );
  const dispensadas = bruto.length - saida.length;
  if (saida.length === 0) {
    console.log(
      dispensadas === 0
        ? "  sem diferenças."
        : `  sem diferenças (${dispensadas} dispensada(s) por decisão).`,
    );
    continue;
  }
  totalDeDiferencas += saida.length;
  if (dispensadas > 0) {
    console.log(`  (${dispensadas} dispensada(s) por decisão)`);
  }
  for (const d of saida) {
    const rotulo = d.texto ? ` “${d.texto}”` : "";
    console.log(
      `  ${d.onde}${rotulo}\n      ${d.rotulo}: design ${d.design}  ·  app ${d.app}`,
    );
  }
}

console.log(
  totalDeDiferencas === 0
    ? "\nconfronto: as telas registradas batem com o design.\n"
    : `\nconfronto: ${totalDeDiferencas} diferença(s).\n` +
        "Cada uma é design contra app na MESMA posição da árvore. Texto e\n" +
        "largura não são comparados de propósito — ver o topo do arquivo.\n",
);

ws.close();
chrome.kill();
servidor.close();
process.exit(totalDeDiferencas === 0 ? 0 : 1);
