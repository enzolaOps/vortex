import type { TopicoSnapshot } from "../sdk/domain";

/**
 * O selo de estado de um post — D-CANAIS-09.
 *
 * Um só por card, como o design: "fechado" ou "em análise", nunca os dois.
 * Fechado ganha porque é o estado que muda o que a pessoa PODE fazer (o post
 * perde o composer); "em análise" é informação sobre ele. Um post arquivado
 * que a moderação esqueceu marcado não deve dizer que alguém ainda o olha.
 */
export type EstadoDoPost = "fechado" | "em análise";

export function estadoDoPost(
  t: Pick<TopicoSnapshot, "arquivado" | "emAnalise">,
): EstadoDoPost | undefined {
  if (t.arquivado) return "fechado";
  if (t.emAnalise) return "em análise";
  return undefined;
}

/**
 * Dias sem atividade até um tópico contar como arquivado — D-CANAIS-28.
 *
 * ⚠ A REGRA mora no servidor (`THREAD_ARCHIVE_AFTER_DAYS` em
 * `server/crates/core/database/src/models/channels/model.rs`), derivada na
 * leitura, sem job. Aqui é só o número que o vazio de Arquivados DIZ — e um
 * teste lê o `.rs` do disco, porque um texto que afirma sete dias sobre um
 * servidor que arquiva em trinta é pior que não dizer nada.
 */
export const DIAS_SEM_ATIVIDADE_PARA_ARQUIVAR = 7;
