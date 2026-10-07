/**
 * Qual mensagem está sendo editada.
 *
 * Store module-level e não estado da linha, por duas razões que se somam:
 *
 * 1. `MessageRow` é `memo` e vive dentro de um virtualizador — a linha
 *    DESMONTA ao sair da janela visível. Estado local ali significaria perder
 *    o texto ao rolar, que é o pior momento possível para perdê-lo.
 * 2. Uma edição por vez é invariante, não convenção: duas linhas em modo de
 *    edição ao mesmo tempo dariam dois campos disputando o foco e dois `Esc`
 *    com significados diferentes.
 *
 * O rascunho da edição fica AQUI e não em `rascunhos.ts`: aquele é por canal e
 * sobrevive à troca de canal de propósito; este é de uma mensagem e morre com
 * ela.
 */

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

let editando: string | undefined;

export function assinarEdicaoDeMensagem(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/**
 * Qual mensagem está em edição, ou `undefined`.
 *
 * String comparada por valor — não há armadilha de referência aqui, e é por
 * isso que o rascunho não mora neste snapshot: um objeto exigiria cache.
 */
export function lerEdicaoDeMensagem(): string | undefined {
  return editando;
}

export function editar(messageId: string): void {
  if (editando === messageId) return;
  editando = messageId;
  for (const ouvinte of ouvintes) ouvinte();
}

export function pararDeEditar(): void {
  if (editando === undefined) return;
  editando = undefined;
  for (const ouvinte of ouvintes) ouvinte();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparEdicaoDeMensagem(): void {
  editando = undefined;
}
