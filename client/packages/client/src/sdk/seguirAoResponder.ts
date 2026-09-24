/**
 * "Seguir tópicos automaticamente" desligado — D-NOTIF-16.
 *
 * O `delta` deste fork segue o tópico sozinho quando alguém responde nele
 * (`message_send.rs`: *"Replying follows the thread"*), sem campo no envio que
 * peça o contrário. Com o interruptor desligado no canal PAI, o cliente desfaz
 * esse seguir depois que o envio volta.
 *
 * ⚠ **Só quando a pessoa NÃO seguia antes.** Quem já seguia o tópico escolheu
 * segui-lo por outro caminho (o botão do cabeçalho, ou ter criado o tópico), e
 * responder não pode desfazer uma escolha que o envio nem tocou.
 *
 * Pura, para ter teste sem SDK: o adapter entrega o registro do tópico lido
 * ANTES do envio, quem sou eu e a preferência.
 */
export function desfazerSeguirAoResponder(
  topico: { readonly paiId: string; readonly seguidores: readonly string[] } | undefined,
  eu: string | undefined,
  segueAutomaticamente: (paiId: string) => boolean,
): boolean {
  if (topico === undefined || eu === undefined) return false;
  if (topico.seguidores.includes(eu)) return false;
  return !segueAutomaticamente(topico.paiId);
}
