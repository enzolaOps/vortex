/**
 * Toda utility usada no código PRODUZIU CSS?
 *
 * Esta é a quarta vez que uma classe morta atravessa typecheck, lint e a
 * bateria de testes sem um ruído:
 *
 *   `py-0.5`  — o ritmo de agrupamento existia no comentário e não na tela
 *   `size-5`  — avatar acoplado à escala de espaço por coincidência de valor
 *   `min-w-0` — a lei nº 3 desprotegida, com barra horizontal na coluna
 *   `w-80`    — a viewport do toast medindo 0px
 *
 * A causa é sempre a mesma, e é uma escolha deliberada do projeto: o `@theme`
 * faz `--spacing-*: initial` para apagar a escala default do Tailwind (lei
 * nº 4 — tornar impossível ganha de proibir). O efeito colateral é que toda
 * utility computada como `calc(var(--spacing) * N)` deixa de ser emitida —
 * silenciosamente, porque o Tailwind não avisa sobre classe que ele decidiu
 * não gerar.
 *
 * O lint anterior (`no-restricted-syntax` contra fracionária) tratava um
 * SINTOMA. Esta guarda trata a classe inteira do problema: se a string
 * aparece num `className` e não existe seletor correspondente no CSS
 * construído, reprova.
 *
 * Roda sobre o BUILD, não sobre o fonte — é a única forma de saber o que o
 * Tailwind realmente emitiu.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FONTE = join(RAIZ, "src");
const DIST = join(RAIZ, "dist", "assets");

/**
 * Classes que NÃO são utilities do Tailwind e não devem ser procuradas.
 *
 * `group` e `peer` são marcadores — existem para outras utilities lerem, e
 * nunca geram regra própria. O resto é utility de verdade e é conferido.
 */
const NAO_E_UTILITY = new Set(["group", "peer"]);

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, out);
    else if (nome.endsWith(".tsx") || nome.endsWith(".ts")) out.push(caminho);
  }
  return out;
}

/** O CSS construído, concatenado. */
function cssConstruido() {
  let alvo;
  try {
    alvo = readdirSync(DIST).filter((n) => n.endsWith(".css"));
  } catch {
    return null;
  }
  if (alvo.length === 0) return null;
  return alvo.map((n) => readFileSync(join(DIST, n), "utf8")).join("\n");
}

/**
 * Extrai candidatos a utility das strings literais de `className`.
 *
 * Só de `className` e das strings passadas a `cn()` dentro dele — variável e
 * template com interpolação ficam de fora, porque o nome final não é
 * conhecido aqui e um falso positivo derruba a confiança na guarda inteira.
 */
function candidatos(codigo) {
  const out = new Set();
  // `className="..."` e `className={cn("...", "...")}` — pega as literais.
  const blocos = codigo.match(/className=(?:"[^"]*"|{[^}]*})/gs) ?? [];

  for (const bloco of blocos) {
    // Operandos de COMPARAÇÃO não são classes: `estado === "pending" &&
    // "opacity-60"` tem duas literais e só a segunda vira CSS. Sem isto a
    // guarda acusa "pending" e "erro", e falso positivo derruba a confiança
    // nela inteira — que é o que a torna inútil.
    const limpo = bloco.replace(/[!=]==?\s*"[^"]*"/g, "");

    for (const literal of limpo.match(/"[^"$]*"/g) ?? []) {
      for (const bruto of literal.slice(1, -1).split(/\s+/)) {
        const classe = bruto.trim();
        if (!classe || NAO_E_UTILITY.has(classe)) continue;
        // Precisa parecer utility: letra ou variante, sem espaço.
        if (!/^[a-z[]/.test(classe)) continue;
        out.add(classe);
      }
    }
  }
  return out;
}

/** O seletor que o Tailwind emite — pontuação escapada com barra. */
function seletorDe(classe) {
  return `.${classe.replace(/[.:[\]/()#%,>+~*='"!&]/g, (c) => `\\${c}`)}`;
}

const css = cssConstruido();

if (css === null) {
  console.error(
    "utilities: dist/assets sem CSS. Rode `pnpm build` antes — esta guarda\n" +
      "confere o que o Tailwind EMITIU, e isso só existe depois do build.",
  );
  process.exit(1);
}

const mortas = new Map();
let total = 0;

for (const arquivo of arquivos(FONTE)) {
  const codigo = readFileSync(arquivo, "utf8");
  for (const classe of candidatos(codigo)) {
    total += 1;
    if (css.includes(seletorDe(classe))) continue;
    const curto = arquivo.slice(RAIZ.length).replace(/\\/g, "/");
    if (!mortas.has(classe)) mortas.set(classe, new Set());
    mortas.get(classe).add(curto);
  }
}

if (mortas.size === 0) {
  console.log(`utilities: ${total} classes conferidas, todas emitiram CSS.`);
  process.exit(0);
}

console.error(`\nutilities: ${mortas.size} classe(s) NÃO produziram CSS.\n`);
for (const [classe, arqs] of [...mortas].sort()) {
  console.error(`  ${classe}`);
  for (const a of arqs) console.error(`      ${a}`);
}
console.error(
  "\nEssas classes não existem na folha construída: o elemento não recebe\n" +
    "o estilo que o código diz que ele tem, e nada falha.\n\n" +
    "Causa quase sempre a mesma: `--spacing-*: initial` no @theme remove a\n" +
    "base do Tailwind v4, e utility computada como `calc(var(--spacing) * N)`\n" +
    "deixa de ser emitida. Use um degrau da escala (1–6) ou um CSS Module.\n",
);
process.exit(1);
