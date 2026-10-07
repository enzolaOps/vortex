import { count } from "nucleo/arnes/stats";
import { chaveDeMembro } from "nucleo/sdk/domain";
import { useMembro, useMessage } from "nucleo/store/hooks";
import { memo } from "react";

import { chat } from "../../textos";
import { Mensagem } from "../../ui/ds";
import css from "./ListaDeMensagens.module.css";

export interface LinhaDeMensagemProps {
  id: string;
  servidorId: string;
}

/**
 * A linha da lista: assina SÓ a própria mensagem (e o próprio autor) pelo ID e
 * entrega o snapshot ao `Mensagem` do DS, que é puro. Editar uma mensagem
 * acorda uma linha, não a lista (lei nº 1). Nenhum dado de entidade passa por
 * Context e nenhuma prop é montada fora do que o snapshot já cacheia.
 *
 * Mensagem não resolvida devolve um placeholder COM altura: linha medindo 0px
 * realimenta o virtualizador e trava a aba.
 */
function LinhaBase({ id, servidorId }: LinhaDeMensagemProps) {
  count("rowRenders");
  const m = useMessage(id);
  const autor = useMembro(chaveDeMembro(servidorId, m?.authorId ?? ""));

  if (!m) return <div className={css.placeholder} aria-hidden="true" />;

  return (
    <>
      {m.dia !== undefined && (
        <div className={css.divisor} role="separator">
          <span>{m.dia}</span>
        </div>
      )}
      {m.sistema ? (
        <p className={css.sistema}>{chat.eventoDoCanal}</p>
      ) : (
        <Mensagem
          autor={{ nome: autor?.displayName ?? chat.autorDesconhecido, id: m.authorId }}
          hora={m.createdAtText}
          continuacao={!m.iniciaGrupo}
          acoes={false}
        >
          {m.content}
        </Mensagem>
      )}
    </>
  );
}

export const LinhaDeMensagem = memo(LinhaBase);
