/**
 * O nome da categoria como a coluna de canais vai mostrá-lo — D-CANAIS-30.
 *
 * A coluna põe o título em caixa alta por CSS (`sobrancelhaDeSecao`), e o
 * modal diz "exibida em maiúsculas, independente de como você digitar". A
 * prévia é o que torna a frase verificável antes de criar. Vazia, ela mostra
 * "NOVA CATEGORIA" — o design escreve `(catName || "nova categoria")
 * .toUpperCase()` — em vez de um cabeçalho em branco, que leria como defeito.
 *
 * Em maiúsculas no TEXTO, e não só por `text-transform`: a prévia é a
 * afirmação de que o nome vira caixa alta, e ela precisa valer também para
 * quem a lê copiando ou por teste.
 */
export function rotuloDePrevia(nome: string): string {
  const limpo = nome.trim();
  return (limpo.length > 0 ? limpo : "nova categoria").toLocaleUpperCase("pt-BR");
}
