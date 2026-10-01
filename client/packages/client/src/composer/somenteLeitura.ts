/**
 * O composer vira a faixa de "tópico arquivado"? — D-CANAIS-10 e D-CANAIS-25.
 *
 * Só quando o tópico está arquivado E ninguém fez ainda o gesto de responder.
 * Os três gestos contam igual: clicar em "Responder" na faixa (guardado pelo
 * canal onde aconteceu), ter rascunho (o texto não pode sumir atrás da faixa)
 * e ter resposta armada pelo menu da mensagem. Gravando, idem — o gravador
 * nunca pode ficar sem os próprios controles na tela.
 */
export function composerSomenteLeitura(e: {
  readonly arquivado: boolean;
  readonly channelId: string;
  readonly reabrirEm: string | undefined;
  readonly rascunho: string;
  readonly respondendo: boolean;
  readonly gravando: boolean;
}): boolean {
  return (
    e.arquivado &&
    e.reabrirEm !== e.channelId &&
    e.rascunho.length === 0 &&
    !e.respondendo &&
    !e.gravando
  );
}
