import { useSyncExternalStore } from "react";

import { assinarChamada, lerChamada } from "../store/chamada";
import { assinarPalco, lerPalco } from "../store/palcoDeVoz";

/**
 * A sala de voz está ocupando a coluna de conteúdo?
 *
 * ⚠ **Um predicado, num lugar só, porque TRÊS lados precisam concordar** — a
 * coluna de conteúdo escolhe entre a sala e a conversa, o composer some
 * enquanto a sala está lá, e o cartão flutuante se recolhe porque a doca da
 * sala já tem os mesmos controles. Três cópias da mesma condição é a
 * divergência que este projeto já viu várias vezes; a que diverge é a que
 * ninguém abriu naquela semana. Mesma razão de `ARNES_ATIVO`.
 *
 * ⚠ **Hook e não função pura, e é a lei nº 1.** Ele assina dois stores que
 * publicam com a chamada viva — participante entrando, câmera ligando,
 * qualidade de rede mudando. Lido no `Cliente`, faria o shell inteiro
 * re-renderizar a cada um: rail, coluna de canais, lista de membros e os
 * painéis, todos por causa de alguém que apertou mudo. Quem o chama são
 * FOLHAS do shell, então quem acorda é só quem muda.
 *
 * As três condições são todas necessárias. Estar numa chamada não basta —
 * quem está numa chamada e foi ler outro canal quer ver o outro canal. Estar
 * olhando o canal da chamada também não basta: o chat embutido é o que
 * "Voltar ao chat" abre, e nesse momento a chamada continua de pé.
 */
export function useNaSala(channelId: string): boolean {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const palco = useSyncExternalStore(assinarPalco, lerPalco);

  return (
    chamada.estado !== "fora" &&
    chamada.channelId === channelId &&
    palco.tipo !== "fechado"
  );
}
