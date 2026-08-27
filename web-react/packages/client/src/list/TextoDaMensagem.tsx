import { memo } from "react";

import { chaveDeMembro, type ParteDeMensagem } from "../sdk/domain";
import { useMembro, useServidorAtivo } from "../store/hooks";
import css from "./TextoDaMensagem.module.css";

/**
 * O texto de uma mensagem, com as menções resolvidas.
 *
 * Existe porque três superfícies renderizavam `message.content` cru — a linha,
 * a citação e o painel de fixados — e no minuto em que o arnês passou a gerar
 * menções de verdade, as três mostraram `<@01JQ000…>` na tela. Um texto cru do
 * protocolo aparecendo para quem usa é pior que a menção não existir.
 *
 * Um componente e não três cópias: a próxima coisa que o protocolo põe no meio
 * do texto — canal, cargo, emoji personalizado — entra aqui uma vez.
 */

/**
 * Uma menção, resolvida.
 *
 * O nome vem da member list e NÃO do snapshot da mensagem: guardá-lo lá
 * congelaria um apelido que muda, e puxar a coleção de membros para dentro do
 * mapeamento de mensagem acoplaria as duas coleções por uma linha de texto.
 *
 * `@id` como fallback é feio de propósito. Menção a alguém que saiu do
 * servidor não vira texto invisível — continua sendo uma menção, apontando
 * para alguém que não está mais lá.
 */
const Mencao = memo(function Mencao({
  userId,
  compacto,
}: {
  userId: string;
  compacto: boolean;
}) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const nome = `@${membro?.displayName ?? userId}`;

  // Sem pílula no compacto: preview de uma linha é uma FRASE, e um bloco
  // tingido no meio dela pesa mais que o resto do texto inteiro.
  return compacto ? <>{nome}</> : <span className={css.mencao}>{nome}</span>;
});

export function TextoDaMensagem({
  partes,
  compacto = false,
}: {
  partes: readonly ParteDeMensagem[];
  /** Citação e painel de fixados: uma linha, sem realce. */
  compacto?: boolean;
}) {
  return (
    <>
      {partes.map((parte) =>
        parte.tipo === "mencao" ? (
          // A chave é o DESLOCAMENTO no texto, não o índice no array: dois
          // `<@fulano>` na mesma frase são coisas diferentes.
          <Mencao key={parte.de} userId={parte.valor} compacto={compacto} />
        ) : (
          parte.valor
        ),
      )}
    </>
  );
}
