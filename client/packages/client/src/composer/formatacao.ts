/**
 * As duas edições que uma régua de formatação faz num campo de texto.
 *
 * Puras, e fora do componente, porque são elas que decidem se o markdown sai
 * certo — e "envolveu o texto inteiro em vez da seleção" (D-CCANAL-04) foi
 * exatamente o defeito que passou por tela, typecheck e lint sem ruído.
 *
 * As duas devolvem o texto novo E onde o cursor fica: quem aplica precisa das
 * duas coisas, e recalcular a seleção do lado de fora é onde o cursor volta
 * para o fim do campo.
 */

export type Edicao = {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
};

/**
 * Envolve a SELEÇÃO `[a, b)` com a marca, e a seleção continua sendo o mesmo
 * trecho — agora dentro das marcas.
 *
 * Sem seleção (`a === b`), a marca entra vazia com o cursor no meio: é o que
 * todo editor faz, e o que permite marcar antes de escrever.
 *
 * `limite`: se o resultado passar dele, a edição NÃO acontece (`undefined`).
 * Cortar seria pior — o corte cairia na marca de fechamento e o markdown
 * ficaria aberto, que é o texto que o autor não escreveu.
 */
export function envolverSelecao(
  texto: string,
  a: number,
  b: number,
  marca: string,
  limite?: number,
): Edicao | undefined {
  const inicio = Math.min(a, b);
  const fim = Math.max(a, b);
  const novo =
    texto.slice(0, inicio) + marca + texto.slice(inicio, fim) + marca + texto.slice(fim);
  if (limite !== undefined && novo.length > limite) return undefined;
  return { texto: novo, inicio: inicio + marca.length, fim: fim + marca.length };
}

/**
 * Insere no CURSOR, substituindo a seleção se houver, e deixa o cursor depois
 * do que entrou. Concatenar no fim faria o glifo saltar para o final de uma
 * frase já escrita.
 */
export function inserirNoCursor(
  texto: string,
  a: number,
  b: number,
  trecho: string,
  limite?: number,
): Edicao | undefined {
  const inicio = Math.min(a, b);
  const fim = Math.max(a, b);
  const novo = texto.slice(0, inicio) + trecho + texto.slice(fim);
  if (limite !== undefined && novo.length > limite) return undefined;
  const cursor = inicio + trecho.length;
  return { texto: novo, inicio: cursor, fim: cursor };
}

/** O tom de um contador "N / limite" — o do design (D-CCANAL-03). */
export type TomDoContador = "neutro" | "aviso" | "perigo";

/**
 * Neutro abaixo de 90%, aviso a partir de 90%, perigo ao bater o limite.
 *
 * Por PROPORÇÃO e não por caracteres restantes: o design escreve `over >= 90`
 * sobre a porcentagem, e o mesmo contador serve a limites diferentes.
 */
export function tomDoContador(n: number, limite: number): TomDoContador {
  if (limite <= 0) return "neutro";
  const proporcao = (n / limite) * 100;
  if (proporcao >= 100) return "perigo";
  if (proporcao >= 90) return "aviso";
  return "neutro";
}
