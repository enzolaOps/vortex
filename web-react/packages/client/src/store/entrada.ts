/**
 * Qual tela de entrada está na frente.
 *
 * O portão de sessão decide se o app aparece; este store decide QUAL das telas
 * de fora aparece quando ele não aparece. São perguntas diferentes: a sessão é
 * "quem é você", e isto é "o que você está tentando fazer".
 *
 * Store module-level, como todo o resto — e aqui a razão é literal: duas destas
 * telas nascem de um **link de e-mail**, ou seja, de uma URL lida na abertura,
 * antes de existir árvore de componente nenhuma.
 */

/**
 * As telas, como união marcada.
 *
 * `verificar` e `redefinir` carregam o token do e-mail. Ele é dado de uso
 * único e de vida curta, e mora aqui — não no `localStorage` — porque some
 * junto com a tela: guardá-lo seria manter um segredo depois de ele ter
 * servido.
 */
export type TelaDeEntrada =
  | { readonly tipo: "entrar" }
  | { readonly tipo: "criar" }
  | { readonly tipo: "recuperar" }
  /**
   * "Confira seu e-mail".
   *
   * O endereço é opcional de propósito: ele NÃO vai para a URL — endereço de
   * e-mail em barra de endereço fica em histórico, em log de proxy e em print
   * de tela. Quem recarrega esta tela vê o texto sem o endereço, que é uma
   * perda pequena perto de vazar o dado.
   */
  | { readonly tipo: "conferirEmail"; readonly email: string | undefined }
  | { readonly tipo: "verificar"; readonly token: string }
  | { readonly tipo: "redefinir"; readonly token: string }
  /**
   * Um convite aberto por link, ANTES de haver sessão.
   *
   * O caso comum de convite é justamente esse: alguém manda o link para quem
   * ainda não tem conta aqui. Sem esta tela o clique cairia no login e o
   * código se perderia — a pessoa criaria a conta e não saberia mais para onde
   * ia. Com ela, o convite espera do outro lado da entrada.
   */
  | { readonly tipo: "convite"; readonly codigo: string };

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const ENTRAR: TelaDeEntrada = { tipo: "entrar" };

/** Referência cacheada — armadilha nº 1, e agora é objeto. */
let tela: TelaDeEntrada = ENTRAR;

export function assinarEntrada(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerEntrada(): TelaDeEntrada {
  return tela;
}

export function definirEntrada(nova: TelaDeEntrada): void {
  if (tela.tipo === nova.tipo && tela.tipo !== "conferirEmail") {
    // Mesmo tipo com token diferente ainda é troca; só as telas sem carga é
    // que podem ser ignoradas.
    if (
      (tela.tipo !== "verificar" && tela.tipo !== "redefinir") ||
      (tela as { token: string }).token === (nova as { token: string }).token
    ) {
      return;
    }
  }
  tela = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

export function voltarParaEntrar(): void {
  definirEntrada(ENTRAR);
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparEntrada(): void {
  tela = ENTRAR;
}
