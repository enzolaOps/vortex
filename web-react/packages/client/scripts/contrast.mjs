/**
 * Verificador de contraste dos tokens.
 *
 * Lê `src/styles/tokens.css` — a fonte real, não uma cópia — extrai cada tema e
 * afirma os pares que de fato aparecem na interface. É o mecanismo da linha
 * "Contraste dos tokens | Teste | Fase 1" do enforcement.md.
 *
 * O par que mais falha na prática é `--vx-text-3` sobre `--vx-surface-3`:
 * metadata apagada sobre a superfície mais clara. Um verificador que só olha
 * texto primário sobre o fundo base não pega isso e dá falsa confiança.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const aqui = dirname(fileURLToPath(import.meta.url));
const bruto = readFileSync(join(aqui, "..", "src", "styles", "tokens.css"), "utf8");

/**
 * Comentários fora ANTES de qualquer parse.
 *
 * Um comentário que mencione um token (`--vx-surface-3: metadata apagada`)
 * faz o casamento seguir até o primeiro `;` de verdade, engolindo a
 * declaração seguinte e gravando prosa como se fosse cor. O verificador
 * então mede NaN, e NaN < mínimo é falso: o par passa calado.
 */
function semComentarios(texto) {
  let saida = "";
  let i = 0;
  for (;;) {
    const abre = texto.indexOf("/" + "*", i);
    if (abre === -1) return saida + texto.slice(i);
    saida += texto.slice(i, abre);
    const fecha = texto.indexOf("*" + "/", abre + 2);
    if (fecha === -1) return saida;
    i = fecha + 2;
  }
}

const css = semComentarios(bruto);

/** Extrai os `--vx-*` de um bloco de seletor. */
function lerTema(seletor) {
  const inicio = css.indexOf(seletor + " {");
  if (inicio === -1) throw new Error(`bloco não encontrado: ${seletor}`);
  const abre = css.indexOf("{", inicio);
  const fecha = css.indexOf("}", abre);
  const corpo = css.slice(abre + 1, fecha);
  const tokens = {};
  for (const [, nome, valor] of corpo.matchAll(/(--vx-[a-z0-9-]+) *: *([^;]+);/g)) {
    tokens[nome.trim()] = valor.trim();
  }
  return tokens;
}
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function rgb(hex) {
  if (!HEX.test(hex)) {
    throw new Error(
      `valor não é hex: ${JSON.stringify(hex)} — o verificador não mede o que` +
        ` não entende, e não pode aprovar por omissão`,
    );
  }
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** Luminância relativa, WCAG 2.1. */
function luminancia(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

const SUPERFICIES = ["--vx-surface-0", "--vx-surface-1", "--vx-surface-2", "--vx-surface-3"];

/**
 * Os pares que a interface realmente produz.
 *
 * `min` segue design-system.md: 4,5:1 em texto, 3:1 em borda de controle e em
 * indicador não-textual (o ponto de presença é forma + cor, mas a cor precisa
 * ser distinguível do fundo).
 */
function pares(t) {
  const lista = [];

  // Texto sobre toda superfície em que pode aparecer.
  for (const sup of SUPERFICIES) {
    for (const texto of ["--vx-text-1", "--vx-text-2", "--vx-text-3"]) {
      lista.push({ fg: texto, bg: sup, min: 4.5, tipo: "texto" });
    }
  }

  // Bordas: separam controle do fundo.
  for (const sup of SUPERFICIES) {
    lista.push({ fg: "--vx-border-strong", bg: sup, min: 3, tipo: "borda" });
  }

  // Ação e semânticos, usados como texto e como ícone sobre o fundo base.
  for (const sup of ["--vx-surface-0", "--vx-surface-1", "--vx-surface-2"]) {
    for (const cor of ["--vx-accent", "--vx-danger", "--vx-warning", "--vx-success"]) {
      lista.push({ fg: cor, bg: sup, min: 4.5, tipo: "texto" });
    }
  }

  // Texto sobre o preenchimento do botão primário.
  lista.push({ fg: "--vx-on-accent", bg: "--vx-accent", min: 4.5, tipo: "texto" });
  lista.push({ fg: "--vx-on-accent", bg: "--vx-accent-hover", min: 4.5, tipo: "texto" });

  // Presença: ponto pequeno, precisa se separar do fundo em que é desenhado.
  for (const status of [
    "--vx-status-online",
    "--vx-status-idle",
    "--vx-status-dnd",
    "--vx-status-offline",
  ]) {
    lista.push({ fg: status, bg: "--vx-surface-0", min: 3, tipo: "indicador" });
    lista.push({ fg: status, bg: "--vx-surface-1", min: 3, tipo: "indicador" });
  }

  const ausentes = lista.filter((p) => !t[p.fg] || !t[p.bg]);
  if (ausentes.length > 0) {
    const nomes = [...new Set(ausentes.flatMap((p) => [p.fg, p.bg]))]
      .filter((n) => !t[n])
      .join(", ");
    throw new Error(`token(s) não encontrado(s): ${nomes}`);
  }
  return lista;
}

const TEMAS = [
  { nome: "dark", seletor: ":root" },
  { nome: "light", seletor: '[data-theme="light"]' },
];

let falhas = 0;
let total = 0;

for (const tema of TEMAS) {
  const t = lerTema(tema.seletor);
  const base = tema.nome === "light" ? { ...lerTema(":root"), ...t } : t;
  const resultados = pares(base).map((p) => ({
    ...p,
    r: razao(base[p.fg], base[p.bg]),
  }));

  const ruins = resultados.filter((p) => p.r < p.min);
  total += resultados.length;
  falhas += ruins.length;

  const pior = [...resultados].sort((a, b) => a.r / a.min - b.r / b.min)[0];

  console.log(
    `\n${tema.nome.toUpperCase()}  ${resultados.length - ruins.length}/${resultados.length} pares ok` +
      `   (mais apertado: ${pior.fg} sobre ${pior.bg} = ${pior.r.toFixed(2)}:1, mín ${pior.min})`,
  );

  for (const p of ruins) {
    console.log(
      `  ✗ ${p.fg} sobre ${p.bg}  ${p.r.toFixed(2)}:1  < ${p.min}  (${p.tipo})`,
    );
  }
}

console.log(
  `\n${falhas === 0 ? "PASSA" : "FALHA"} — ${total - falhas}/${total} pares dentro do mínimo\n`,
);
process.exit(falhas === 0 ? 0 : 1);
