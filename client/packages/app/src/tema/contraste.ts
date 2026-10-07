/**
 * Contraste dos temas: lógica pura, sem DOM. O teste (`contraste.test.ts`) a roda
 * sobre todo arquivo de tema; o picker de paleta da jornada de configurações vai
 * usar a mesma função para validar uma paleta derivada em runtime.
 *
 * Método do design system (README, "Contraste"): cada valor translúcido é
 * composto sobre `backdrop-base` e sobre cada um dos três campos de cor no pico
 * de opacidade, e o resultado de um par é o MENOR valor entre eles. Sem lista de
 * exceções: falhou, o tema está errado.
 */

export interface Cor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type Tema = Readonly<Record<string, string>>;

export function parseCor(texto: string): Cor {
  const t = texto.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(t);
  if (hex) {
    let h = hex[1] ?? "";
    if (h.length <= 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
  }
  const fn = /^rgba?\(([^)]+)\)$/.exec(t);
  if (fn) {
    const p = (fn[1] ?? "").split(",").map((x) => Number(x.trim()));
    const [r, g, b, a] = p;
    if (p.length >= 3 && [r, g, b].every((v) => Number.isFinite(v))) {
      return {
        r: r ?? 0,
        g: g ?? 0,
        b: b ?? 0,
        a: p.length === 4 && Number.isFinite(a) ? (a ?? 1) : 1,
      };
    }
  }
  throw new Error(`cor ilegível: "${texto}"`);
}

/** `fg` sobre `bg` (alfa "over"). O resultado é opaco se `bg` for opaco. */
export function compor(fg: Cor, bg: Cor): Cor {
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (f: number, b: number) => (f * fg.a + b * bg.a * (1 - fg.a)) / a;
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
}

function luminancia(c: Cor): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

export function razao(a: Cor, b: Cor): number {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Campo de cor desfocado atrás dos painéis, com a opacidade de pico. */
export interface CampoDeCor {
  papel: string;
  opacidade: number;
}

export type SuperficieId =
  | "base"
  | "panel"
  | "reading"
  | "overlay"
  | "overlay/panel"
  | "overlay/reading"
  | "solid"
  | "stage"
  | "panel+selected"
  | "reading+selected";

export interface Par {
  /** Papel do tema, ou `#rrggbb` literal (iniciais brancas do avatar). */
  fg: string;
  /** Papel do tema usado como fundo sólido (`text-on-*` sobre o preenchimento). */
  fundoPapel?: string;
  sobre?: readonly SuperficieId[];
  minimo: 3 | 4.5;
}

export interface NomeadoPar {
  nome: string;
  par: Par;
}

export interface Resultado {
  par: string;
  minimo: number;
  piorCaso: number;
  ok: boolean;
}

function cor(tema: Tema, papel: string): Cor {
  const bruto = papel.startsWith("#") ? papel : tema[papel];
  if (bruto === undefined) throw new Error(`papel ausente no tema: ${papel}`);
  return parseCor(bruto);
}

/** Todas as superfícies compostas sobre UM fundo de cena. */
function superficies(tema: Tema, cena: Cor): Record<SuperficieId, Cor> {
  const panel = compor(cor(tema, "surface-glass"), cena);
  const reading = compor(cor(tema, "surface-glass-reading"), cena);
  const overlay = cor(tema, "surface-overlay");
  const selecionado = cor(tema, "state-selected");
  return {
    base: compor(cor(tema, "surface-base"), cena),
    panel,
    reading,
    overlay: compor(overlay, cena),
    "overlay/panel": compor(overlay, panel),
    "overlay/reading": compor(overlay, reading),
    solid: cor(tema, "surface-solid"),
    stage: cor(tema, "stage"),
    "panel+selected": compor(selecionado, panel),
    "reading+selected": compor(selecionado, reading),
  };
}

/** Os quatro fundos de cena: o chão e o chão sob cada campo de cor no pico. */
function cenas(tema: Tema, campos: readonly CampoDeCor[]): Cor[] {
  const chao = cor(tema, "backdrop-base");
  return [chao, ...campos.map((c) => compor({ ...cor(tema, c.papel), a: c.opacidade }, chao))];
}

/** O tema já deve estar com `var(--vx-x)` resolvido (`resolverReferencias`). */
export function medir(
  tema: Tema,
  pares: readonly NomeadoPar[],
  campos: readonly CampoDeCor[],
): Resultado[] {
  const fundos = cenas(tema, campos).map((c) => superficies(tema, c));
  return pares.map(({ nome, par }) => {
    const fg = cor(tema, par.fg);
    const razoes: number[] = [];
    if (par.fundoPapel) razoes.push(razao(fg, cor(tema, par.fundoPapel)));
    for (const s of par.sobre ?? []) {
      for (const f of fundos) razoes.push(razao(fg, f[s]));
    }
    const piorCaso = Math.min(...razoes);
    return { par: nome, minimo: par.minimo, piorCaso, ok: piorCaso >= par.minimo };
  });
}

/**
 * Papéis de cor que um tema declara, lidos de um CSS: cada bloco cujo seletor
 * contém `[data-tema="<id>"]` define o tema `<id>`. O `:root` puro que divide o
 * bloco com o tema padrão não conta como tema à parte.
 */
export function lerTemas(css: string): Record<string, Record<string, string>> {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const temas: Record<string, Record<string, string>> = {};
  for (const bloco of limpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const seletor = bloco[1] ?? "";
    const ids = [...seletor.matchAll(/\[data-tema="([^"]+)"\]/g)].map((m) => m[1] ?? "");
    if (ids.length === 0) continue;
    const decl: Record<string, string> = {};
    for (const d of (bloco[2] ?? "").matchAll(/--vx-([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      decl[d[1] ?? ""] = (d[2] ?? "").trim();
    }
    for (const id of ids) temas[id] = { ...temas[id], ...decl };
  }
  return temas;
}

/** Resolve `var(--vx-x)` até um valor de cor. Referência circular é erro. */
export function resolverReferencias(tema: Record<string, string>): Record<string, string> {
  const resolver = (nome: string, pilha: string[]): string => {
    const valor = tema[nome];
    if (valor === undefined) throw new Error(`referência a papel inexistente: ${nome}`);
    const ref = /^var\(--vx-([a-z0-9-]+)\)$/.exec(valor);
    if (!ref) return valor;
    const alvo = ref[1] ?? "";
    if (pilha.includes(alvo)) {
      throw new Error(`referência circular: ${[...pilha, alvo].join(" -> ")}`);
    }
    return resolver(alvo, [...pilha, nome]);
  };
  const resolvido: Record<string, string> = {};
  for (const nome of Object.keys(tema)) resolvido[nome] = resolver(nome, [nome]);
  return resolvido;
}
