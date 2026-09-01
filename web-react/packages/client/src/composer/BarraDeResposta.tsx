import { ArrowBendUpLeft, At, X } from "../components/ui/icones";

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
 *
 * ⚠ **O `@` é a MESMA decisão que "Responder sem mencionar" no menu, num
 * segundo lugar.** Ela existe aqui porque o menu decide antes de escrever e a
 * barra é onde a pessoa está quando muda de ideia — e porque quem chega à
 * resposta pelo atalho `R` nunca passa pelo menu. Dois controles sobre um
 * estado só, e não dois estados.
 */
export function BarraDeResposta({
  messageId,
  mencionar,
  aoAlternarMencao,
  aoCancelar,
}: {
  messageId: string;
  /** Se a pessoa respondida será notificada. */
  mencionar: boolean;
  aoAlternarMencao: () => void;
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

      {/*
        ⚠ **`aria-pressed` com rótulo FIXO.** O nome do recurso é "Mencionar";
        o estado vai no `aria-pressed`. Um rótulo que alterna junto faria o
        leitor de tela anunciar o inverso — é a regra que o lint deste projeto
        já me cobrou uma vez, no microfone do painel de usuário.
      */}
      <button
        type="button"
        className={css.mencionar}
        onClick={aoAlternarMencao}
        aria-pressed={mencionar}
        aria-label="Mencionar"
        title={
          mencionar
            ? "A pessoa será notificada · clique para não mencionar"
            : "A pessoa não será notificada · clique para mencionar"
        }
      >
        <At size={16} aria-hidden />
        {mencionar ? "ON" : "OFF"}
      </button>

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
