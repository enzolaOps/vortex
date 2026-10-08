import type { Aparencia } from "nucleo/store/aparencia";

import { parseCor, type CampoDeCor } from "./contraste";

/**
 * "Vidro" e "Brilho de fundo": a receita do vidro lida como dois controles.
 *
 * Quem escolhe só mexe no VALOR de tokens `--vx-*`; nenhum componente ganha
 * estilo próprio. Puro, sem DOM: `personalizado.ts` escreve o resultado no
 * documento e a prévia o repete no próprio contêiner.
 *
 * O controle de vidro só anda para o lado SEGURO do contraste: opacidade maior
 * escurece a superfície sob o texto claro, e brilho menor tira luz do fundo.
 * Ainda assim a varredura de `vidroEFundo.test.ts` mede cada ponto.
 */

/** Os papéis de superfície translúcida: o vidro padrão, o de leitura e o dos menus. */
const SUPERFICIES = ["surface-glass", "surface-glass-reading", "surface-overlay"] as const;

/** O desfoque de fábrica, em px (`--vx-blur-glass`). */
const DESFOQUE_DE_FABRICA = 28;

function comAlfa(cor: string, alfa: number): string {
  const c = parseCor(cor);
  return `rgba(${String(Math.round(c.r))},${String(Math.round(c.g))},${String(Math.round(c.b))},${String(alfa)})`;
}

/**
 * Do vidro de fábrica (100) ao sólido (0): a opacidade sobe linearmente até 1 e o
 * desfoque desce junto. No extremo sólido o `backdrop-filter` some (não vira
 * `blur(0)`: o navegador ainda reservaria a camada), o que alivia PC fraco.
 */
export function ajustesDeVidro(
  papeis: Readonly<Record<string, string>>,
  a: Pick<Aparencia, "vidro" | "brilho">,
): Record<string, string> {
  const saida: Record<string, string> = {};
  const k = a.vidro / 100;
  if (a.vidro < 100) {
    for (const nome of SUPERFICIES) {
      const cor = papeis[nome];
      if (cor === undefined) continue;
      const base = parseCor(cor).a;
      saida[nome] = comAlfa(cor, Math.round((base + (1 - base) * (1 - k)) * 1000) / 1000);
    }
    saida["blur-glass"] = `${String(Math.round(DESFOQUE_DE_FABRICA * k))}px`;
    if (a.vidro === 0) saida["backdrop-glass"] = "none";
  }
  if (a.brilho < 100) {
    saida["glow-escala"] = String(a.brilho / 100);
    if (a.brilho === 0) saida["glow-exibir"] = "none";
  }
  return saida;
}

/** A opacidade de pico dos campos de cor depois do controle de brilho (para medir o contraste). */
export function camposComBrilho(campos: readonly CampoDeCor[], brilho: number): CampoDeCor[] {
  return campos.map((c) => ({ ...c, opacidade: (c.opacidade * brilho) / 100 }));
}
