/**
 * Espaçamento e raio dentro de CSS Module saem da ESCALA?
 *
 * A lei nº 4 — zero valor mágico — tinha mecanismo em `className` e nenhum
 * dentro de módulo. A auditoria de design encontrou ~8 valores fora de escala
 * ali, e o padrão foi o mesmo em todos: alguém precisou de menos que
 * `--vx-space-1` e escreveu `2px` cru, porque o meio-degrau não existia.
 *
 * O conserto foi das duas pontas: `--vx-space-02` e `--vx-radius-02` passaram a
 * existir, e esta guarda impede que o nono apareça.
 *
 * **Ela confere PROPRIEDADE, não valor.** `inline-size: 288px` num hover card
 * não é valor mágico — é a largura daquele componente, e empurrá-la para uma
 * escala de espaçamento seria pior que deixá-la. Por isso a lista de
 * propriedades é fechada e curta: só o que a escala realmente governa.
 *
 * `1px` passa: hairline não é degrau de escala, é a menor linha que existe.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FONTE = join(RAIZ, "src");

/**
 * As propriedades que a escala governa.
 *
 * `inline-size`, `block-size` e `inset-*` ficam DE FORA de propósito: são
 * dimensão de componente, e componente tem a largura que o desenho pede.
 */
const GOVERNADAS =
  /^\s*(padding|margin|gap|row-gap|column-gap|border-radius)(-(block|inline)(-(start|end))?)?\s*:\s*([^;]+);/;

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, out);
    else if (nome.endsWith(".module.css")) out.push(caminho);
  }
  return out;
}

const fora = [];
let conferidas = 0;

for (const arquivo of arquivos(FONTE)) {
  const linhas = readFileSync(arquivo, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    const m = GOVERNADAS.exec(linha);
    if (!m) return;
    conferidas += 1;
    const valor = m[6];
    // `1px` é hairline, `0` é ausência, e `var(...)` é a escala.
    const soltos = [...valor.matchAll(/(?<![\w-])(\d+(?:\.\d+)?)px/g)]
      .map((x) => x[1])
      .filter((n) => n !== "1");
    if (soltos.length === 0) return;
    fora.push({
      arquivo: arquivo.slice(RAIZ.length).replace(/\\/g, "/"),
      linha: i + 1,
      texto: linha.trim(),
    });
  });
}

if (fora.length === 0) {
  console.log(
    `escala: ${conferidas} declarações de espaçamento e raio conferidas, ` +
      `todas na escala.`,
  );
  process.exit(0);
}

console.error(`\nescala: ${fora.length} valor(es) fora da escala.\n`);
for (const f of fora) console.error(`  ${f.arquivo}:${f.linha}  ${f.texto}`);
console.error(
  "\nEspaçamento e raio vêm da escala do projeto (`--vx-space-0..7`,\n" +
    "`--vx-radius-0..5`). Se o degrau que você precisa não existe, essa é a\n" +
    "conversa — acrescentar o degrau, não escapar dele em um arquivo.\n\n" +
    "`1px` passa: hairline não é degrau de escala.\n",
);
process.exit(1);
