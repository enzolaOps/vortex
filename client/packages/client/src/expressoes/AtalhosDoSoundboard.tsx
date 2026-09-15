import { useEffect } from "react";

import { podeUsarSoundboard, tocarNaSala } from "../sdk/efeitosSonoros";
import { sonsDoServidor } from "../sdk/expressoes";
import { lerChamada } from "../store/chamada";
import { useChannel } from "../store/hooks";
import { indiceDaTecla } from "./atalhos";

/**
 * Liga as teclas 1–9 enquanto há chamada — o design escreve "Teclas 1–9
 * disparam os sons sem abrir o painel".
 *
 * Mora na faixa de voz porque ela existe exatamente enquanto a chamada existe:
 * o ouvinte nasce e morre com ela, sem um `if (dentro)` a cada tecla do app.
 * Lê o store no instante da tecla em vez de assinar a lista: a faixa não
 * precisa re-renderizar quando alguém sobe um som.
 */
export function AtalhosDoSoundboard({ channelId }: { channelId: string }) {
  const serverId = useChannel(channelId)?.serverId;

  useEffect(() => {
    if (!serverId) return;
    const aoTeclar = (e: KeyboardEvent) => {
      const i = indiceDaTecla(e);
      if (i === undefined || lerChamada().estado !== "dentro") return;
      const lista = sonsDoServidor.peek(serverId);
      const som = lista?.estado === "pronta" ? lista.itens[i] : undefined;
      if (!som || !podeUsarSoundboard(channelId)) return;
      e.preventDefault();
      tocarNaSala(channelId, som);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [serverId, channelId]);

  return null;
}
