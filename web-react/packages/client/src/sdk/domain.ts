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

/**
 * Teto de caracteres de uma mensagem.
 *
 * Declarado pelo Vortex, não lido do SDK — mesmo que hoje coincida com o do
 * Stoat. É limite de produto: o dia em que o backend divergir, quem manda é
 * esta linha, e o composer não precisa saber que houve divergência.
 */
export const LIMITE_DE_CONTEUDO = 2000;

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

  /**
   * Primeira mensagem do autor naquela janela: mostra avatar, nome e hora.
   *
   * Mensagens consecutivas do mesmo autor dentro de uma janela curta agrupam
   * sem repetir avatar e nome. É o que faz a lista parecer conversa em vez de
   * log — e é densidade, não enfeite: repetir o cabeçalho a cada linha custa
   * ~28px de altura por mensagem num app onde caber histórico é o ponto.
   */
  readonly iniciaGrupo: boolean;

  /**
   * Rótulo do divisor de data, quando esta linha abre um dia novo.
   *
   * Vive no snapshot, e não no render, porque depende da mensagem ANTERIOR — e
   * a lei nº 1 diz que a linha assina apenas a si mesma. Ler o vizinho no
   * render faria a linha re-renderizar quando o vizinho mudasse.
   *
   * O que torna isso possível: `authorId` e `createdAt` são imutáveis depois
   * da criação, então agrupamento e divisor só mudam em INSERÇÃO e REMOÇÃO,
   * nunca em edição ou reaction. O adapter recalcula nesses dois momentos e o
   * campo se comporta como qualquer outro do snapshot.
   */
  readonly dia: string | undefined;
};

export type PresenceStatus = "online" | "idle" | "dnd" | "offline";

export type UserSnapshot = {
  readonly id: string;
  readonly username: string;
  readonly status: PresenceStatus;
};
