/**
 * O texto a inserir, com espaço onde ele encostaria numa palavra.
 *
 * ⚠ **Existe por causa do link do GIF.** Inserir `https://…` colado ao fim de
 * "olha isso" dava `issohttps://…` — e o autolink só reconhece URL que começa
 * numa fronteira, então a mensagem saía com o link quebrado e sem erro. O
 * emoji não precisa disto: ele é glifo, não palavra.
 *
 * `a` e `b` são o início e o fim da seleção que o texto substitui.
 */
export function isolar(valor: string, a: number, b: number, texto: string): string {
  const antes = valor.slice(0, a);
  const depois = valor.slice(b);
  const espacoAntes = antes !== "" && !/\s$/.test(antes) ? " " : "";
  const espacoDepois = !/^\s/.test(depois) ? " " : "";
  return `${espacoAntes}${texto}${espacoDepois}`;
}
