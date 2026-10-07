// Guarda do Vidro: `backdrop-filter` só pode existir em src/ui/ds/PainelVidro.module.css.
// Desfoque de fundo repinta o que está atrás a cada frame; espalhar a receita
// pelo app tira de vista o custo e faz o vidro divergir em cada cópia.
//   node scripts/vidro.mjs   falha (exit 1) se achar a propriedade em outro CSS
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
export const DONO = "src/ui/ds/PainelVidro.module.css";

/** Comentário não é declaração: o texto que EXPLICA a regra pode citá-la. */
export function semComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const DECLARACAO = /(^|[\s;{])(-webkit-)?backdrop-filter\s*:/;

/** Linhas (1-based) que declaram `backdrop-filter`, com ou sem prefixo. */
export function linhasComBackdrop(css) {
  return semComentarios(css)
    .split("\n")
    .flatMap((linha, i) => (DECLARACAO.test(linha) ? [i + 1] : []));
}

function* arquivosCss(pasta) {
  for (const e of readdirSync(pasta, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "dist") continue;
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) yield* arquivosCss(caminho);
    else if (e.name.endsWith(".css")) yield caminho;
  }
}

/** Achados fora do dono: `caminho:linha`. */
export function violacoes(base = raiz) {
  const achados = [];
  for (const arquivo of arquivosCss(join(base, "src"))) {
    const rel = relative(base, arquivo).replaceAll("\\", "/");
    if (rel === DONO) continue;
    for (const linha of linhasComBackdrop(readFileSync(arquivo, "utf8"))) achados.push(`${rel}:${linha}`);
  }
  return achados;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const achados = violacoes();
  if (achados.length > 0) {
    console.error(`backdrop-filter fora de ${DONO}:\n${achados.map((a) => `  ${a}`).join("\n")}`);
    process.exit(1);
  }
  console.log("vidro: backdrop-filter só em PainelVidro.");
}
