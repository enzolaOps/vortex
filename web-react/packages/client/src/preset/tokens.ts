/**
 * Os tokens que um tema de usuário pode sobrescrever. União FECHADA.
 *
 * É o mecanismo da regra "picker no nível do token, nunca do componente":
 * `Record<TokenName, string>` com `TokenName` fechado significa que tema com
 * chave arbitrária não compila. A regra deixa de depender de revisão.
 *
 * Só COR entra. Espaçamento, raio, tipo e duração ficam de fora, e isso não é
 * conservadorismo — é o que mantém a validação de contraste possível: o app
 * consegue afirmar que uma paleta é legível, não consegue afirmar nada sobre
 * uma escala de espaçamento que o usuário inventou. Densidade, se um dia for
 * customizável, é outra feature com outras garantias.
 *
 * A lista é conferida contra `tokens.css` por teste: token de cor novo na
 * camada 1 reprova o build até alguém decidir se ele é tematizável. O default
 * de uma decisão esquecida vira "reprova", não "vaza".
 */
export const TOKENS_DE_TEMA = [
  "--vx-surface-0",
  "--vx-surface-1",
  "--vx-surface-2",
  "--vx-surface-3",

  "--vx-text-1",
  "--vx-text-2",
  "--vx-text-3",

  "--vx-border-subtle",
  "--vx-border-strong",

  "--vx-accent",
  "--vx-accent-hover",
  "--vx-accent-soft",
  "--vx-on-accent",

  "--vx-danger",
  "--vx-warning",
  "--vx-success",

  "--vx-status-online",
  "--vx-status-idle",
  "--vx-status-dnd",
  "--vx-status-offline",
] as const;

export type TokenName = (typeof TOKENS_DE_TEMA)[number];

const CONHECIDOS = new Set<string>(TOKENS_DE_TEMA);

export function ehTokenDeTema(nome: string): nome is TokenName {
  return CONHECIDOS.has(nome);
}

/** O tema depois da leitura: só chave conhecida, valores ainda não validados. */
export type TemaValido = Partial<Record<TokenName, string>>;
