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
import { dirname, join, resolve } from "node:path";

const BARRA = new RegExp(String.fromCharCode(92,92), "g");

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

/*
  E o sentido INVERSO: classe de CSS Module que perdeu o consumidor.

  A guarda acima pega `className` que não produz CSS. Este bloco pega CSS que
  nenhum `className` consome — o outro lado da mesma moeda, e um que a guarda
  original não via.

  Nasceu na hora: a lâmina passou a carregar "não lida" na lista de canais, o
  `.ponto` de 8px que fazia esse trabalho saiu do TSX, e o CSS dele ficou.
  Typecheck, lint, 177 testes e a própria guarda de utilities passaram sem um
  ruído — regra morta não quebra nada, só engorda a folha e mente sobre o que a
  interface faz para quem for ler o arquivo depois.

  A busca é por `css.nome` e `css["nome"]` no TSX irmão. Acesso dinâmico
  (`css[variavel]`) não é rastreável, então um módulo que faça isso é
  dispensado inteiro em vez de gerar acusação falsa — guarda que erra é guarda
  que alguém desliga.
*/
const orfas = new Map();

/*
  Quem importa cada `.module.css`, e com que nome local.

  A primeira versao conferia so o TSX IRMAO, e isso e um falso positivo
  esperando para acontecer: `CabecalhoDeCanal.module.css` tem uma `.coluna`
  usada de `App.tsx`, via `import cssCabecalho from "..."`. A guarda a acusou
  de morta — e a regra em questao e justamente a que carrega o `block-size:
  100%` sem o qual o virtualizador monta as dez mil linhas de uma vez.

  Guarda que erra e guarda que alguem desliga, e essa teria sido desligada com
  razao. O alias importa porque ninguem e obrigado a chamar de `css`.
*/
const importadores = new Map();
const fontes = new Map();
for (const arquivo of arquivos(FONTE)) {
  const codigo = readFileSync(arquivo, "utf8");
  fontes.set(arquivo, codigo);
  for (const m of codigo.matchAll(
    /import\s+(\w+)\s+from\s+"([^"]+\.module\.css)"/g,
  )) {
    const alvo = resolve(dirname(arquivo), m[2]);
    if (!importadores.has(alvo)) importadores.set(alvo, []);
    importadores.get(alvo).push({ arquivo, alias: m[1] });
  }
}

for (const [modulo, usos] of importadores) {
  let regras;
  try {
    regras = readFileSync(modulo, "utf8");
  } catch {
    continue;
  }

  // Acesso dinamico nao e rastreavel: dispensa o modulo inteiro em vez de
  // gerar acusacao falsa.
  const dinamico = usos.some((u) =>
    new RegExp(String.raw`\b${u.alias}\[(?!["'])`).test(fontes.get(u.arquivo)),
  );
  if (dinamico) continue;

  const declaradas = new Set();
  for (const m of regras.matchAll(/^\s*\.([A-Za-z][\w-]*)/gm)) {
    declaradas.add(m[1]);
  }

  for (const nome of declaradas) {
    const usada = usos.some((u) => {
      const codigo = fontes.get(u.arquivo);
      return (
        new RegExp(String.raw`\b${u.alias}\.${nome}\b`).test(codigo) ||
        codigo.includes(`${u.alias}["${nome}"]`)
      );
    });
    if (usada) continue;
    const curto = modulo.slice(RAIZ.length).replace(BARRA, "/");
    if (!orfas.has(curto)) orfas.set(curto, []);
    orfas.get(curto).push(nome);
  }
}

if (orfas.size > 0) {
  console.error("\nutilities: classe(s) de CSS Module sem consumidor.\n");
  for (const [arq, nomes] of orfas) {
    console.error(`  ${arq}`);
    for (const n of nomes) console.error(`      .${n}`);
  }
  console.error(
    "\nNenhum `className` do TSX irmão referencia essas regras. Regra morta\n" +
      "não quebra nada — só engorda a folha e mente sobre o que a interface\n" +
      "faz. Apague, ou ligue ao elemento que deveria usá-la.\n",
  );
  process.exit(1);
}

if (mortas.size === 0) {
  console.log(
    `utilities: ${total} classes conferidas, todas emitiram CSS; ` +
      `nenhuma regra de módulo sem consumidor.`,
  );
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
