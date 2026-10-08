import { podeDestacar } from "nucleo/sdk/popout";
import { useChamada, useChannel, useFalantes, useJanelaDestacada, usePessoasDaSala } from "nucleo/store/hooks";

import { salas, voz } from "../../textos";
import { PainelDaChamada } from "../../ui/ds";
import { destacarChamada, trazerDeVolta } from "./destacar";
import { useTempoDecorrido } from "./hooks";
import { useControlesDaChamada } from "./useControlesDaChamada";

/**
 * O painel de controles da chamada, fixo na coluna de salas.
 *
 * Vale para qualquer servidor, para a casa e para as configurações: a chamada
 * sobrevive a trocar de lugar, e este é o indicador (e o controle) persistente
 * de que ela está de pé. Sem chamada, não existe.
 *
 * ⚠ **Assina `quem fala`, que muda dezenas de vezes por segundo**: por isso é
 * um componente próprio, e a coluna ao redor não acorda.
 */
export function PainelDaChamadaConectado() {
  const chamada = useChamada();
  const canal = useChannel(chamada.channelId);
  // DM e grupo não têm servidor: os nomes se resolvem pela pessoa (chave de servidor vazia).
  const pessoas = usePessoasDaSala(canal?.serverId ?? "", chamada.channelId);
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const tempo = useTempoDecorrido(chamada.estado === "dentro" ? chamada.desde : 0);
  const controles = useControlesDaChamada(canal?.name ?? "");
  const destacada = useJanelaDestacada() !== undefined;

  if (chamada.estado === "fora" || !canal) return null;

  const status =
    chamada.estado === "conectando"
      ? voz.conexao.conectandoASala
      : chamada.estado === "reconectando"
        ? voz.conexao.reconectando
        : undefined;
  const quemFala = falantes[0];
  const nomeDeQuemFala =
    quemFala !== undefined ? pessoas.find((p) => p.id === quemFala)?.nome || salas.alguem : undefined;

  return (
    <PainelDaChamada
      sala={canal.name}
      tempo={tempo}
      status={status}
      quemFala={nomeDeQuemFala}
      // O overlay sobre o jogo não depende de transmissão: o botão mora aqui, e não no PiP.
      onDestacar={
        podeDestacar() || destacada
          ? () => {
              if (destacada) trazerDeVolta();
              else void destacarChamada();
            }
          : undefined
      }
      destacada={destacada}
      {...controles}
    />
  );
}
