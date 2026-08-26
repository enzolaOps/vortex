/**
 * Tipos de domínio do Vortex.
 *
 * Declarados pelo app, NUNCA derivados dos tipos do `stoat.js`. Derivar faria a
 * forma do protocolo vazar para todo componente que lê um snapshot, e aí a
 * primeira feature que o Stoat não tem viraria refactor do app inteiro.
 *
 * Este arquivo não importa `stoat.js`. Se algum dia importar, a desvinculação
 * acabou — o lint de boundary existe para impedir isso.
 */

/** Estado de envio. Vive no cliente; o protocolo não tem esse conceito. */
export type SendState = "sent" | "pending" | "failed";

export type MessageSnapshot = {
  readonly id: string;
  readonly channelId: string;
  readonly authorId: string | undefined;
  readonly content: string;
  readonly createdAt: number;
  /**
   * Hora já formatada. Derivação acontece no adapter, uma vez na escrita —
   * `toLocaleTimeString` no render é custo de Intl multiplicado por cada
   * re-render de linha, e apareceu no firehose a 4x.
   */
  readonly createdAtText: string;
  readonly editedAt: number | undefined;
  /** emoji → quantidade. Achatado no adapter; o componente não itera Set. */
  readonly reactions: ReadonlyMap<string, number>;

  /**
   * Campo do Vortex que o protocolo não carrega.
   *
   * Está aqui desde o primeiro dia de propósito: é a prova barata de que a
   * camada anticorrupção comporta um modelo mais rico que o do Stoat. O adapter
   * preenche com default; quando existir backend para isso, só o adapter muda.
   */
  readonly sendState: SendState;
};

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export type UserSnapshot = {
  readonly id: string;
  readonly username: string;
  readonly status: PresenceStatus;
};
