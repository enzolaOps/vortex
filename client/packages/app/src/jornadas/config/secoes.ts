import type { SecaoId } from "nucleo/store/config";

import { config } from "../../textos";

/**
 * As seções desta jornada (PRD 4.6). O núcleo conhece mais — servidor, cargos,
 * canal —, mas essas são da administração (4.7) e não moram na casca de quem
 * ajusta a própria conta.
 */
export const SECOES_ESSENCIAIS = [
  "perfil",
  "conta",
  "sessoes",
  "vozEVideo",
  "notificacoes",
  "aparencia",
] as const satisfies readonly SecaoId[];

export type SecaoEssencial = (typeof SECOES_ESSENCIAIS)[number];

/** `Record` exaustivo: seção nova não compila sem nome e sem subtítulo. */
export const NOME_DA_SECAO: Record<SecaoEssencial, string> = {
  perfil: config.perfil,
  conta: config.conta,
  sessoes: config.dispositivos,
  vozEVideo: config.vozEVideo,
  notificacoes: config.notificacoes,
  aparencia: config.aparencia,
};

export const SUBTITULO_DA_SECAO: Record<SecaoEssencial, string> = {
  perfil: config.subtitulos.perfil,
  conta: config.subtitulos.conta,
  sessoes: config.subtitulos.dispositivos,
  vozEVideo: config.subtitulos.vozEVideo,
  notificacoes: config.subtitulos.notificacoes,
  aparencia: config.subtitulos.aparencia,
};

/** A navegação em dois grupos, na ordem da tela. */
export const GRUPOS_DA_NAVEGACAO: readonly {
  readonly titulo: string;
  readonly itens: readonly SecaoEssencial[];
}[] = [
  { titulo: config.grupoConta, itens: ["perfil", "conta", "sessoes"] },
  { titulo: config.grupoApp, itens: ["vozEVideo", "notificacoes", "aparencia"] },
];

export function secaoEssencial(secao: SecaoId | null): SecaoEssencial | undefined {
  return SECOES_ESSENCIAIS.find((s) => s === secao);
}
