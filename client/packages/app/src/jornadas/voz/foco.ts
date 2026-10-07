/**
 * O que o PiP da chamada mostra: a transmissão, ou quem está falando.
 *
 * Pura, e separada do componente para o teste cobrir as ordens de desempate
 * sem montar a chamada.
 *
 * - **Transmissão ganha de tudo.** De outra pessoa antes da própria: ver a
 *   própria tela num cantinho é o que o palco já mostra, e quem transmite quer
 *   saber o que os outros estão fazendo.
 * - **Sem transmissão, quem fala** (o primeiro da lista de falantes que está
 *   na sala), com a câmera se ela estiver ligada e o avatar se não.
 * - **Ninguém falando e ninguém transmitindo**: não há foco, e o widget mostra
 *   o estado vazio em vez de escolher uma pessoa arbitrária e fingir que ela
 *   importa agora.
 */
export type FocoDoPip =
  | { readonly tipo: "tela"; readonly userId: string }
  | { readonly tipo: "pessoa"; readonly userId: string; readonly comCamera: boolean };

export type PessoaParaFoco = {
  readonly id: string;
  readonly transmitindo: boolean;
  readonly camera: boolean;
};

export function escolherFoco(
  pessoas: readonly PessoaParaFoco[],
  falantes: readonly string[],
  eu: string | undefined,
): FocoDoPip | undefined {
  const transmissor = pessoas.find((p) => p.transmitindo && p.id !== eu) ?? pessoas.find((p) => p.transmitindo);
  if (transmissor) return { tipo: "tela", userId: transmissor.id };

  for (const id of falantes) {
    const p = pessoas.find((x) => x.id === id);
    if (p) return { tipo: "pessoa", userId: p.id, comCamera: p.camera };
  }
  return undefined;
}
