import { cn } from "../lib/cn";
import { useServidorAtivo } from "../store/hooks";
import { useTagExibida } from "../store/perfilDoServidor";
import css from "./TagDoServidor.module.css";

/**
 * A tag do servidor ao lado do nome de quem escolheu exibi-la — "VTX".
 *
 * **Do fork** (`Server.tag` + `Member.show_tag`). Devolve `null` para quase
 * todo mundo: sem tag no servidor, ou sem a pessoa ter ligado.
 *
 * ⚠ **Componente próprio, e é escopo de subscrição.** Ele assina
 * `servidor × pessoa` e o perfil do servidor; na linha de mensagem isso quer
 * dizer que alguém ligar a tag acorda as linhas DELA — o nome, a mensagem e o
 * resto da linha continuam dormindo. Pendurar a tag no `MemberSnapshot`
 * republicaria o membro, e com ele cada consumidor do membro.
 *
 * ⚠ **Acento, nunca a cor do cargo** — é o que o design escreve na própria
 * nota da página: a tag não compete com a hierarquia que a cor do nome já diz.
 *
 * Sem `serverId` explícito, vale o servidor aberto: a timeline só mostra o
 * canal ativo, que está no servidor ativo (mesma razão de `NomeDoAutor`).
 */
export function TagDoServidor({
  userId,
  serverId,
  grande = false,
}: {
  userId: string;
  serverId?: string;
  /** Cabeçalho de perfil aberto: 18 de altura em vez de 16, como o design. */
  grande?: boolean;
}) {
  const ativo = useServidorAtivo();
  const servidor = serverId ?? ativo;
  const tag = useTagExibida(servidor, userId);
  if (tag === undefined) return null;
  return (
    <span className={cn(css.tag, grande && css.grande)} title="Tag do servidor">
      {tag}
    </span>
  );
}
