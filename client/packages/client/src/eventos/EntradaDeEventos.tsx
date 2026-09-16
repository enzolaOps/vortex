import { ClockCounterClockwise } from "../components/ui/icones";
import { usuarioLocalId } from "../sdk/adapter";
import { eventosDaAba, useEventosDoServidor, useRelogio } from "../sdk/eventos";
import { useLocal } from "../store/hooks";
import { irParaEventos } from "../store/navegacao";
import css from "./EntradaDeEventos.module.css";

/**
 * "Eventos" no topo da coluna de canais — a porta da tela de eventos.
 *
 * ⚠ **Superfície nova precisa de porta no MESMO passo**, e porta é alvo
 * clicável numa tela que já existe, não rota. Sem esta linha a tela só seria
 * alcançável digitando `/servidor/X/eventos` ou pelo toast do lembrete.
 *
 * A contagem é a da aba "Próximos" — o mesmo número que a tela mostra ao lado
 * da aba, e some quando é zero: um "0" permanente numa coluna que se varre o
 * dia inteiro é ruído.
 */
export function EntradaDeEventos({ serverId }: { serverId: string }) {
  const local = useLocal();
  const eventos = useEventosDoServidor(serverId);
  const agora = useRelogio();
  const proximos = eventosDaAba(eventos, "proximos", usuarioLocalId(), agora).length;
  const ativa = local.tipo === "eventos" && local.serverId === serverId;

  return (
    <button
      type="button"
      className={css.entrada}
      aria-current={ativa || undefined}
      onClick={() => irParaEventos(serverId)}
    >
      <span aria-hidden className={css.barra} />
      <ClockCounterClockwise aria-hidden className={css.icone} />
      <span className={css.rotulo}>Eventos</span>
      {proximos > 0 ? (
        <span className={css.contagem} aria-label={`${String(proximos)} próximos`}>
          {proximos}
        </span>
      ) : null}
    </button>
  );
}
