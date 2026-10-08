// Gera src/tema/tokens.gerado.css a partir de src/tema/tokens.json (fonte: design
// system v1). Uso:
//   node scripts/tokens.mjs             escreve o arquivo
//   node scripts/tokens.mjs --conferir  falha se o arquivo em disco difere do gerado
//
// Dois blocos, de propósito:
//  1. papéis de COR sob :root e :root[data-tema="<id>"]. Um tema novo repete este
//     bloco com os mesmos papéis (o teste de contraste confere os dois sentidos).
//  2. o resto (espaço, raio, sombra, blur, tipografia) em :root, igual em todo tema.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const aqui = dirname(fileURLToPath(import.meta.url));
const FONTE = join(aqui, "../src/tema/tokens.json");
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

export function gerar(tokens) {
  const temas = tokens.color.themes;
  if (temas.length === 0) throw new Error("tokens.json sem tema");
  const seletor = [":root", ...temas.map((t) => `:root[data-tema="${t.id}"]`)].join(",\n");

  const linhas = [];
  linhas.push("/* GERADO por scripts/tokens.mjs a partir de tokens.json. NÃO EDITAR. */");
  linhas.push("");
  linhas.push(`${seletor} {`);
  for (const t of tokens.color.tokens) {
    linhas.push(`  --vx-${t.name}: ${valorCss(t.value)};`);
  }
  linhas.push("}");
  linhas.push("");
  linhas.push(":root {");
  for (const t of tokens.spacing.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
  for (const t of tokens.radius.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
  for (const t of tokens.shadow.tokens) linhas.push(`  --vx-${t.name}: ${t.value};`);
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

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tokens = JSON.parse(readFileSync(FONTE, "utf8"));
  const css = gerar(tokens);
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
