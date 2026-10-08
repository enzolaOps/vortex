import { medir, parseCor, resolverReferencias, type CampoDeCor } from "./contraste";
import { PARES } from "./pares";

/**
 * A paleta personalizada (PRD 4.6): a pessoa escolhe um matiz, uma intensidade
 * e uma cor de destaque; o app decide a LUMINOSIDADE de tudo. Escolher cor
 * crua para cada papel é como se faz um tema ilegível — aqui o matiz e a
 * saturação são livres e o brilho é fixo por papel, e cada resultado passa
 * pelos mesmos pares de contraste do tema de fábrica (`pares.ts`) antes de ser
 * aplicado. Se alguma combinação ainda reprovar, a derivação escurece os campos
 * de cor por baixo do vidro até passar; se nem assim passar, devolve `undefined`
 * e quem chama fica com o tema de fábrica.
 *
 * Puro: sem DOM e sem relógio. `aplicar` e a persistência moram em
 * `personalizado.ts`.
 */

export const DESTAQUES = ["lavanda", "menta", "ceu", "rosa", "pessego", "limao"] as const;
export type DestaqueId = (typeof DESTAQUES)[number];

export type CorHsl = { readonly h: number; readonly s: number; readonly l: number };

/** Matiz (0-360), saturação e luminosidade do destaque, como o design os escolhe. */
const COR_DO_DESTAQUE: Record<DestaqueId, CorHsl> = {
  lavanda: { h: 252, s: 100, l: 80 },
  menta: { h: 170, s: 70, l: 65 },
  ceu: { h: 205, s: 95, l: 72 },
  rosa: { h: 335, s: 90, l: 75 },
  pessego: { h: 22, s: 90, l: 72 },
  limao: { h: 80, s: 70, l: 68 },
};

/** Os temas prontos: cada um é só uma semente do mesmo derivador. */
export const TEMAS = ["vidro", "grafite", "oceano", "ametista", "floresta", "brasa", "aurora"] as const;
export type TemaId = (typeof TEMAS)[number];

export type Semente = {
  readonly matiz: number;
  readonly intensidade: number;
  readonly destaque: DestaqueId;
};

/** Vidro é o tema de fábrica (declarado no CSS); a semente dele é só o ponto de partida do "Personalizar". */
export const SEMENTES: Readonly<Record<TemaId, Semente>> = {
  vidro: { matiz: 250, intensidade: 55, destaque: "lavanda" },
  grafite: { matiz: 220, intensidade: 6, destaque: "ceu" },
  oceano: { matiz: 205, intensidade: 70, destaque: "menta" },
  ametista: { matiz: 285, intensidade: 65, destaque: "rosa" },
  floresta: { matiz: 145, intensidade: 45, destaque: "limao" },
  brasa: { matiz: 15, intensidade: 60, destaque: "pessego" },
  aurora: { matiz: 85, intensidade: 45, destaque: "rosa" },
};

export type Personalizacao = {
  /** Falso = tema de fábrica (Vidro), sem nada escrito no documento. */
  readonly ativo: boolean;
  /** O tema pronto escolhido (ou do qual a personalização partiu). */
  readonly tema: TemaId;
  /** Mexeu nos ajustes depois de escolher o tema. */
  readonly personalizado: boolean;
  /** 0 a 360. */
  readonly matiz: number;
  /** 0 a 100. */
  readonly intensidade: number;
  readonly destaque: DestaqueId;
  /** Cor de destaque livre em `#rrggbb`; vale no lugar de `destaque`. */
  readonly destaqueLivre: string | null;
};

export const PERSONALIZACAO_PADRAO: Personalizacao = {
  ativo: false,
  tema: "vidro",
  personalizado: false,
  ...SEMENTES.vidro,
  destaqueLivre: null,
};

/** `#rgb` ou `#rrggbb` (com ou sem `#`) para `#rrggbb` minúsculo, ou `undefined`. */
export function normalizarHex(texto: string): string | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(texto.trim());
  if (!m?.[1]) return undefined;
  const h = m[1].toLowerCase();
  const cheio = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return `#${cheio}`;
}

/** `#rrggbb` para HSL (h em graus, s e l em %). */
export function hexParaHsl(hex: string): CorHsl {
  const c = parseCor(hex);
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60;
  return { h, s: s * 100, l: l * 100 };
}

/** A cor de destaque pedida: a livre, se houver, senão a do chip. */
function corPedida(p: Personalizacao): CorHsl {
  return p.destaqueLivre !== null ? hexParaHsl(p.destaqueLivre) : COR_DO_DESTAQUE[p.destaque];
}

/** HSL (h em graus, s e l em %) para `#rrggbb`. */
export function hsl(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;
  const a = ss * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + hh / 30) % 12;
    const c = ll - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function rgba(hex: string, alfa: number): string {
  const c = parseCor(hex);
  return `rgba(${String(c.r)},${String(c.g)},${String(c.b)},${String(alfa)})`;
}

/** O que o tema de fábrica declara, resolvido (referências substituídas) e com os campos de cor. */
export type BaseDoTema = {
  readonly papeis: Readonly<Record<string, string>>;
  readonly campos: readonly CampoDeCor[];
};

/**
 * Os papéis que a paleta sobrescreve. `claridade` 1 e `saturacao` 1 são o
 * desenho; abaixo disso as superfícies e os campos escurecem e perdem cor
 * (último recurso quando o contraste reprova).
 */
