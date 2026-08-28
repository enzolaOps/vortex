import { ArrowBendUpLeft } from "@phosphor-icons/react";

import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { pedirIrParaMensagem } from "../store/comandos";
import { useMessage } from "../store/hooks";
import { TextoDaMensagem } from "./TextoDaMensagem";
import css from "./Citacao.module.css";

/**
 * A citação de uma resposta, acima da mensagem.
 *
 * Assina a mensagem CITADA, não a que responde — e é isso que faz a citação
 * acompanhar a edição do original em vez de mentir. É também por isso que o
 * snapshot guarda o ID e nunca o texto: copiar o conteúdo no momento da
 * resposta congelaria a citação, e apagar o original deixaria uma cópia órfã
 * de algo que não existe mais.
 *
 * O custo dessa correção é uma subscrição a mais por resposta visível. É
 * aceitável porque resposta é minoria das linhas — e se um dia não for, o
 * conserto é o mesmo do `MessageRow`: `memo` sobre um ID estável.
 *
 * Clicar leva ao original. Uma citação que não navega é texto pequeno em
 * cinza: mostra que houve contexto e nega o acesso a ele.
 */
export function Citacao({
  channelId,
  messageId,
}: {
  channelId: string;
  messageId: string;
}) {
  const citada = useMessage(messageId);

  return (
    <button
      type="button"
      className={css.citacao}
      onClick={() => pedirIrParaMensagem(channelId, messageId)}
      // O botão anuncia a AÇÃO; o conteúdo citado é lido junto por estar
      // dentro dele. "Ir para a mensagem citada" sozinho perderia de quem é.
      aria-label="Ir para a mensagem citada"
    >
      <ArrowBendUpLeft size={20} aria-hidden className={css.seta} />

      {citada ? (
        <>
          <NomeDoAutor userId={citada.authorId ?? ""} />
          <span className={css.trecho}>
            <TextoDaMensagem blocos={citada.blocos} compacto />
          </span>
        </>
      ) : (
        /*
          Mensagem citada fora do histórico carregado.

          Não é erro: responder a algo de três meses atrás e rolar até aqui é
          normal, e o original só chega quando o histórico anterior for
          buscado. Dizer "apagada" seria afirmar o que não se sabe.
        */
        <span className={css.ausente}>mensagem não carregada</span>
      )}
    </button>
  );
}
