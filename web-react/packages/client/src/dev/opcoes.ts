/**
 * Chaves do arnês — para A/B, não para o produto.
 *
 * Existe porque adivinhar a causa de uma regressão de p95 custou duas corridas
 * de 30s e duas hipóteses erradas. A member list foi acusada e voltou com os
 * quatro contadores em ZERO; a máscara do ponto de presença foi acusada e o
 * p95 não se mexeu um décimo.
 *
 * O que sobrou de evidência veio do repositório, não de palpite: o
 * `MessageRow` da fase 0 era um `<article>` com className estática. Hoje ele
 * monta um `ContextMenu` do Radix inteiro — Root, Trigger com `asChild`,
 * Portal e Content — e isso entrou na FASE 2. Numa lista virtualizada, linha
 * monta e desmonta na velocidade do scroll, e o frame de append é exatamente
 * o que forma o p95.
 *
 * Uma chave que desliga o menu por linha transforma isso de teoria em
 * medição: mesma máquina, mesma carga, um número contra o outro.
 *
 * Store module-level como todo o resto, e assinada UMA vez pelo `MessageList`
 * — que repassa por prop. Assinar por linha acrescentaria uma subscrição por
 * linha à medição, contaminando justamente o que se quer medir.
 */
type Ouvinte = () => void;

export type Opcoes = {
  /** Desliga o `ContextMenu` por linha. Só o menu; o resto da linha é igual. */
  readonly semMenuPorLinha: boolean;
  /**
   * Volta ao CHUTE original de 44px. O default passou a ser a altura medida.
   *
   * O briefing registra desde a fase 0 que `estimateSize: () => 44` erra ~29px
   * por linha — a altura real média é ~73px, e o prepend só funciona porque a
   * compensação do virtualizador absorve o erro. Estava classificado como
   * "não é bug, é ajuste", com o custo descrito como "trabalho extra a cada
   * rolagem".
   *
   * Esse trabalho extra é candidato ao que separa o gate de passar: a cada
   * linha que monta, a altura real chega 29px acima da estimada, o total do
   * virtualizador salta e a âncora precisa compensar — no mesmo frame do
   * append, que é exatamente o frame lento.
   */
  readonly estimativaMedida: boolean;
};

let opcoes: Opcoes = { semMenuPorLinha: false, estimativaMedida: false };

const ouvintes = new Set<Ouvinte>();

export function assinarOpcoes(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Referência cacheada — a armadilha nº 1 vale aqui como em qualquer store. */
export function lerOpcoes(): Opcoes {
  return opcoes;
}

export function alternar(chave: keyof Opcoes): void {
  opcoes = { ...opcoes, [chave]: !opcoes[chave] };
  for (const ouvinte of ouvintes) ouvinte();
}
