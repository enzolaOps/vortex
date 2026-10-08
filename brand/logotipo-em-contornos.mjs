/**
 * Converte a palavra "Vortex" de `vortex-logotipo.svg` de `<text>` em contornos.
 *
 *   node brand/logotipo-em-contornos.mjs caminho/para/plus-jakarta-sans-latin-700-normal.woff
 *
 * Um `<img>` não carrega fontes: com `<text>` o navegador cai para a fonte do
 * sistema. Depende de `opentype.js` (não é dependência do repositório; rode com
 * `npm i opentype.js @fontsource/plus-jakarta-sans` fora da árvore). A fonte é
 * Plus Jakarta Sans 700, tamanho 38, espaçamento -0.6, linha de base y=45.5.
 * É idempotente: se o SVG já não tem `<text>`, não faz nada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import opentype from "opentype.js";

const fonte = process.argv[2];
if (!fonte) {
  console.error("Uso: node brand/logotipo-em-contornos.mjs <fonte.woff|ttf|otf>");
  process.exit(1);
}

const alvo = resolve(dirname(fileURLToPath(import.meta.url)), "vortex-logotipo.svg");
const svg = readFileSync(alvo, "utf8");
const texto = svg.match(/<text[^>]*>([^<]*)<\/text>/);
if (!texto) {
  console.log("vortex-logotipo.svg já está em contornos.");
  process.exit(0);
}

const f = opentype.parse(readFileSync(fonte).buffer.slice(0));
const [X, Y, TAMANHO, ESPACO] = [78, 45.5, 38, -0.6];
const escala = TAMANHO / f.unitsPerEm;
// Sem shaping (GSUB): a palavra não tem ligaduras, e o shaping do opentype.js
// falha em algumas fontes. Só cmap + kerning.
const glifos = [...texto[1]].map((c) => f.charToGlyph(c));

let x = X;
let d = "";
glifos.forEach((g, i) => {
  d += g.getPath(x, Y, TAMANHO).toPathData(2);
  const kern = i < glifos.length - 1 ? f.getKerningValue(g, glifos[i + 1]) : 0;
  x += (g.advanceWidth + kern) * escala + ESPACO;
});

const novo = svg
  .replace(/<!--[\s\S]*?-->\s*/, "<!-- Símbolo à esquerda; palavra em Plus Jakarta Sans 700 convertida em contornos. -->\n  ")
  .replace(/<text[\s\S]*?<\/text>/, `<path fill="#F2F4FA" d="${d}"/>`);
writeFileSync(alvo, novo);
console.log(`Palavra convertida: ${glifos.length} glifos, largura final ${x.toFixed(1)} de 248.`);
