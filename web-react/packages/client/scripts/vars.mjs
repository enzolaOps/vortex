/**
 * Todo `var(--…)` de CSS Module RESOLVE?
 *
 * ⚠ **Esta guarda nasce de um defeito meu, e ele passou por typecheck, lint,
 * `pnpm escala`, `pnpm utilities`, 367 testes e o build.**
 *
 * A escala de z deste projeto é nomeada por PAPEL em `--vx-z-realce`,
 * `--vx-z-flutuante`. O nome SEM prefixo (`--z-flutuante`) existe só como
 * utility do Tailwind, gerada a partir de `--z-index-*` no `@theme` — não é
 * uma custom property que alguém possa ler.
 *
 * Escrevi `z-index: var(--z-realce)` em três módulos novos. `var()` sem
 * fallback resolve para nada, a declaração inteira é descartada, `z-index` cai
 * em `auto`, e NADA falha: o cabeçalho grudado do seletor de emoji e as barras
 * do lightbox ficaram sem camada. Só apareceu quando um drawer passou por
 * baixo da lista de membros.
 *
 * É a mesma família do `py-0.5` e do `min-w-0`: a folha de estilo aceita o que
 * não entende, e o resultado é uma regra que existe no arquivo e não na tela.
 *
 * O que conta como resolvível:
 *
 * 1. Declarado em `styles/tokens.css` — a camada 1 e o `@theme`.
 * 2. Declarado no PRÓPRIO módulo, em qualquer seletor. Custom property local
 *    é legítima (`--proporcao` no anexo, `--a`/`--b` no avatar).
 * 3. Vindo por herança de um consumidor, declarado inline no TSX irmão.
 * 4. `var(--x, fallback)` — com fallback, não resolver é comportamento
 *    escolhido, não acidente.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FONTE = join(RAIZ, "src");

function arquivos(dir, filtro, out = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, filtro, out);
    else if (filtro(nome)) out.push(caminho);
  }
  return out;
}

/**
 * Toda custom property declarada num arquivo — `--nome: valor`.
 *
 * A aspa opcional cobre o TSX, onde a mesma declaração é uma chave de objeto:
 * `style={{ "--proporcao": … }}`. Sem ela, `--proporcao` do anexo — que existe
 * e funciona — seria acusada de não resolver.
 */
function declaradas(texto, dentro = new Set()) {
  for (const m of texto.matchAll(/(--[\w-]+)["']?\s*:/g)) dentro.add(m[1]);
  return dentro;
}

/**
 * Tira os comentários antes de procurar.
 *
 * Este projeto comenta muito, e vários comentários CITAM nomes de var para
 * explicar por que eles NÃO devem ser usados — `--spacing` do Tailwind é o
 * caso. Uma guarda que lesse comentário acusaria justamente a documentação da
 * armadilha que ela existe para prevenir.
 */
/**
 * Tira os comentários antes de procurar.
 *
 * Este projeto comenta muito, e vários comentários CITAM nomes de var para
 * explicar por que eles NÃO devem ser usados — o `--spacing` do Tailwind é o
 * caso. Uma guarda que lesse comentário acusaria justamente a documentação da
 * armadilha que ela existe para prevenir. Foi o primeiro falso positivo dela.
 *
 * Troca por espaços em vez de apagar: o número da linha tem de continuar
 * batendo com o do arquivo.
 */
function semComentarios(css) {
  const NL = String.fromCharCode(10);
  return css.replace(/\/\*[\s\S]*?\*\//g, (bloco) =>
    bloco
      .split(NL)
      .map((l) => " ".repeat(l.length))
      .join(NL),
  );
}

const TOKENS = declaradas(
  semComentarios(readFileSync(join(FONTE, "styles/tokens.css"), "utf8")),
);

const modulos = arquivos(FONTE, (n) => n.endsWith(".module.css"));
const fora = [];
let conferidas = 0;

for (const arquivo of modulos) {
  const css = semComentarios(readFileSync(arquivo, "utf8"));
  const locais = declaradas(css);

  /*
    O TSX irmão pode declarar a var inline (`style={{ "--proporcao": … }}`),
    e aí ela chega por herança. Ler o irmão é o mesmo caminho que o
    `pnpm utilities` já faz para achar o consumidor de cada regra.
  */
  const irmao = arquivo.replace(/\.module\.css$/, ".tsx");
  let doTsx = new Set();
  try {
    doTsx = declaradas(readFileSync(irmao, "utf8"));
  } catch {
    /* Módulo sem TSX irmão é caso normal — o consumidor pode estar noutro
       arquivo, e o `pnpm utilities` é quem cobra isso. */
  }

  css.split("\n").forEach((linha, i) => {
    // `var(--nome` sem vírgula depois: só as SEM fallback são cobradas.
    for (const m of linha.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
      const nome = m[1];
      const temFallback = m[2] === ",";
      conferidas += 1;
      if (temFallback) continue;
      if (TOKENS.has(nome) || locais.has(nome) || doTsx.has(nome)) continue;
      fora.push({
        arquivo: arquivo.slice(RAIZ.length).replace(/\\/g, "/"),
        linha: i + 1,
        nome,
        texto: linha.trim(),
      });
    }
  });
}

if (fora.length === 0) {
  console.log(`vars: ${conferidas} referências a custom property conferidas, todas resolvem.`);
  process.exit(0);
}

console.error(`\nvars: ${fora.length} referência(s) que não resolvem.\n`);
for (const f of fora) console.error(`  ${f.arquivo}:${f.linha}  ${f.nome}\n      ${f.texto}`);
console.error(
  "\n`var(--x)` sem fallback que não existe é descartado em silêncio: a\n" +
    "propriedade inteira some e a regra parece estar lá. Confira o PREFIXO —\n" +
    "a camada 1 deste projeto é `--vx-*`, e nomes como `--z-flutuante` ou\n" +
    "`--color-accent` existem só como utility do Tailwind, não como var.\n\n" +
    "Se a intenção for mesmo opcional, dê um fallback: `var(--x, 0)`.\n",
);
process.exit(1);
