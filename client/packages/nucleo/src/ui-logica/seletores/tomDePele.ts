/**
 * Tom de pele — os modificadores Fitzpatrick do Unicode.
 *
 * ⚠ **O tom não é um emoji diferente, é um CARACTERE a mais** (U+1F3FB a
 * U+1F3FF) colado depois da base. Por isso a lista curada de `emojis.ts` não
 * precisou mudar: o glifo com tom se DERIVA do glifo sem tom.
 *
 * ⚠ **Só a base que o Unicode declara `Emoji_Modifier_Base` aceita.** Colar o
 * modificador em 👀 ou 🧠 não pinta nada: o sistema desenha os dois caracteres
 * lado a lado — um olho e um quadradinho marrom. É o defeito que um "aplica em
 * tudo" produziria em metade da grade.
 */

export const TONS = [
  "padrao",
  "claro",
  "medioClaro",
  "medio",
  "medioEscuro",
  "escuro",
] as const;

export type TomDePele = (typeof TONS)[number];

/** O modificador de cada tom. `padrao` é a ausência dele — o amarelo. */
const MODIFICADOR: Record<TomDePele, string> = {
  padrao: "",
  claro: "\u{1F3FB}",
  medioClaro: "\u{1F3FC}",
  medio: "\u{1F3FD}",
  medioEscuro: "\u{1F3FE}",
  escuro: "\u{1F3FF}",
};

export const ROTULO_DO_TOM: Record<TomDePele, string> = {
  padrao: "Padrão",
  claro: "Claro",
  medioClaro: "Médio-claro",
  medio: "Médio",
  medioEscuro: "Médio-escuro",
  escuro: "Escuro",
};

/**
 * `Emoji_Modifier_Base` do `emoji-data.txt` (Unicode 15.1), em faixas.
 *
 * Copiado do padrão e não inferido de "parece mão": 🤝 só virou base no
 * Unicode 14, e 👯 (pessoas com orelha de coelho) é base enquanto 👪 não é.
 */
const BASES: readonly (readonly [number, number])[] = [
  [0x261d, 0x261d],
  [0x26f9, 0x26f9],
  [0x270a, 0x270d],
  [0x1f385, 0x1f385],
  [0x1f3c2, 0x1f3c4],
  [0x1f3c7, 0x1f3c7],
  [0x1f3ca, 0x1f3cc],
  [0x1f442, 0x1f443],
  [0x1f446, 0x1f450],
  [0x1f466, 0x1f478],
  [0x1f47c, 0x1f47c],
  [0x1f481, 0x1f483],
  [0x1f485, 0x1f487],
  [0x1f48f, 0x1f48f],
  [0x1f491, 0x1f491],
  [0x1f4aa, 0x1f4aa],
  [0x1f574, 0x1f575],
  [0x1f57a, 0x1f57a],
  [0x1f590, 0x1f590],
  [0x1f595, 0x1f596],
  [0x1f645, 0x1f647],
  [0x1f64b, 0x1f64f],
  [0x1f6a3, 0x1f6a3],
  [0x1f6b4, 0x1f6b6],
  [0x1f6c0, 0x1f6c0],
  [0x1f6cc, 0x1f6cc],
  [0x1f90c, 0x1f90c],
  [0x1f90f, 0x1f90f],
  [0x1f918, 0x1f91f],
  [0x1f926, 0x1f926],
  [0x1f930, 0x1f939],
  [0x1f93c, 0x1f93e],
  [0x1f977, 0x1f977],
  [0x1f9b5, 0x1f9b6],
  [0x1f9b8, 0x1f9b9],
  [0x1f9bb, 0x1f9bb],
  [0x1f9cd, 0x1f9cf],
  [0x1f9d1, 0x1f9dd],
  [0x1fac3, 0x1fac5],
  [0x1faf0, 0x1faf8],
];

/** O primeiro ponto de código aceita tom? */
export function aceitaTom(glifo: string): boolean {
  const base = glifo.codePointAt(0);
  if (base === undefined) return false;
  return BASES.some(([de, ate]) => base >= de && base <= ate);
}

const SELETOR_DE_VARIACAO = "\u{FE0F}";
const MODIFICADORES = /[\u{1F3FB}-\u{1F3FF}]/u;

/**
 * O glifo no tom escolhido — ou o próprio glifo, quando ele não aceita.
 *
 * O modificador entra DEPOIS do primeiro ponto de código, e o seletor de
 * variação que o seguia (✌️ = U+270C U+FE0F) sai: o modificador já força a
 * apresentação em emoji, e manter os dois produz uma sequência que parte das
 * fontes desenha como dois glifos.
 *
 * Glifo que já traz tom fica como está — trocar o tom de quem escolheu um
 * específico não é "tom padrão", é reescrever a escolha de outra pessoa.
 */
export function comTom(glifo: string, tom: TomDePele): string {
  if (tom === "padrao" || !aceitaTom(glifo) || MODIFICADORES.test(glifo)) {
    return glifo;
  }
  const base = String.fromCodePoint(glifo.codePointAt(0)!);
  let resto = glifo.slice(base.length);
  if (resto.startsWith(SELETOR_DE_VARIACAO)) {
    resto = resto.slice(SELETOR_DE_VARIACAO.length);
  }
  return base + MODIFICADOR[tom] + resto;
}
