/**
 * Os degraus de modo lento, em segundos — os SETE do design (D-CCANAL-05):
 * Desativado · 5 s · 30 s · 1 min · 5 min · 15 min · 1 h.
 *
 * ⚠ **Eram catorze, até 6 h, e a justificativa não segurava.** O comentário
 * dizia que a lista parava em 6 h "porque é o TETO do protocolo" — verdade
 * sobre o teto (o validador recusa acima de 21600), e nada sobre por que
 * haveria catorze degraus em vez de sete. Os sete cabem todos abaixo do teto.
 * Quem garante o corte continua sendo o `min` em `sdk/canal.ts`; esta lista é
 * de exibição.
 */
export const DEGRAUS_DE_MODO_LENTO: readonly number[] = [0, 5, 30, 60, 300, 900, 3600];

/**
 * Os degraus a mostrar, com o valor ATUAL do canal entrando se não for um
 * deles.
 *
 * Outro cliente pode gravar 10 s ou 2 h. Sem esta entrada o gatilho diria "10
 * segundos" e a lista não teria item marcado — e escolher qualquer outro
 * apagaria um valor que ninguém nesta tela escolheu. Mesma decisão da região
 * de voz retirada da configuração.
 */
export function degrausDeModoLento(atual: number): readonly number[] {
  if (DEGRAUS_DE_MODO_LENTO.includes(atual)) return DEGRAUS_DE_MODO_LENTO;
  return [...DEGRAUS_DE_MODO_LENTO, atual].sort((a, b) => a - b);
}

/**
 * `0` é DESATIVADO e não "zero segundos" — a diferença é o que a linha diz.
 *
 * Valor que não fecha na unidade maior desce para a menor: 90 s gravado por
 * outro cliente é "90 segundos", nunca "1.5 minutos".
 */
export function rotuloDoModoLento(s: number): string {
  if (s <= 0) return "Desativado";
  if (s < 60 || s % 60 !== 0) return `${String(s)} segundos`;
  if (s < 3600 || s % 3600 !== 0) {
    const m = s / 60;
    return m === 1 ? "1 minuto" : `${String(m)} minutos`;
  }
  const h = s / 3600;
  return h === 1 ? "1 hora" : `${String(h)} horas`;
}