export function derivarPapeis(
  p: Personalizacao,
  claridade = 1,
  saturacao = 1,
  cor: CorHsl = corPedida(p),
): Record<string, string> {
  const sat = Math.round((10 + p.intensidade * 0.6) * saturacao);
  const luz = (l: number) => l * claridade;

  const destaque = hsl(cor.h, cor.s, cor.l);
  const destaqueHover = hsl(cor.h, cor.s, Math.min(95, cor.l + 6));
  const destaquePress = hsl(cor.h, cor.s, cor.l - 7);
  const base = hsl(p.matiz, sat, luz(6));

  return {
    "backdrop-base": base,
    "backdrop-glow-indigo": hsl(p.matiz, 70, luz(50)),
    "backdrop-glow-teal": hsl(p.matiz + 60, 65, luz(55)),
    "backdrop-glow-magenta": hsl(p.matiz + 120, 55, luz(50)),
    "surface-glass": rgba(hsl(p.matiz, sat, luz(9)), 0.52),
    "surface-glass-reading": rgba(hsl(p.matiz, sat, luz(7)), 0.62),
    "surface-overlay": rgba(hsl(p.matiz, sat, luz(12)), 0.62),
    "surface-solid": hsl(p.matiz, sat, luz(10)),
    accent: destaque,
    "accent-hover": destaqueHover,
    "accent-press": destaquePress,
    "accent-soft": rgba(destaque, 0.16),
    "state-selected": rgba(destaque, 0.16),
    unread: destaque,
    mention: hsl(cor.h, 100, 93),
    "text-on-accent": hsl(cor.h, 55, 11),
    "text-on-mention": hsl(cor.h, 55, 11),
  };
}

/** Os pares que reprovam num tema (vazio = passa). */
export function falhasDeContraste(base: BaseDoTema, papeis: Readonly<Record<string, string>>): string[] {
  const tema = resolverReferencias({ ...base.papeis, ...papeis });
  return medir(tema, PARES, base.campos)
    .filter((r) => !r.ok)
    .map((r) => r.par);
}

export type PaletaValidada = {
  readonly papeis: Readonly<Record<string, string>>;
  /** Os campos de cor tiveram de escurecer para passar. */
  readonly ajustada: boolean;
  /** A cor de destaque livre foi trocada por outra de tom parecido que se lê. */
  readonly destaqueAjustado?: { readonly de: string; readonly para: string };
};

const PASSOS_DE_CLARIDADE = [1, 0.85, 0.7, 0.55, 0.4, 0.3] as const;
const PASSOS_DE_SATURACAO = [1, 0.6, 0.3] as const;

/**
 * A paleta que passa no contraste, ou `undefined`. Escurece as superfícies e os
 * campos de cor (o texto é sempre claro, então escurecer só ajuda) e, se ainda
 * assim reprovar, tira saturação; mede de novo a cada passo.
 */
export function paletaValidada(base: BaseDoTema, p: Personalizacao): PaletaValidada | undefined {
  const pedida = corPedida(p);
  for (const saturacao of PASSOS_DE_SATURACAO) {
    for (const claridade of PASSOS_DE_CLARIDADE) {
      const papeis = derivarPapeis(p, claridade, saturacao, pedida);
      if (falhasDeContraste(base, papeis).length === 0) {
        return { papeis, ajustada: claridade !== 1 || saturacao !== 1 };
      }
      if (p.destaqueLivre === null) continue;
      const cor = ajustarDestaque(base, p, pedida, claridade, saturacao);
      if (cor) {
        return {
          papeis: derivarPapeis(p, claridade, saturacao, cor),
          ajustada: claridade !== 1 || saturacao !== 1,
          destaqueAjustado: { de: p.destaqueLivre, para: hsl(cor.h, cor.s, cor.l) },
        };
      }
    }
  }
  return undefined;
}

/**
 * Cor livre que reprova: mantém matiz e saturação e anda só na luminosidade, da
 * mais próxima da pedida para a mais distante, até as superfícies lerem o
 * destaque (texto, hover, pressionado e o texto sobre ele).
 */
function ajustarDestaque(
  base: BaseDoTema,
  p: Personalizacao,
  pedida: CorHsl,
  claridade: number,
  saturacao: number,
): CorHsl | undefined {
  const passa = (cor: CorHsl) => falhasDeContraste(base, derivarPapeis(p, claridade, saturacao, cor)).length === 0;
  const alvo = Math.min(94, Math.max(30, pedida.l));
  for (let passo = 0; passo <= 64; passo += 1) {
    for (const l of [alvo + passo, alvo - passo]) {
      if (l < 30 || l > 94) continue;
      const candidata = { ...pedida, l };
      if (passa(candidata)) return candidata;
    }
  }
  return undefined;
}

/** A cor do destaque escolhido em `#rrggbb` (a livre, sem ajuste, se houver). */
export function corDoDestaqueEscolhido(p: Personalizacao): string {
  const c = corPedida(p);
  return p.destaqueLivre ?? hsl(c.h, c.s, c.l);
}

/** A cor do destaque em `#rrggbb`, para desenhar a amostra. */
export function corDoDestaque(id: DestaqueId): string {
  const c = COR_DO_DESTAQUE[id];
  return hsl(c.h, c.s, c.l);
}
