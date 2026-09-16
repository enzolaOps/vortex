/**
 * As linhas que a `GradeVirtual` virtualiza, dados os grupos e as colunas.
 *
 * ⚠ **O rótulo de grupo é LINHA do virtualizador, e não cabeçalho fixo.** Um
 * `cabecalho` só serve a um grupo; a galeria tem um por dia ("Hoje", "Ontem",
 * …), e cada um precisa rolar junto com os itens dele. Se os rótulos ficassem
 * fora da contagem, a posição de toda linha abaixo do segundo dia estaria
 * errada pela altura dos rótulos acima dela.
 *
 * Um grupo sem rótulo não produz linha de rótulo — é o fórum, que é um grupo
 * só.
 */

export type GrupoDaGrade = {
  readonly chave: string;
  readonly rotulo: string | undefined;
  readonly ids: readonly string[];
};

export type LinhaDaGrade =
  | { readonly tipo: "rotulo"; readonly chave: string; readonly rotulo: string }
  | { readonly tipo: "itens"; readonly chave: string; readonly ids: readonly string[] };

export function linhasDaGrade(
  grupos: readonly GrupoDaGrade[],
  colunas: number,
): readonly LinhaDaGrade[] {
  const n = Math.max(1, colunas);
  const linhas: LinhaDaGrade[] = [];
  for (const g of grupos) {
    if (g.ids.length === 0) continue;
    if (g.rotulo !== undefined) linhas.push({ tipo: "rotulo", chave: `r:${g.chave}`, rotulo: g.rotulo });
    for (let i = 0; i < g.ids.length; i += n) {
      const ids = g.ids.slice(i, i + n);
      // A primeira id da linha E a quantidade de colunas: mudar de coluna muda
      // o que cada linha contém, e reaproveitar a medição seria mentir.
      linhas.push({ tipo: "itens", chave: `${ids[0]}:${n}`, ids });
    }
  }
  return linhas;
}
