/**
 * O schema do preset. Fase 4.
 *
 * Este arquivo tem uma responsabilidade que não é descrever dados: é tornar
 * IRREPRESENTÁVEL um preset que carregue dado de sessão.
 *
 * A regra — "preset nunca carrega ID de canal, servidor ou usuário" — é
 * privacidade, e privacidade não sobrevive a campo opcional que alguém pode
 * preencher. Sobrevive a um tipo onde o campo não existe: `PainelId` é uma
 * união fechada de TIPOS de painel, nunca de instâncias. "membros" é um
 * painel; "os membros do servidor X" não é representável aqui.
 *
 * Preset já compartilhado não volta atrás. É a única regra deste projeto cujo
 * erro é irreversível.
 */
import type { TokenName } from "./tokens";

/** A versão que este código escreve. Migração explícita entre versões. */
export const VERSAO_ATUAL = 1;

/**
 * Painéis que podem ocupar um slot.
 *
 * Tipo de painel, nunca instância. Thread, fixados, perfil e voz entram aqui
 * quando existirem — e vão entrar como tipo também: "thread" e não "a thread
 * da mensagem 01JQ…".
 */
export const PAINEIS = ["rail", "canais", "membros"] as const;

export type PainelId = (typeof PAINEIS)[number];

/**
 * Slot é POSIÇÃO, não objeto com lado.
 *
 * A referência descreve slots com uma propriedade `lado`. Aqui o lado é a
 * própria identidade do slot, e a diferença importa: com `lado` guardado, um
 * preset pode dizer que o slot da coluna 1 está do lado `fim` — estado
 * inconsistente que precisaria de validação. Sem ele, não há o que validar.
 *
 * "Trocar de lado" continua existindo, e vira trocar QUAL PAINEL ocupa qual
 * slot — que é a mesma liberdade com metade dos estados possíveis.
 *
 * `c` não está aqui de propósito: é a âncora (coluna de mensagem + composer),
 * nunca move, nunca troca de lado, sempre presente. É o que protege a
 * virtualização, e não ser representável é a forma mais forte de garantir.
 */
export const SLOTS = ["a", "b", "d"] as const;

export type SlotId = (typeof SLOTS)[number];

export type SlotConfig = {
  /** `null` = slot vazio. Colapsa a zero — é o que resolve o ultrawide. */
  readonly painel: PainelId | null;
  readonly largura: number;
  readonly visivel: boolean;
};

export type LayoutPreset = {
  readonly slots: Readonly<Record<SlotId, SlotConfig>>;
};

/**
 * O tema é um mapa de token para valor, e nada mais.
 *
 * `Partial` porque um preset pode trocar só o accent. `TokenName` fechado
 * porque chave arbitrária aqui seria valor mágico escolhido pelo usuário, onde
 * nenhum lint alcança.
 */
export type TemaPreset = Partial<Record<TokenName, string>>;

export type Preset = {
  readonly version: number;
  readonly layout: LayoutPreset;
  readonly theme?: TemaPreset;
};

/* --------------------------------------------------------------- limites */

/**
 * Limites de largura por slot, em px.
 *
 * Não é escala de espaçamento: é geometria de layout, da mesma família de
 * `--vx-rail-w` e `--vx-message-max-w`. O mínimo existe para que um slot
 * arrastado até quase zero não vire uma tira inútil que ninguém consegue mais
 * agarrar — abaixo dele a intenção é esconder, e esconder tem controle
 * próprio.
 */
export const LARGURA = {
  rail: { min: 56, max: 240, padrao: 72 },
  canais: { min: 180, max: 420, padrao: 240 },
  membros: { min: 140, max: 420, padrao: 240 },
} as const satisfies Record<PainelId, { min: number; max: number; padrao: number }>;

export function limitarLargura(painel: PainelId | null, largura: number): number {
  if (painel === null) return 0;
  const { min, max } = LARGURA[painel];
  return Math.min(max, Math.max(min, Math.round(largura)));
}

/* --------------------------------------------------------------- padrão */

/** O layout de fábrica — e o default de toda chave ausente. */
export const PRESET_PADRAO: Preset = {
  version: VERSAO_ATUAL,
  layout: {
    slots: {
      a: { painel: "rail", largura: LARGURA.rail.padrao, visivel: true },
      b: { painel: "canais", largura: LARGURA.canais.padrao, visivel: true },
      d: { painel: "membros", largura: LARGURA.membros.padrao, visivel: true },
    },
  },
};
