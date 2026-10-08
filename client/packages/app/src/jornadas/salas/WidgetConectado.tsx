import { useEstadoDaChamada } from "nucleo/store/hooks";

import { WidgetDaChamadaConectado } from "../voz/WidgetDaChamadaConectado";
import css from "./Salas.module.css";

/**
 * A camada do PiP da chamada, presa ao canto escolhido e fora da reserva do
 * composer. Clicar numa sala entra nela (sem preview de sala aqui), e os
 * controles da chamada moram na coluna de salas: esta camada só abriga a
 * janelinha "AO VIVO", que o próprio widget só desenha quando alguém transmite.
 */
export function WidgetConectado({ serverId }: { serverId: string }) {
  const naChamada = useEstadoDaChamada() !== "fora";
  if (!naChamada) return null;
  return (
    <div className={css.camadaDeWidgets}>
      <WidgetDaChamadaConectado servidorAberto={serverId} />
    </div>
  );
}
