// Gera src/tema/tokens.gerado.css a partir de src/tema/tokens.json (fonte: design
// system v1). Uso:
//   node scripts/tokens.mjs             escreve o arquivo
//   node scripts/tokens.mjs --conferir  falha se o arquivo em disco difere do gerado
//
// Um bloco POR TEMA, e depois um bloco comum:
//  1. cada tema: `color-scheme`, os papéis de COR e as SOMBRAS (que carregam cor:
//     o anel de seleção leva a cor do painel e do destaque, o reflexo do vidro é
//     branco no escuro e as elevações são pretas). O tema de fábrica (Vidro, de
//     tokens.json) sai sob `:root, [data-tema="vidro"]`; cada tema de
//     `src/tema/temas/<id>.json` sai sob `[data-tema="<id>"]`, SEM `:root` e sem
//     exigir que o atributo esteja no <html>: um contêiner com `data-tema` (o
//     cartão de prévia da Aparência) pinta o próprio pedaço no tema dele.
//  2. o resto (espaço, raio, blur, tipografia) em :root, igual em todo tema.
//
// Por que JSON gerado e não `temas/<id>.css` escrito à mão: o tema precisa das
// mesmas referências (`{backdrop-base}`), das sombras e do `color-scheme` que o
// gerador já emite para o Vidro, e o `--conferir` passa a guardar todos os temas
// de uma vez. O gerador reprova tema com papel faltando ou a mais.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const FONTE = join(aqui, "../src/tema/tokens.json");
const PASTA_TEMAS = join(aqui, "../src/tema/temas");
const SAIDA = join(aqui, "../src/tema/tokens.gerado.css");
const SAIDA_THEME = join(aqui, "../src/tema/theme.gerado.css");

/**
 * O @fontsource-variable registra a fam�lia como "<Nome> Variable". O DS escreve
 * s� "<Nome>"; a pilha leva os dois, a embarcada primeiro (ADR-006).
 */
function familiaEmbarcada(pilha) {
  return pilha.replace(/^"([^"]+)"/, (_, nome) => `"${nome} Variable", "${nome}"`);
}

/** `{backdrop-base}` vira `var(--vx-backdrop-base)`. */
export function valorCss(valor) {
  return valor.replace(/\{([a-z0-9-]+)\}/g, (_, nome) => `var(--vx-${nome})`);
}

/**
 * Tamanho e entrelinha passam pela escala de texto da pessoa (`--vx-texto-escala`,
 * 0,9 a 1,25, escrita no <html> por `tema/personalizado.ts`). Sem a variável vale 1.
 */
function escalar(px) {
  return `calc(${px} * var(--vx-texto-escala, 1))`;
}

/** Confere que `valores` tem exatamente os `nomes` do DS; lança com a lista do que diverge. */
function conferirPapeis(id, grupo, nomes, valores) {
  const faltam = nomes.filter((n) => !(n in valores));
  const sobram = Object.keys(valores).filter((n) => !nomes.includes(n));
  if (faltam.length > 0 || sobram.length > 0) {
    throw new Error(
      `tema "${id}" (${grupo}): faltam [${faltam.join(", ")}], sobram [${sobram.join(", ")}]`,
    );
  }
}

/**
 * Os temas a emitir. O primeiro é o de fábrica, lido de tokens.json; os demais
 * vêm de `temas/<id>.json` com `{ id, name, colorScheme, color, shadow }`.
 */
export function temasDe(tokens, extras = []) {
  const [fabrica, ...resto] = tokens.color.themes;
  if (!fabrica) throw new Error("tokens.json sem tema");
  if (resto.length > 0) throw new Error("tokens.json declara um tema só; os demais moram em temas/<id>.json");
  const nomesCor = tokens.color.tokens.map((t) => t.name);
  const nomesSombra = tokens.shadow.tokens.map((t) => t.name);
  const temas = [
    {
      id: fabrica.id,
      colorScheme: fabrica.colorScheme,
      color: Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t.value])),
      shadow: Object.fromEntries(tokens.shadow.tokens.map((t) => [t.name, t.value])),
    },
    ...extras,
  ];
  const ids = new Set();
  for (const t of temas) {
    if (!/^[a-z][a-z0-9-]*$/.test(t.id ?? "")) throw new Error(`id de tema inválido: "${t.id}"`);
    if (ids.has(t.id)) throw new Error(`tema repetido: "${t.id}"`);
    ids.add(t.id);
    if (t.colorScheme !== "dark" && t.colorScheme !== "light") {
      throw new Error(`tema "${t.id}": colorScheme deve ser "dark" ou "light"`);
    }
    conferirPapeis(t.id, "color", nomesCor, t.color ?? {});
    conferirPapeis(t.id, "shadow", nomesSombra, t.shadow ?? {});
  }
  return temas;
}

function blocoDoTema(tema, seletor) {
  const linhas = [`${seletor} {`, `  color-scheme: ${tema.colorScheme};`];
  for (const [nome, valor] of Object.entries(tema.color)) linhas.push(`  --vx-${nome}: ${valorCss(valor)};`);
  for (const [nome, valor] of Object.entries(tema.shadow)) linhas.push(`  --vx-${nome}: ${valorCss(valor)};`);
  linhas.push("}");
  return linhas;
}

