import { count } from "../dev/stats";
import { cn } from "../lib/cn";
import type { PresenceStatus } from "../sdk/domain";
import { usePresence } from "../store/hooks";
import css from "./PontoDePresenca.module.css";

const CLASSE: Record<PresenceStatus, string> = {
  online: css.online!,
  idle: css.idle!,
  dnd: css.dnd!,
  offline: css.offline!,
};

const ROTULO: Record<PresenceStatus, string> = {
  online: "online",
  idle: "ausente",
  dnd: "ocupado",
  offline: "offline",
};

/**
 * O ponto de presença assina sozinho.
 *
 * Assinar presença dentro do `MessageRow` fazia uma rajada de presença
 * re-renderizar a linha INTEIRA — texto, reações, timestamp — para mudar um
 * ponto de 8px. Era o maior custo do firehose: 265 renders de linha por
 * segundo, quase todos por causa disto.
 *
 * É a regra de granularidade da lei nº 1 aplicada um nível abaixo: quem assina
 * é quem muda. E é o que faz a member list aguentar presença — a linha do
 * membro não re-renderiza, só este ponto.
 *
 * `rotular` é opcional porque o custo é de leitor de tela, não de pixel: na
 * lista de mensagens a presença é enfeite ao lado de um nome que já está
 * escrito, e anunciá-la a cada linha seria ruído. Na member list ela é o dado.
 */
export function PontoDePresenca({
  userId,
  rotular = false,
  className,
}: {
  userId: string;
  rotular?: boolean;
  className?: string;
}) {
  const status = usePresence(userId);
  count("presenceRenders");

  return (
    <span
      className={cn(css.ponto, CLASSE[status], className)}
      role={rotular ? "img" : undefined}
      aria-label={rotular ? ROTULO[status] : undefined}
      aria-hidden={rotular ? undefined : true}
    />
  );
}
