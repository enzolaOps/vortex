import type { Page } from "@playwright/test";

/** A chave onde o app guarda a sessão. Espelha `nucleo/store/sessao`. */
export const CHAVE_DA_SESSAO = "vortex.sessao";

/**
 * Instala uma sessão guardada FALSA antes de qualquer script da página rodar.
 *
 * Serve às specs de fumaça, que olham o shell e rodam sem back-end: o portão
 * restaura de forma otimista (mostra o app e só cai para a entrada se o servidor
 * recusar o token), então um token qualquer basta para chegar ao shell. NÃO é
 * login — o login de verdade é `4.1-sessao.spec.ts`, contra a pilha local.
 */
export async function comSessaoFalsa(page: Page): Promise<void> {
  await page.addInitScript((chave) => {
    localStorage.setItem(
      chave,
      JSON.stringify({ _id: "01E2EFALSA00000000000000", token: "token-falso-so-para-fumaca", user_id: "01E2EFALSA00000000000001" }),
    );
  }, CHAVE_DA_SESSAO);
}
