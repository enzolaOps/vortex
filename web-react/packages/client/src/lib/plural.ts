/**
 * Concordância de número para os rótulos de leitor de tela.
 *
 * Existe porque "1 menções" saiu literalmente na primeira verificação em
 * navegador. É texto que só quem usa leitor de tela ouve — ou seja, exatamente
 * o texto que ninguém relê, e por isso o que mais precisa de mecanismo em vez
 * de atenção.
 *
 * `Intl.PluralRules` e não `n === 1`: pt-BR tem duas formas e a comparação
 * direta funcionaria, mas o dia em que houver locale com três a regra já está
 * no lugar certo. Um objeto por sessão, como os outros formatadores de Intl.
 */
const REGRAS = new Intl.PluralRules("pt-BR");

/** Acima disso a contagem exata deixa de informar e vira "99+". */
export const TETO_DE_CONTAGEM = 99;

export function contagem(n: number): string {
  return n > TETO_DE_CONTAGEM ? `${TETO_DE_CONTAGEM}+` : String(n);
}

/**
 * `plural(3, "menção", "menções")` → "3 menções".
 *
 * Acima do teto a forma é sempre plural: "99+ menções" está certo em qualquer
 * leitura, e "99+ menção" não.
 */
export function plural(n: number, um: string, muitos: string): string {
  const forma = n > TETO_DE_CONTAGEM ? "other" : REGRAS.select(n);
  return `${contagem(n)} ${forma === "one" ? um : muitos}`;
}

/** O rótulo completo de não-lidas, usado pelo rail e pela lista de canais. */
export function rotuloDeNaoLidas(naoLidas: number, mencoes: number): string {
  const base = plural(naoLidas, "não lida", "não lidas");
  if (mencoes === 0) return base;
  return `${plural(mencoes, "menção", "menções")}, ${base}`;
}
