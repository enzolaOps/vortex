import { useTyping } from "../store/hooks";
import css from "./Composer.module.css";

/**
 * Quem está digitando.
 *
 * É o primeiro consumo do store efêmero na UI, e ele existe separado do store
 * de mensagens exatamente por isto: num canal movimentado esse texto muda
 * várias vezes por segundo, e cada mudança acorda ESTE parágrafo e mais nada.
 *
 * Sem `aria-live` de propósito. Anunciar "fulano está digitando" a cada
 * piscada transformaria um leitor de tela em ruído contínuo — e a informação
 * não é acionável: ela some sozinha.
 *
 * PENDÊNCIA: mostra contagem porque não existe store de usuários; o que
 * chega são IDs. A member list traz esse store, e aí vira nome. A linha de
 * mensagem tem hoje exatamente a mesma lacuna.
 */
export function Digitando({ channelId }: { channelId: string }) {
  const quem = useTyping(channelId);

  return (
    <p className={css.digitando}>
      {quem.length === 0
        ? null
        : quem.length === 1
          ? "alguém está digitando…"
          : `${quem.length} pessoas estão digitando…`}
    </p>
  );
}
