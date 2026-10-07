import { postarCru } from "./requisicaoCrua";

/**
 * Avisa o servidor que você saiu da sala: `POST /channels/{id}/leave_call`
 * (ADR-002).
 *
 * Chamada ANTES de desconectar o LiveKit, para a sala dos outros esvaziar em
 * ≤ 2 s sem esperar o webhook. ⚠ **Nunca lança e nunca segura a saída:** a
 * rota falhando (rede, servidor sem a rota ainda, 5xx) deixa o webhook do
 * `voice-ingress` como plano B, e a desconexão local acontece de qualquer
 * jeito. Por isso o teto de tempo — um servidor pendurado não pode prender o
 * botão de sair.
 *
 * Cru porque o pacote `stoat-api` só tem o tipo da rota depois de regenerado.
 */
export async function avisarSaidaDaSala(
  canalId: string,
  limiteMs = 2000,
): Promise<void> {
  if (canalId === "") return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      postarCru(`/channels/${encodeURIComponent(canalId)}/leave_call`, undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, limiteMs);
      }),
    ]);
  } catch {
    /* Plano B é o webhook; ver acima. */
  } finally {
    clearTimeout(timer);
  }
}
