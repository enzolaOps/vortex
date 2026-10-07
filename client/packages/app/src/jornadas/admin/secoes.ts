import { meuAlcance } from "nucleo/sdk/cargos";
import { podeNoServidor } from "nucleo/sdk/permissoes";
import type { SecaoId } from "nucleo/store/config";

import { admin } from "../../textos";

/**
 * As seções de administração do servidor (PRD 4.7). Moram na mesma casca das
 * configurações pessoais: a URL `/config/<seção>/<servidor>` já carrega o alvo.
 */
export const SECOES_DE_SERVIDOR = [
  "servidor",
  "canais",
  "convites",
  "cargos",
  "membros",
  "banimentos",
] as const satisfies readonly SecaoId[];

export type SecaoDeServidor = (typeof SECOES_DE_SERVIDOR)[number];

export function secaoDeServidor(secao: SecaoId | null): SecaoDeServidor | undefined {
  return SECOES_DE_SERVIDOR.find((s) => s === secao);
}

/** `Record` exaustivo: seção nova não compila sem nome, subtítulo e regra de acesso. */
export const NOME_DA_SECAO_DE_SERVIDOR: Record<SecaoDeServidor, string> = {
  servidor: admin.navegacao.visaoGeral,
  canais: admin.navegacao.salasECanais,
  convites: admin.navegacao.convites,
  cargos: admin.navegacao.cargos,
  membros: admin.navegacao.membros,
  banimentos: admin.navegacao.banimentos,
};

export const SUBTITULO_DA_SECAO_DE_SERVIDOR: Record<SecaoDeServidor, string> = {
  servidor: admin.subtitulos.visaoGeral,
  canais: admin.subtitulos.salasECanais,
  convites: admin.subtitulos.convites,
  cargos: admin.subtitulos.cargos,
  membros: admin.subtitulos.membros,
  banimentos: admin.subtitulos.banimentos,
};

/** A navegação em três grupos, na ordem da tela. */
export const GRUPOS_DO_SERVIDOR: readonly {
  readonly titulo: string;
  readonly itens: readonly SecaoDeServidor[];
}[] = [
  { titulo: admin.navegacao.grupoServidor, itens: ["servidor", "canais", "convites"] },
  { titulo: admin.navegacao.grupoPessoas, itens: ["cargos", "membros"] },
  { titulo: admin.navegacao.grupoModeracao, itens: ["banimentos"] },
];

/**
 * Quem pode abrir cada seção. `Record` exaustivo, e a regra é a de AUSÊNCIA: a
 * seção que a pessoa não pode usar não aparece na navegação (nunca cinza), e
 * abrir pelo endereço cai na primeira que ela pode.
 */
const REGRA_DE_ACESSO: Record<SecaoDeServidor, (serverId: string) => boolean> = {
  servidor: (s) => podeNoServidor(s, "gerenciarServidor"),
  canais: (s) => podeNoServidor(s, "gerenciarCanais"),
  // Listar os convites do servidor é direito de quem o gerencia; criar um é do menu "Convidar".
  convites: (s) => podeNoServidor(s, "gerenciarServidor"),
  cargos: (s) => podeNoServidor(s, "gerenciarCargos") || meuAlcance(s).podeEditarPermissoes,
  membros: (s) =>
    podeNoServidor(s, "expulsar") ||
    podeNoServidor(s, "banir") ||
    podeNoServidor(s, "silenciarMembro") ||
    podeNoServidor(s, "atribuirCargos"),
  banimentos: (s) => podeNoServidor(s, "banir"),
};

export function podeAbrirSecao(serverId: string, secao: SecaoDeServidor): boolean {
  return REGRA_DE_ACESSO[secao](serverId);
}

/** As seções que a pessoa pode abrir neste servidor, na ordem da navegação. */
export function secoesPermitidas(serverId: string): readonly SecaoDeServidor[] {
  return GRUPOS_DO_SERVIDOR.flatMap((g) => g.itens).filter((s) => podeAbrirSecao(serverId, s));
}
