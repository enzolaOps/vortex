import { ArrowBendUpLeft, X } from "@phosphor-icons/react";

import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { useMessage } from "../store/hooks";
import css from "./BarraDeResposta.module.css";

/**
 * "Respondendo a…", acima do campo.
 *
 * Assina a mensagem alvo aqui e não recebe o texto por prop, pela mesma razão
 * da `Citacao`: o alvo pode ser editado enquanto a resposta está sendo
 * escrita, e uma barra que mostra o texto velho estaria mentindo sobre a que
 * mensagem a resposta vai se prender.
 *
 * O botão de cancelar existe além do Escape porque nem todo mundo sabe do
 * Escape — e porque o alvo pode ter sido armado por engano num clique de menu,
 * momento em que a mão está no ponteiro e não no teclado.
 */
export function BarraDeResposta({
  messageId,
  aoCancelar,
}: {
  messageId: string;
  aoCancelar: () => void;
}) {
  const alvo = useMessage(messageId);

  return (
    <div className={css.barra}>
      <ArrowBendUpLeft size={20} aria-hidden className={css.seta} />

      <p className={css.texto}>
        respondendo a{" "}
        {alvo?.authorId ? (
          <NomeDoAutor userId={alvo.authorId} />
        ) : (
          <span className={css.ausente}>mensagem não carregada</span>
        )}
      </p>

      <button
        type="button"
        className={css.cancelar}
        onClick={aoCancelar}
        aria-label="Cancelar resposta"
        title="Cancelar resposta · Esc"
      >
        <X size={20} aria-hidden />
      </button>
    </div>
  );
}
