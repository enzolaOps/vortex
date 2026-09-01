import {
  ArrowDown,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import {
  assinarLongeDoFim,
  lerLongeDoFim,
  pedirFimDaLista,
} from "../store/comandos";
import css from "./Composer.module.css";

/**
 * "Ir para o presente ↓" — o atalho de volta ao fim da conversa.
 *
 * ⚠ **Não existia, e o design o tem.** Sem ele, quem rola para ler o histórico
 * de dez mil mensagens volta ao presente rolando — o que num canal movimentado
 * é literalmente impossível de fazer com a mão.
 *
 * ⚠ **Ele mora no COMPOSER e a resposta vem da LISTA, por um store.** O
 * caminho direto seria a lista desenhar o próprio botão flutuante, mas a lei
 * nº 6 vale: o composer não pode alcançar a lista pelo nome, e na fase 4 os
 * dois podem estar em painéis diferentes. É o mesmo barramento que o envio já
 * usa para pedir "me leva ao fim" (`pedirFimDaLista`), com a direção
 * invertida — e por isso o botão reusa a ação que o envio dispara, em vez de
 * uma segunda forma de chegar ao mesmo lugar.
 *
 * ⚠ **Assina um BOOLEANO que só muda ao cruzar o limiar.** A lista consulta a
 * distância a cada evento de rolagem; se cada consulta emitisse, este
 * componente — e portanto o composer, com a `textarea` onde alguém digita —
 * re-renderizaria dezenas de vezes por segundo. Ver `definirLongeDoFim`.
 */
export function IrParaOPresente({ channelId }: { channelId: string }) {
  const longe = useSyncExternalStore(
    (ouvinte) => assinarLongeDoFim(channelId, ouvinte),
    () => lerLongeDoFim(channelId),
  );

  if (!longe) return null;

  return (
    <button
      type="button"
      className={css.aoPresente}
      onClick={() => pedirFimDaLista(channelId)}
    >
      Ir para o presente
      <ArrowDown aria-hidden />
    </button>
  );
}
