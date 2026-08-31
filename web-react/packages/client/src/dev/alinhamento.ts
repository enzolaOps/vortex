/**
 * Composer e coluna de mensagem ocupam a MESMA caixa.
 *
 * `design-system.md`: "o composer segue exatamente a mesma largura da coluna de
 * mensagem; desalinhar os dois é o erro visual mais perceptível da tela
 * principal". Era prosa, e prosa não pega isto — eu mesmo entreguei os dois
 * desalinhados em 16px na primeira versão do composer, com o token do teto
 * correto nos dois lados. O teto igual não basta: padding, calha da barra de
 * rolagem e caixa do container entram na conta.
 *
 * Por isso a checagem é sobre a GEOMETRIA MEDIDA, não sobre o valor declarado.
 * Comparar `max-inline-size` aprovaria exatamente o bug que aconteceu.
 *
 * Só em dev, e some do bundle de produção.
 */

const TOLERANCIA_PX = 1;

/** Marcador de dev nos dois lados. O seletor é o contrato entre eles. */
export const ATRIBUTO_DE_COLUNA = "data-vx-coluna";

/**
 * Liga a verificação, e a religa quando a janela muda.
 *
 * ⚠ **A versão anterior rodava UMA VEZ, na montagem — e nasceu cega.** O
 * desalinho que ela existia para pegar só aparecia acima de 1100px de trilha,
 * e se o app montasse abaixo disso ela nunca mais olhava. Medido em janela de
 * 2560px: a linha tinha 1100 e o campo 990, e o console estava limpo.
 *
 * Guarda que só observa o instante da montagem não guarda um layout responsivo
 * — ele muda depois, que é a definição de responsivo.
 */
export function observarAlinhamentoDeColuna(): () => void {
  if (!import.meta.env.DEV) return () => {};

  verificarAlinhamentoDeColuna();
  const observador = new ResizeObserver(() => verificarAlinhamentoDeColuna());
  observador.observe(document.documentElement);
  return () => observador.disconnect();
}

export function verificarAlinhamentoDeColuna(): void {
  if (!import.meta.env.DEV) return;

  const mensagem = document.querySelector(`[${ATRIBUTO_DE_COLUNA}="mensagem"]`);
  const composer = document.querySelector(`[${ATRIBUTO_DE_COLUNA}="composer"]`);
  // Um dos dois pode não estar montado — thread em popout, canal sem composer.
  if (!mensagem || !composer) return;

  const a = mensagem.getBoundingClientRect();
  const b = composer.getBoundingClientRect();

  // Painel de largura zero (coluna colapsada) não tem alinhamento a violar.
  if (a.width === 0 || b.width === 0) return;

  /*
    O que precisa concordar é a BORDA DE FIM, não a de início.

    As duas caixas nascem em pontos diferentes de propósito: o conteúdo da
    linha começa depois da calha do avatar, e o campo começa no recuo do
    painel — o campo é o análogo da linha inteira, não do parágrafo dentro
    dela. O que o olho liga é o fim: o texto que se lê e o texto que se
    escreve terminam na mesma vertical.

    A versão anterior comparava início e largura, e por isso não podia
    sobreviver à faixa passar a cobrir a trilha — ela reprovaria uma
    geometria correta.
  */
  const fim = Math.abs(b.right - a.right);
  if (fim <= TOLERANCIA_PX) return;

  console.warn(
    "[vortex] composer e conteúdo da mensagem não terminam na mesma vertical: " +
      `difere ${fim.toFixed(1)}px. ` +
      "Nenhum dos dois tem teto: os dois cobrem a trilha, e o que os alinha " +
      "é o recuo próprio de cada um. O que costuma divergir é esse recuo, ou " +
      "a reserva da calha da barra de rolagem — a lista reserva, e o composer " +
      "precisa reservar igual.",
  );
}
