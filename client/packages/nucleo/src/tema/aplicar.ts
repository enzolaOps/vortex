/**
 * Escreve a paleta na camada 1.
 *
 * É literalmente sobrescrever CSS custom property no elemento raiz — o
 * mecanismo nativo, não uma feature nova. É a razão de a arquitetura de estilo
 * ter três camadas com os tokens em CSS puro: o Tailwind não sabe que temas
 * existem, as utilities apontam para as mesmas vars, e trocar a var reflui
 * tudo de graça.
 *
 * Um `styled-components` ou um Panda aqui exigiriam re-render ou rebuild para
 * a mesma troca. Foi essa restrição — "o Stoat suporta tema de usuário,
 * trocado em runtime" — que eliminou as duas famílias lá atrás.
 */
import type { TokenName } from "../preset/tokens";
import { derivar, type Semente } from "./derivar";

/**
 * A paleta final: a derivada da semente, com os overrides crus por cima.
 *
 * A ordem não é arbitrária. A semente é validada — a varredura prova que
 * nenhuma escolha dela produz paleta ilegível. O override cru NÃO é, e é a
 * escotilha que a referência prevê para "se depois for preciso dar mais
 * poder". Deixá-lo por cima é reconhecer que quem usa a escotilha assume o
 * risco; deixá-lo por baixo seria fingir que ele não existe.
 */
export function paletaFinal(
  semente: Semente,
  overrides?: Partial<Record<TokenName, string>>,
): Record<TokenName, string> {
  return { ...derivar(semente), ...overrides };
}

/**
 * Aplica no documento.
 *
 * `modo` vai para `data-theme` porque o `color-scheme` e os blocos de tema do
 * `tokens.css` dependem dele — e porque o navegador precisa saber, para
 * pintar scrollbar e controle nativo do lado certo.
 */
export function aplicarTema(
  semente: Semente,
  overrides?: Partial<Record<TokenName, string>>,
  raiz: HTMLElement = document.documentElement,
): void {
  raiz.dataset.theme = semente.modo === "claro" ? "light" : "dark";

  const paleta = paletaFinal(semente, overrides);
  for (const [token, valor] of Object.entries(paleta)) {
    raiz.style.setProperty(token, valor);
  }
}

/**
 * Remove o tema de usuário, devolvendo o do `tokens.css`.
 *
 * Precisa apagar propriedade por propriedade: `style.cssText = ""` levaria
 * junto qualquer var que outra parte do app tenha escrito na raiz, e depurar
 * isso depois seria caçar um efeito colateral sem rastro.
 */
export function limparTema(
  tokens: readonly TokenName[],
  raiz: HTMLElement = document.documentElement,
): void {
  for (const token of tokens) raiz.style.removeProperty(token);
}
