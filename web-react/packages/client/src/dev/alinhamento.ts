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

  const inicio = Math.abs(b.left - a.left);
  const largura = Math.abs(b.width - a.width);
  if (inicio <= TOLERANCIA_PX && largura <= TOLERANCIA_PX) return;

  console.warn(
    "[vortex] composer e coluna de mensagem não são a mesma caixa: " +
      `início difere ${inicio.toFixed(1)}px, largura difere ${largura.toFixed(1)}px. ` +
      "O teto vem do mesmo token; o que costuma divergir é padding interno ou a " +
      "reserva da calha da barra de rolagem (a lista reserva com " +
      "`scrollbar-gutter: stable`, o composer precisa reservar igual).",
  );
}