export function gerar(tokens, extras = []) {
  const [fabrica, ...outros] = temasDe(tokens, extras);
  // Ordem dos papéis: a do DS, em todo tema (o diff entre temas fica legível).
  const ordenar = (t) => ({
    ...t,
    color: Object.fromEntries(tokens.color.tokens.map((d) => [d.name, t.color[d.name]])),
    shadow: Object.fromEntries(tokens.shadow.tokens.map((d) => [d.name, t.shadow[d.name]])),
  });

  const linhas = [];
  linhas.push("/* GERADO por scripts/tokens.mjs a partir de tokens.json e temas/*.json. NÃO EDITAR. */");
  linhas.push("");
  linhas.push(...blocoDoTema(ordenar(fabrica), `:root,\n[data-tema="${fabrica.id}"]`));
  for (const t of outros) {
    linhas.push("");
    linhas.push(...blocoDoTema(ordenar(t), `[data-tema="${t.id}"]`));
  }
  linhas.push("");
  linhas.push(":root {");
  for (const t of tokens.spacing.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
  for (const t of tokens.radius.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
  for (const t of tokens.blur.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
  for (const [nome, familia] of Object.entries(tokens.type.families)) {
    linhas.push(`  --vx-font-${nome}: ${familiaEmbarcada(familia)};`);
  }
  for (const grupo of tokens.type.groups) {
    for (const e of grupo.styles) {
      linhas.push(`  --vx-type-${e.name}-size: ${escalar(e.fontSize)};`);
      linhas.push(`  --vx-type-${e.name}-line: ${escalar(e.lineHeight)};`);
      linhas.push(`  --vx-type-${e.name}-weight: ${e.fontWeight};`);
      if (e.letterSpacing) linhas.push(`  --vx-type-${e.name}-tracking: ${e.letterSpacing};`);
    }
  }
  linhas.push("}");
  linhas.push("");
  return linhas.join("\n");
}

/** A proje��o Tailwind (camada 2): utilities apontando para as vars da camada 1. */
export function gerarTheme(tokens) {
  const l = [];
  l.push("/* GERADO por scripts/tokens.mjs a partir de tokens.json. N�O EDITAR. */");
  l.push("");
  l.push("@theme inline {");
  for (const t of tokens.color.tokens) l.push(`  --color-${t.name}: var(--vx-${t.name});`);
  for (const t of tokens.spacing.tokens) l.push(`  --spacing-${t.name.replace(/^space-/, "")}: var(--vx-${t.name});`);
  for (const t of tokens.radius.tokens) l.push(`  --radius-${t.name.replace(/^radius-/, "")}: var(--vx-${t.name});`);
  for (const t of tokens.shadow.tokens) l.push(`  --shadow-${t.name.replace(/^shadow-/, "")}: var(--vx-${t.name});`);
  for (const t of tokens.blur.tokens) {
    if (t.name.startsWith("blur-")) l.push(`  --blur-${t.name.slice(5)}: var(--vx-${t.name});`);
  }
  for (const nome of Object.keys(tokens.type.families)) l.push(`  --font-${nome}: var(--vx-font-${nome});`);
  for (const g of tokens.type.groups) {
    for (const e of g.styles) {
      l.push(`  --text-${e.name}: var(--vx-type-${e.name}-size);`);
      l.push(`  --text-${e.name}--line-height: var(--vx-type-${e.name}-line);`);
      l.push(`  --text-${e.name}--font-weight: var(--vx-type-${e.name}-weight);`);
      if (e.letterSpacing) l.push(`  --text-${e.name}--letter-spacing: var(--vx-type-${e.name}-tracking);`);
    }
  }
  l.push("}");
  l.push("");
  return l.join("\n");
}

/** Os temas de `temas/*.json`, em ordem alfabética de arquivo (saída estável). */
export function lerTemasExtras(pasta = PASTA_TEMAS) {
  if (!existsSync(pasta)) return [];
  const arquivos = readdirSync(pasta).filter((f) => f.endsWith(".json")).sort();
  return arquivos.map((f) => {
    const tema = JSON.parse(readFileSync(join(pasta, f), "utf8"));
    if (`${tema.id}.json` !== f) throw new Error(`temas/${f}: o id "${tema.id}" tem de ser o nome do arquivo`);
    return tema;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tokens = JSON.parse(readFileSync(FONTE, "utf8"));
  const css = gerar(tokens, lerTemasExtras());
  const theme = gerarTheme(tokens);
  if (process.argv.includes("--conferir")) {
    const ler = (c) => {
      try {
        return readFileSync(c, "utf8");
      } catch {
        return ""; /* ausente conta como diferente */
      }
    };
    if (ler(SAIDA) !== css || ler(SAIDA_THEME) !== theme) {
      console.error("tokens.gerado.css está desatualizado em relação a tokens.json. Rode `pnpm tokens`.");
      process.exit(1);
    }
    console.log("tokens.gerado.css confere com tokens.json.");
  } else {
    writeFileSync(SAIDA, css);
    writeFileSync(SAIDA_THEME, theme);
    console.log(`escrito ${SAIDA}`);
  }
}
