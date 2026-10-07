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

/** Matiz (0-360), saturação e luminosidade do destaque, como o design os escolhe. */
const COR_DO_DESTAQUE: Record<DestaqueId, { readonly h: number; readonly s: number; readonly l: number }> = {
  lavanda: { h: 252, s: 100, l: 80 },
  menta: { h: 170, s: 70, l: 65 },
  ceu: { h: 205, s: 95, l: 72 },
  rosa: { h: 335, s: 90, l: 75 },
  pessego: { h: 22, s: 90, l: 72 },
  limao: { h: 80, s: 70, l: 68 },
};

export type Personalizacao = {
  readonly ativo: boolean;
  /** 0 a 360. */
  readonly matiz: number;
  /** 0 a 100. */
  readonly intensidade: number;
  readonly destaque: DestaqueId;
};

export const PERSONALIZACAO_PADRAO: Personalizacao = {
  ativo: false,
  matiz: 250,
  intensidade: 55,
  destaque: "lavanda",
};

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
): Record<string, string> {
  const cor = COR_DO_DESTAQUE[p.destaque];
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
};

const PASSOS_DE_CLARIDADE = [1, 0.85, 0.7, 0.55, 0.4, 0.3] as const;
const PASSOS_DE_SATURACAO = [1, 0.6, 0.3] as const;

/**
 * A paleta que passa no contraste, ou `undefined`. Escurece as superfícies e os
 * campos de cor (o texto é sempre claro, então escurecer só ajuda) e, se ainda
 * assim reprovar, tira saturação; mede de novo a cada passo.
 */
export function paletaValidada(base: BaseDoTema, p: Personalizacao): PaletaValidada | undefined {
  for (const saturacao of PASSOS_DE_SATURACAO) {
    for (const claridade of PASSOS_DE_CLARIDADE) {
      const papeis = derivarPapeis(p, claridade, saturacao);
      if (falhasDeContraste(base, papeis).length === 0) {
        return { papeis, ajustada: claridade !== 1 || saturacao !== 1 };
      }
    }
  }
  return undefined;
}

/** A cor do destaque em `#rrggbb`, para desenhar a amostra. */
export function corDoDestaque(id: DestaqueId): string {
  const c = COR_DO_DESTAQUE[id];
  return hsl(c.h, c.s, c.l);
}
