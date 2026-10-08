import type { Convite } from "nucleo/sdk/servidores";

import { sessao } from "../../textos";
import { Avatar } from "../../ui/ds";
import css from "./Entrada.module.css";

/**
 * O servidor do convite: quem convidou, o nome e quantas pessoas já estão.
 *
 * Uma peça para as duas telas que mostram o convite (a de fora, antes de entrar, e o
 * diálogo de dentro): o mesmo convite visto nas duas não pode parecer dois servidores
 * diferentes. O ícone é um avatar de iniciais; a imagem do servidor entra quando o
 * Avatar do design system aceitar uma. Convite de canal com restrição de idade não
 * diz o nome do canal, e a tela avisa em vez de calar.
 */
export function PreviaDoConvite({ convite }: { convite: Convite }) {
  const t = sessao.convite;
  return (
    <div className={css.servidor} data-testid="previa-do-convite">
      <Avatar nome={convite.nomeDoServidor} id={convite.serverId} tamanho={44} />
      <div>
        <p className={css.servidorNome}>{convite.nomeDoServidor}</p>
        <p className={css.servidorMeta}>
          {t.membros(convite.membros)} · {t.convidadoPor(convite.convidadoPor)}
        </p>
        {convite.restritoPorIdade && <p className={css.servidorMeta}>{t.restritoPorIdade}</p>}
      </div>
    </div>
  );
}
