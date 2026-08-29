/**
 * O que o design PEDE, em números, já traduzido para a linguagem do projeto.
 *
 * ⚠ **Esta ferramenta nasce da causa raiz de nove divergências de uma rodada
 * só, e a causa não era desatenção — era método.**
 *
 * Os arquivos do Claude Design são HTML que roda, com todos os valores
 * literais em `style` inline. Isso parece ideal e esconde uma armadilha: quem
 * lê o arquivo lê a INTENÇÃO ("botão pequeno com um emoji") e escreve a versão
 * dele a partir dela. `width:28px` vira `--vx-space-5`, que é 24. Quatro
 * pixels perdidos, nove vezes, cada uma com uma justificativa razoável.
 *
 * O que este script faz é tirar o julgamento do caminho: ele varre o arquivo
 * do design, junta os valores DISTINTOS que ele usa, e diz, para cada um, qual
 * token ou degrau do projeto corresponde — ou que não corresponde a nenhum, e
 * por quê isso é uma decisão a tomar em vez de um arredondamento a fazer.
 *
 * Ele NÃO gera código. A saída é uma lista de conferência para quem
 * implementa, e a mesma lista serve de revisão depois: rodar de novo e
 * comparar com o que foi escrito é barato.
 *
 * Uso:
 *
 *   node scripts/espec.mjs "<caminho do .dc.html>" [filtro]
 *
 * O filtro casa com o rótulo da seção — `espec.mjs arquivo.dc.html toolbar`
 * imprime só a barra de hover.
 *
 * ⚠ **Ele não sabe de layout.** Fluxo, quebra, rolagem, âncora e container
 * query não estão num `style` inline e continuam sendo leitura humana. O que
 * ele cobre é o que se erra por descuido: medida, cor, raio, peso e fonte.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

const [, , caminho, filtro] = process.argv;
if (!caminho) {
  console.error(
    'uso: node scripts/espec.mjs "<caminho do .dc.html>" [filtro de seção]',
  );
  process.exit(2);
}

/* ------------------------------------------------------- a camada 1 */

const TOKENS_CSS = readFileSync(join(RAIZ, "src/styles/tokens.css"), "utf8");

/**
 * A camada 1 lida DE TRÁS PARA A FRENTE: hex → nome do token.
 *
 * Só o bloco escuro, que é o `:root`. O claro é derivado da mesma semente e
 * um mapa com os dois teria a mesma cor apontando para dois nomes.
 */
