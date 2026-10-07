/**
 * Comparação de versões no formato semver (`x.y.z`, com pré-release opcional).
 *
 * Serve à atualização obrigatória: o servidor diz a versão mínima da casca
 * (`features.desktop_min_version`) e a casca diz a instalada. Sem dependência
 * — o formato que as duas pontas produzem é o do `package.json`, e um parser
 * completo de semver seria biblioteca para três números e um sufixo.
 */

type Versao = {
  readonly numeros: readonly [number, number, number];
  readonly pre: readonly string[];
};

const FORMATO = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export function lerVersao(texto: string): Versao | undefined {
  const m = FORMATO.exec(texto.trim());
  if (!m) return undefined;
  return {
    numeros: [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)],
    pre: m[4] ? m[4].split(".") : [],
  };
}

function compararPre(a: readonly string[], b: readonly string[]): number {
  /* Sem pré-release é MAIOR que com: 4.2.0-beta vem antes de 4.2.0. */
  if (a.length === 0 || b.length === 0) return b.length - a.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i];
    const y = b[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    if (nx) return -1;
    if (ny) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

/** -1, 0 ou 1. `undefined` quando uma das duas não é versão. */
export function compararVersoes(a: string, b: string): -1 | 0 | 1 | undefined {
  const va = lerVersao(a);
  const vb = lerVersao(b);
  if (!va || !vb) return undefined;
  for (let i = 0; i < 3; i++) {
    const d = va.numeros[i]! - vb.numeros[i]!;
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  const p = compararPre(va.pre, vb.pre);
  return p === 0 ? 0 : p < 0 ? -1 : 1;
}

/**
 * A instalada está abaixo da mínima exigida?
 *
 * ⚠ **Mínima ausente ou malformada dá `false`.** Bloquear o app inteiro é a
 * ação mais forte que a interface tem; errar para o lado de bloquear por uma
 * string que o servidor escreveu errado deixaria todo mundo sem app, e sem
 * nenhum caminho de volta que não seja editar o servidor.
 */
export function versaoAbaixoDoMinimo(
  instalada: string,
  minima: string | undefined,
): boolean {
  if (minima === undefined || minima.trim() === "") return false;
  return compararVersoes(instalada, minima) === -1;
}
