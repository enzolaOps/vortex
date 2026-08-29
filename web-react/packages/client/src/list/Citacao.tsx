import { Avatar } from "../components/ui/Avatar";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { chaveDeMembro } from "../sdk/domain";
import { pedirIrParaMensagem } from "../store/comandos";
import { useMembro, useMessage, useServidorAtivo } from "../store/hooks";
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
  const serverId = useServidorAtivo();
  const autor = useMembro(chaveDeMembro(serverId, citada?.authorId ?? ""));

  return (
    <button
      type="button"
      className={css.citacao}
      onClick={() => pedirIrParaMensagem(channelId, messageId)}
      // O botão anuncia a AÇÃO; o conteúdo citado é lido junto por estar
      // dentro dele. "Ir para a mensagem citada" sozinho perderia de quem é.
      aria-label="Ir para a mensagem citada"
    >
      {/*
        ⚠ **O COTOVELO substituiu a seta, e a diferença é o que o design usa
        para amarrar a prévia à mensagem.**

        Era um ícone de seta curva (`ArrowBendUpLeft`) do lado do nome. O
        design desenha uma linha de 22×9 com canto arredondado em cima e à
        esquerda — um cano que sai da mensagem de cima e entra nesta. A seta
        dizia "isto é uma resposta"; o cano diz "isto é uma resposta A AQUELA
        ali em cima", que é a informação que faltava.

        `aria-hidden` porque o `aria-label` do botão já diz o que ele faz —
        um cano desenhado com bordas não tem nome para anunciar.
      */}
      <span className={css.cotovelo} aria-hidden />

      {citada ? (
        <>
          {/*
            O avatar de quem foi respondido — 16px, do design.

            Sem ele a prévia é uma linha de texto cinza entre duas mensagens, e
            quem varre a conversa não distingue "resposta" de "continuação". O
            rosto é o que torna a relação legível sem ler.
          */}
          <Avatar
            id={citada.authorId ?? ""}
            sigla={autor?.sigla}
            tamanho="xxs"
            className={css.avatarCitado}
          />
          <NomeDoAutor userId={citada.authorId ?? ""} citado />
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
