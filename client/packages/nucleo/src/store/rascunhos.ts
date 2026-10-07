/**
 * Rascunho por canal.
 *
 * Fora do React e keyed por canal, pela mesma razão de todo o resto: sair de um
 * canal e voltar tem que devolver o texto onde estava. Rascunho em estado de
 * componente desmonta junto com a tela — e trocar de canal é a operação mais
 * frequente do app.
 *
 * Também é o que mantém a digitação barata. O rascunho é o valor que muda mais
 * vezes por segundo no app inteiro: uma vez por tecla. Assinado por canal, quem
 * acorda a cada tecla é o composer e mais nada — a lista de mensagens não fica
 * sabendo que alguém está digitando.
 *
 * O tipo é `string`, e continua sendo quando o editor virar rich text. O
 * conteúdo de mensagem é texto no protocolo; documento rico é representação de
 * EDIÇÃO, não de armazenamento. Guardar o documento aqui acoplaria o rascunho
 * ao editor da vez.
 */
import { createEntityStore } from "./entities";

export const rascunhos = createEntityStore<string>();

/** Referência estável: o `getSnapshot` não pode alocar, nem uma string nova. */
export const RASCUNHO_VAZIO = "";

export function lerRascunho(channelId: string): string {
  return rascunhos.getSnapshot(channelId) ?? RASCUNHO_VAZIO;
}

export function escreverRascunho(channelId: string, texto: string): void {
  rascunhos.set(channelId, texto);
}

export function limparRascunho(channelId: string): void {
  rascunhos.set(channelId, RASCUNHO_VAZIO);
}
