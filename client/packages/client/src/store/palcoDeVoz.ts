/**
 * O que o palco de voz está mostrando.
 *
 * ⚠ **União marcada, e não três booleanos.** As três telas do design —
 * transmitindo, a grade e assistindo alguém — são MUTUAMENTE exclusivas, e com
 * booleanos separados existiriam estados como "transmitindo e assistindo ao
 * mesmo tempo" que a interface não sabe desenhar. `assistindo` carrega de
 * quem, então "assistindo sem saber quem" também deixa de ser representável.
 *
 * É a mesma mecânica de `Local` na navegação e de `Alvo` na administração.
 *
 * ⚠ **Store próprio, e não um campo de `Chamada`.** Quem assina a chamada é o
 * cartão flutuante, a faixa do rodapé, o painel de usuário e a linha do canal
 * de voz — todos eles acordariam a cada troca de aba do palco, que é uma
 * preferência de JANELA e não um fato sobre a chamada. É a lei nº 1 na mesma
 * forma que separou `falando` de `Chamada`.
 *
 * ⚠ **Ele abre sozinho quando a transmissão começa, e é a razão de existir.**
 * O sintoma relatado por quem usa foi exatamente este: compartilhar a tela
 * ligava o botão e mais nada acontecia na interface — sem prévia, sem selo de
 * ao vivo, sem forma de parar que não fosse o mesmo botão. Um app que
 * transmite a sua tela e não te mostra o que está transmitindo é pior que um
 * que não transmite.
 *
 * Fechar o palco NÃO para a transmissão nem sai da chamada: são coisas
 * diferentes, e juntá-las faria "quero ver o chat" significar "quero sair do
 * ar". É o mesmo que o design escreve sobre "Parar de assistir" — ele volta
 * para a grade sem sair da voz.
 */

export type Palco =
  | { readonly tipo: "fechado" }
  | { readonly tipo: "transmitindo" }
  | { readonly tipo: "grade" }
  | { readonly tipo: "assistindo"; readonly userId: string };

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const FECHADO: Palco = { tipo: "fechado" };

/** Referência cacheada — armadilha nº 1 do briefing. */
let palco: Palco = FECHADO;

export function assinarPalco(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerPalco(): Palco {
  return palco;
}

export function definirPalco(proximo: Palco): void {
  /*
    Comparação por CAMPO e não por referência: quem chama monta o objeto no
    handler, e por referência dois cliques no mesmo alvo republicariam o store
    à toa. É a mesma decisão do alvo do menu de mensagem.
  */
  if (palco.tipo === proximo.tipo) {
    if (palco.tipo !== "assistindo") return;
    if (palco.userId === (proximo as { userId: string }).userId) return;
  }
  palco = proximo;
  for (const o of ouvintes) o();
}

export function fecharPalco(): void {
  definirPalco(FECHADO);
}
