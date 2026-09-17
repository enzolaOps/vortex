/**
 * As teclas 1–9 do soundboard, sem abrir o painel.
 *
 * Função pura para o teste alcançar a regra que decide — é ela que precisa
 * NÃO disparar enquanto alguém digita um "1" numa mensagem.
 */

/** Os nove primeiros sons, na ordem do servidor. */
export const TECLAS_DO_SOUNDBOARD = 9;

type Tecla = {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly repeat: boolean;
  readonly target: EventTarget | null;
};

/** O alvo aceita texto? Ali o dígito é do texto, não do painel. */
function editavel(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable === true;
}

/**
 * O índice (0–8) do som que esta tecla dispara, ou nada.
 *
 * ⚠ **`repeat` é recusado**: segurar a tecla dispararia o som trinta vezes por
 * segundo para a sala inteira — o teto de simultâneos protege quem ouve, não
 * a paciência de quem está na chamada.
 */
export function indiceDaTecla(e: Tecla): number | undefined {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return undefined;
  if (editavel(e.target)) return undefined;
  if (!/^[1-9]$/.test(e.key)) return undefined;
  const i = Number(e.key) - 1;
  return i < TECLAS_DO_SOUNDBOARD ? i : undefined;
}
