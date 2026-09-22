/**
 * A navegação por setas dentro da grade de um seletor.
 *
 * O design escreve a regra por extenso: *"setas navegam o grid, Enter envia,
 * Tab troca de categoria, Esc fecha"*. Enter e Esc já existiam de graça — o
 * botão nativo responde a Enter e o `Popover` fecha no Esc —, e o que não
 * existia era a seta: os quatro seletores não tinham um `onKeyDown` sequer, e
 * a única forma de chegar ao emoji da terceira fileira era tabular por todos
 * os anteriores. Numa grade de 170 alvos isso é o mesmo que não ter teclado.
 *
 * ⚠ **A geometria é PURA e a leitura do DOM fica fora**, e a razão é o
 * instrumento: `offsetTop` e `getBoundingClientRect` devolvem zero em jsdom,
 * que não tem engine de layout — a lógica escrita dentro do handler seria
 * intestável até existir runner de navegador. Com a decisão isolada numa
 * função sobre retângulos, o teste descreve a grade que quiser e mede a
 * resposta.
 *
 * ⚠ **Fileira é descoberta, não contada.** Dividir o índice pelo número de
 * colunas exigiria saber quantas colunas há — e a grade do GIF é MASONRY, onde
 * a resposta muda por coluna, e a de emoji é `auto-fill`, onde ela muda com a
 * largura do painel. Duas células estão na mesma fileira quando os intervalos
 * verticais delas se cruzam; é a mesma pergunta nos dois layouts.
 */

/** Um alvo da grade, na caixa que o navegador mediu. */
export type Celula = {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
};

/** As teclas que esta navegação consome. */
export type TeclaDeGrade =
  | "ArrowRight"
  | "ArrowLeft"
  | "ArrowDown"
  | "ArrowUp"
  | "Home"
  | "End";

const TECLAS = new Set<string>([
  "ArrowRight",
  "ArrowLeft",
  "ArrowDown",
  "ArrowUp",
  "Home",
  "End",
]);

export function ehTeclaDeGrade(tecla: string): tecla is TeclaDeGrade {
  return TECLAS.has(tecla);
}

/** Duas células estão na mesma fileira quando se cruzam no eixo de bloco. */
function mesmaFileira(a: Celula, b: Celula): boolean {
  const cruzamento =
    Math.min(a.y + a.altura, b.y + b.altura) - Math.max(a.y, b.y);
  return cruzamento > Math.min(a.altura, b.altura) / 2;
}

function centro(c: Celula): number {
  return c.x + c.largura / 2;
}

/**
 * Para onde a tecla leva, ou `undefined` quando não há para onde ir.
 *
 * `undefined` e não "fica onde está": quem chama precisa distinguir os dois
 * para decidir se engole a tecla. Na borda de baixo da grade, `ArrowDown`
 * devolve `undefined` e a tecla passa — a rolagem do painel continua
 * funcionando, que é o que a pessoa espera de uma seta no fim da lista.
 *
 * Com `atual < 0` (o foco está no container, não numa célula) qualquer seta
 * entra na primeira célula: é como o teclado chega à grade depois de um Tab.
 */
export function proximaCelula(
  celulas: readonly Celula[],
  atual: number,
  tecla: TeclaDeGrade,
): number | undefined {
  if (celulas.length === 0) return undefined;
  if (atual < 0 || atual >= celulas.length) return 0;

  if (tecla === "Home") return atual === 0 ? undefined : 0;
  if (tecla === "End") {
    const fim = celulas.length - 1;
    return atual === fim ? undefined : fim;
  }

  /*
    Horizontal é a ORDEM DO DOM, e não o vizinho mais próximo em x.

    Numa grade essa ordem é a de leitura, então `ArrowRight` na última coluna
    cai na primeira da fileira seguinte — que é o que se espera de uma grade e
    o que o `role="grid"` do WAI-ARIA descreve. Procurar geometricamente à
    direita pararia no fim de cada fileira e obrigaria a descer à mão.
  */
  if (tecla === "ArrowRight") {
    return atual + 1 < celulas.length ? atual + 1 : undefined;
  }
  if (tecla === "ArrowLeft") {
    return atual > 0 ? atual - 1 : undefined;
  }

  const base = celulas[atual]!;
  const paraBaixo = tecla === "ArrowDown";

  /*
    A fileira ALVO é a primeira fileira depois da atual no sentido da tecla, e
    não "a célula mais próxima na vertical": com masonry a célula geometricamente
    mais próxima abaixo pode estar duas fileiras adiante numa coluna curta.
  */
  let alvoY: number | undefined;
  for (const c of celulas) {
    if (mesmaFileira(base, c)) continue;
    const depois = paraBaixo ? c.y > base.y : c.y < base.y;
    if (!depois) continue;
    if (alvoY === undefined) alvoY = c.y;
    else alvoY = paraBaixo ? Math.min(alvoY, c.y) : Math.max(alvoY, c.y);
  }
  if (alvoY === undefined) return undefined;

  const referencia = { ...base, y: alvoY };
  let melhor: number | undefined;
  let menorDistancia = Number.POSITIVE_INFINITY;
  for (let i = 0; i < celulas.length; i++) {
    const c = celulas[i]!;
    /*
      ⚠ **A fileira de origem é excluída, e sem isto a seta não anda.**

      A referência é a caixa da ORIGEM deslocada para o `y` da fileira alvo, e
      numa masonry uma caixa alta cruza as duas: a própria origem entrava na
      busca com distância horizontal ZERO e vencia sempre. O sintoma seria
      `ArrowUp` numa coluna alta não fazer nada — sem erro, como sempre.
    */
    if (mesmaFileira(base, c)) continue;
    if (!mesmaFileira(referencia, c)) continue;
    const distancia = Math.abs(centro(c) - centro(base));
    /*
      `<` e não `<=`: no empate exato ganha a primeira em ordem de DOM, e sem
      isso a coluna escolhida ao descer dependeria da ordem de iteração — o
      cursor andaria de lado em grades de largura par.
    */
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      melhor = i;
    }
  }
  return melhor;
}
