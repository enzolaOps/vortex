/**
 * Declaração SOMBREADA: a regra tem consumidor, e mesmo assim é código morto.
 *
 * ⚠ **Esta guarda nasceu de um defeito meu, achado por revisão externa e por
 * nenhuma das nove guardas que já existiam.**
 *
 * Num passe de feedback de interação eu acrescentei
 * `.membro:active { background: var(--vx-state-press) }` à member list. O
 * arquivo já tinha `.membro:active { background: var(--vx-surface-3) }` cem
 * linhas abaixo — mesma especificidade, e em CSS a última ganha. A minha
 * declaração não produzia efeito nenhum.
 *
 * Por que nada pegou:
 *
 * - `pnpm utilities` confere `className` sem regra e regra sem `className`. A
 *   classe `.membro` TEM consumidor, então a regra está viva. O que morreu foi
 *   a DECLARAÇÃO, e ela não olha para dentro do bloco.
 * - `pnpm escala`, `pnpm vars`, `pnpm movimento` e o contraste leem valores.
 *   Todos os valores aqui são válidos.
 * - typecheck, lint e 502 testes não veem CSS.
 *
 * O sintoma é a pior categoria deste projeto: **nada quebra.** O controle
 * responde ao ponteiro (a outra regra funciona), então de fora é
 * indistinguível de correto — e quem escreveu acredita ter entregue a feature.
 * A próxima pessoa lê duas regras que se contradizem e não sabe qual vale sem
 * abrir o navegador.
 *
 * ⚠ **Só acusa dentro do MESMO contexto de at-rule.** Redeclarar sob
 * `@media (prefers-reduced-motion)` ou `@container` é o mecanismo funcionando,
 * não sombra — o contexto é o que torna a segunda declaração condicional.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FONTE = join(RAIZ, "src");
const BARRA = String.fromCharCode(92);

function arquivos(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, out);
    else if (nome.endsWith(".module.css")) out.push(caminho);
  }
  return out;
}

/** Normaliza para comparar seletores que só diferem em espaço em branco. */
const chave = (sel) => sel.replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();

const falhas = [];
let blocosConferidos = 0;

for (const arquivo of arquivos(FONTE)) {
  const rel = arquivo.slice(RAIZ.length).split(BARRA).join("/").replace(/^\//, "");
  const bruto = readFileSync(arquivo, "utf8");
  /* Comentário vira espaço do mesmo tamanho: o número da linha continua
     verdadeiro, e um seletor citado em prosa não conta como regra. */
  const texto = bruto.replace(/\/\*[^]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

  /*
    Varredura com pilha: acumula o seletor corrente e o CONTEXTO de at-rule.
    Não é um parser de CSS completo, e não precisa ser — o que interessa é
    "mesmo seletor, mesmo contexto, propriedade repetida".
  */
  const pilha = [];
  const blocos = [];
  let ini = 0;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (c === "{") {
      const cabeca = texto.slice(ini, i).trim();
      pilha.push(cabeca);
      ini = i + 1;
    } else if (c === "}") {
      const cabeca = pilha.pop() ?? "";
      const corpo = texto.slice(ini, i);
      /* Só folhas interessam: um bloco que contém outro é contexto. */
      if (cabeca && !cabeca.startsWith("@") && !corpo.includes("{")) {
        blocos.push({
          sel: chave(cabeca),
          contexto: pilha.filter((h) => h.startsWith("@")).map(chave).join(" > "),
          corpo,
          linha: texto.slice(0, i - corpo.length).split("\n").length,
        });
      }
      ini = i + 1;
    }
  }

  /* Agrupa por (contexto, seletor) e procura propriedade repetida. */
  const porChave = new Map();
  for (const b of blocos) {
    blocosConferidos++;
    const k = b.contexto + "||" + b.sel;
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(b);
  }

  for (const [k, lista] of porChave) {
    if (lista.length < 2) continue;
    const [contexto, sel] = k.split("||");
    /* Propriedades de cada ocorrência, na ordem em que aparecem. */
    const props = lista.map((b) => {
      const set = new Set();
      for (const m of b.corpo.matchAll(/(^|;)\s*([-a-zA-Z][-a-zA-Z0-9]*)\s*:/g))
        set.add(m[2].toLowerCase());
      return { ...b, props: set };
    });
    for (let a = 0; a < props.length - 1; a++)
      for (let d = a + 1; d < props.length; d++) {
        const colide = [...props[a].props].filter((p) => props[d].props.has(p));
        if (colide.length === 0) continue;
        falhas.push({
          rel,
          sel,
          contexto,
          linhaMorta: props[a].linha,
          linhaVence: props[d].linha,
          props: colide,
        });
      }
  }
}

if (falhas.length === 0) {
  console.log(
    `sombra: ${blocosConferidos} blocos conferidos, ` +
      `nenhuma declaração sombreada por seletor repetido.`,
  );
  process.exit(0);
}

console.error(`\nsombra: ${falhas.length} declaração(ões) sombreada(s).\n`);
for (const f of falhas)
  console.error(
    `  ${f.rel}\n     \`${f.sel}\`${f.contexto ? ` dentro de \`${f.contexto}\`` : ""}` +
      `\n     linha ${f.linhaMorta} declara ${f.props.map((p) => `\`${p}\``).join(", ")}` +
      ` — e a linha ${f.linhaVence} redeclara e VENCE.\n`,
  );
console.error(
  "Mesmo seletor, mesmo contexto, mesma propriedade: em CSS a última ganha, e\n" +
    "a primeira vira código morto que nada acusa — a regra tem consumidor, o\n" +
    "valor é válido, e o controle até responde, porque quem responde é a OUTRA\n" +
    "declaração.\n\n" +
    "Junte as duas no bloco que já existia, ou apague a que não vale.\n" +
    "Redeclarar sob `@media`/`@container` é permitido: o contexto é o que faz\n" +
    "a segunda ser condicional em vez de sombra.\n",
);
process.exit(1);
