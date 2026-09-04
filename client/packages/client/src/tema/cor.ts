/**
 * Cor: sRGB ↔ OKLCH, e contraste WCAG.
 *
 * OKLCH e não HSL, e a diferença decide se o picker funciona: em HSL, "50% de
 * luminosidade" em amarelo e em azul produzem cores com brilho percebido
 * radicalmente diferente, então uma rampa de superfícies mudaria de contraste
 * conforme o matiz que o usuário escolhesse. Em OKLCH o L é perceptualmente
 * uniforme — a mesma rampa de L dá o mesmo contraste em qualquer matiz, e é
 * isso que permite GARANTIR legibilidade em vez de avisar sobre ela.
 *
 * As duas medidas vivem em espaços diferentes de propósito: escolhe-se em
 * OKLCH porque é o espaço em que humanos raciocinam sobre cor; verifica-se em
 * luminância relativa WCAG porque é a régua que a norma de acessibilidade
 * define. Misturar os dois — "OKLCH L de 0,5 logo passa" — seria trocar a
 * régua por uma aproximação dela.
 */

export type Oklch = { readonly l: number; readonly c: number; readonly h: number };

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function paraLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function paraSrgb(v: number): number {
  const s = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return s * 255;
}

export function hexParaRgb(hex: string): [number, number, number] {
  if (!HEX.test(hex)) {
    throw new Error(
      `valor não é hex: ${JSON.stringify(hex)} — nada aqui aprova por omissão`,
    );
  }
  const h = hex.replace("#", "").trim();
  const cheio = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(cheio.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
}

export function hexParaOklch(hex: string): Oklch {
  const [r, g, b] = hexParaRgb(hex).map(paraLinear) as [number, number, number];

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  return {
    l: L,
    c: Math.hypot(A, B),
    h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360,
  };
}

/** OKLCH → sRGB linear, sem recorte. Pode devolver valores fora de [0,1]. */
function oklchParaLinear(cor: Oklch): [number, number, number] {
  const rad = (cor.h * Math.PI) / 180;
  const A = cor.c * Math.cos(rad);
  const B = cor.c * Math.sin(rad);

  const l = (cor.l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (cor.l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (cor.l - 0.0894841775 * A - 1.291485548 * B) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function dentroDoGamut(cor: Oklch): boolean {
  const eps = 1e-6;
  return oklchParaLinear(cor).every((v) => v >= -eps && v <= 1 + eps);
}

/**
 * OKLCH → hex, reduzindo o CROMA até caber no sRGB.
 *
 * Recortar o RGB direto é o caminho fácil e errado: ele altera matiz e
 * luminosidade junto, então a cor entregue não é a que foi verificada — e a
 * verificação de contraste passaria a descrever uma cor que a tela nunca
 * mostra. Reduzir croma preserva L e H, que são exatamente o que o contraste e
 * a identidade dependem.
 *
 * Busca binária porque a fronteira do gamut não tem forma fechada em OKLCh.
 */
export function oklchParaHex(cor: Oklch): string {
  let usar = cor;

  if (!dentroDoGamut(cor)) {
    let baixo = 0;
    let alto = cor.c;
    for (let i = 0; i < 24; i++) {
      const meio = (baixo + alto) / 2;
      if (dentroDoGamut({ ...cor, c: meio })) baixo = meio;
      else alto = meio;
    }
    usar = { ...cor, c: baixo };
  }

  const canais = oklchParaLinear(usar)
    .map(paraSrgb)
    .map((v) => Math.round(Math.min(255, Math.max(0, v))));

  return `#${canais.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Luminância relativa, WCAG 2.1. A régua da norma, não uma aproximação dela. */
export function luminancia(hex: string): number {
  const [r, g, b] = hexParaRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function razao(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m) as [
    number,
    number,
  ];
  return (x + 0.05) / (y + 0.05);
}