function paletaEscura() {
  const raiz = TOKENS_CSS.slice(
    TOKENS_CSS.indexOf(":root {"),
    TOKENS_CSS.indexOf('[data-theme="light"]'),
  );
  const porHex = new Map();
  for (const m of raiz.matchAll(/(--vx-[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    const hex = m[2].toLowerCase();
    // O primeiro nome ganha: `--vx-status-dnd` repete `--vx-danger` de
    // propósito, e o nome útil para quem implementa é o semântico original.
    if (!porHex.has(hex)) porHex.set(hex, m[1]);
  }
  return porHex;
}

/**
 * Escalas em px → nome do degrau.
 *
 * ⚠ O sufixo casa PALAVRA e não só dígito: espaço e raio são numéricos
 * (`--vx-space-3`), mas a escala de TIPO é nomeada (`--vx-size-lg`). A
 * primeira versão só casava número e acusou `font-size:15px` de estar fora da
 * escala quando `--vx-size-lg` é exatamente 15 — uma guarda que grita onde não
 * há problema é uma guarda que se aprende a ignorar.
 */
function escala(prefixo) {
  const porValor = new Map();
  for (const m of TOKENS_CSS.matchAll(
    new RegExp(`(--vx-${prefixo}-[\\w]+):\\s*(\\d+)px\\s*;`, "g"),
  )) {
    if (!porValor.has(Number(m[2]))) porValor.set(Number(m[2]), m[1]);
  }
  return porValor;
}

const PALETA = paletaEscura();
const ESPACO = escala("space");
const RAIO = escala("radius");
const TIPO = escala("size");

/* ------------------------------------------- o arquivo do design */

const html = readFileSync(caminho, "utf8");

/**
 * As seções do design, pelo rótulo em caixa alta que ele põe acima de cada
 * espécime.
 *
 * O Claude Design escreve esses rótulos como um `div` com
 * `text-transform:uppercase` — é a única estrutura de navegação que o arquivo
 * tem, e é a mesma que a pessoa usa para se achar nele.
 */
function secoes() {
  const marcas = [];
  const re = /text-transform:uppercase[^"]*">([^<]{3,60})</g;
  for (const m of re.exec.constructor ? html.matchAll(re) : []) {
    marcas.push({ rotulo: m[1].trim(), em: m.index });
  }
  if (marcas.length === 0) return [{ rotulo: "(arquivo inteiro)", trecho: html }];

  return marcas.map((marca, i) => ({
    rotulo: marca.rotulo,
    trecho: html.slice(marca.em, marcas[i + 1]?.em ?? html.length),
  }));
}

/** Toda declaração `prop: valor` dos `style` inline de um trecho. */
function declaracoes(trecho) {
  const out = [];
  for (const m of trecho.matchAll(/style(?:-hover)?="([^"]*)"/g)) {
    for (const par of m[1].split(";")) {
      const i = par.indexOf(":");
      if (i < 0) continue;
      out.push([par.slice(0, i).trim(), par.slice(i + 1).trim()]);
    }
  }
  return out;
}

/* ------------------------------------------------------ a tradução */

const DIMENSAO = new Set(["width", "height", "min-width", "max-width", "min-height", "max-height"]);
const RESPIRO = new Set(["padding", "margin", "gap", "row-gap", "column-gap"]);

function traduzirCor(valor) {
  const hex = valor.trim().toLowerCase();
  const token = PALETA.get(hex);
  if (token) return { ok: true, nota: `var(${token})` };
  if (/^rgba?\(255\s*,\s*255\s*,\s*255/.test(hex) || /^rgba?\(0\s*,\s*0\s*,\s*0/.test(hex)) {
    return {
      ok: true,
      nota: "VÉU — literal, e é o certo: véu compõe sobre qualquer superfície",
    };
  }
  if (/^#[0-9a-f]{3,8}$/.test(hex)) {
    return { ok: false, nota: "⚠ HEX FORA DA PALETA — token novo, ou decisão a tomar" };
  }
  return null;
}

function traduzirPx(prop, valor) {
  const n = Number(valor.replace("px", ""));
  if (!Number.isFinite(n)) return null;

  if (prop === "border-radius") {
    // Qualquer coisa acima de ~500 é pílula, e o design escreve 999.
    if (n >= 500) return { ok: true, nota: "var(--vx-radius-5) — pílula" };
    const t = RAIO.get(n);
    return t
      ? { ok: true, nota: `var(${t})` }
      : { ok: false, nota: `⚠ ${n}px FORA da escala de raio — acrescente o degrau, não arredonde` };
  }
  if (prop === "font-size") {
    const t = TIPO.get(n);
    return t
      ? { ok: true, nota: `var(${t})` }
      : { ok: false, nota: `⚠ ${n}px FORA da escala de tipo` };
  }
  if (RESPIRO.has(prop)) {
    /* `1px` é hairline e `0` é ausência — os dois passam no `pnpm escala`, e
       acusá-los aqui seria a guarda discordando da guarda. */
    if (n === 0 || n === 1) return { ok: true, nota: `${n}px — hairline/zero, permitido` };
    const t = ESPACO.get(n);
    return t
      ? { ok: true, nota: `var(${t})` }
      : {
          ok: false,
          nota: `⚠ ${n}px FORA da escala de espaço — o \`pnpm escala\` vai reprovar`,
        };
  }
  if (DIMENSAO.has(prop)) {
    /*
      Dimensão de componente NÃO passa pela escala, e é aqui que a rodada
      passada errou.

      `pnpm escala` deixa `inline-size`/`block-size` de fora de propósito: a
      caixa tem o tamanho que o desenho pede. Escrever `28px` é legítimo;
      trocar por `--vx-space-5` (24) porque "é o degrau mais próximo" é o que
      perdeu quatro pixels em nove alvos.
    */
    const t = ESPACO.get(n);
    return {
      ok: true,
      nota:
        `${n}px — DIMENSÃO de componente, escreva o número` +
        (t ? ` (não confunda com ${t}, que é respiro)` : ""),
    };
  }
  return null;
}

/** Traduz cada componente de um atalho e junta as notas. */
function juntar(prop, partes) {
  const notas = partes.map((x) => traduzirPx(prop, x));
  return {
    ok: notas.every((n) => !n || n.ok),
    nota: notas.map((n, i) => `${partes[i]}→${n ? n.nota.split(" ")[0] : "?"}`).join("  "),
  };
}

/* --------------------------------------------------------- saída */

const FAMILIAS = [
  ["Medidas", (p) => DIMENSAO.has(p)],
  ["Respiro", (p) => RESPIRO.has(p)],
  ["Raio", (p) => p === "border-radius"],
  ["Tipo", (p) => p === "font-size" || p === "font-weight" || p === "line-height"],
  ["Cor", (p) => p === "color" || p === "background" || p === "background-color" || p === "border"],
];

let problemas = 0;

for (const secao of secoes()) {
  if (filtro && !secao.rotulo.toLowerCase().includes(filtro.toLowerCase())) continue;

  const decls = declaracoes(secao.trecho);
  if (decls.length === 0) continue;

  const linhas = [];
  for (const [familia, casa] of FAMILIAS) {
    const vistos = new Map();
    for (const [prop, valor] of decls) {
      if (!casa(prop)) continue;
      const chave = `${prop}: ${valor}`;
      if (vistos.has(chave)) {
        vistos.get(chave).n += 1;
        continue;
      }
      /*
        Atalho com vários valores vira um por um.

        `padding: 16px 18px 20px` é três decisões, e a primeira versão não
        traduzia nenhuma — passava direto porque a string não terminava em
        `px`. É onde os números mais interessantes se escondiam.
      */
      const partes = valor.split(/\s+/).filter((x) => /^-?[\d.]+px$/.test(x));
      const t =
        traduzirCor(valor) ??
        (partes.length === 1
          ? traduzirPx(prop, partes[0])
          : partes.length > 1
            ? juntar(prop, partes)
            : null);
      vistos.set(chave, { chave, n: 1, t });
    }
    if (vistos.size === 0) continue;
    linhas.push(`  ${familia}`);
    for (const v of [...vistos.values()].sort((a, b) => b.n - a.n)) {
      const nota = v.t ? `  →  ${v.t.nota}` : "";
      if (v.t && !v.t.ok) problemas += 1;
      linhas.push(`    ${String(v.n).padStart(3)}×  ${v.chave.padEnd(34)}${nota}`);
    }
  }

  if (linhas.length === 0) continue;
  console.log(`\n[1m${secao.rotulo}[0m`);
  console.log(linhas.join("\n"));
}

console.log(
  `\n${problemas} valor(es) do design sem correspondência direta no projeto.\n` +
    "Cada um é uma DECISÃO — token novo, degrau novo, ou dimensão de\n" +
    "componente escrita como número. Arredondar para o degrau vizinho em\n" +
    "silêncio é o que produziu as divergências desta rodada.\n",
);
