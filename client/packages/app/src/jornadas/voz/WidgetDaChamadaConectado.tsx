import { alternarCamera, alternarMudo, alternarSurdo, alternarTela } from "nucleo/sdk/chamada";
import { fixarSalaNoCanto } from "nucleo/store/preferenciasDaSala";
import {
  useCantoDaSala,
  useChamada,
  useChannel,
  useFalantes,
  usePessoasDaSala,
} from "nucleo/store/hooks";
import { definirPalco } from "nucleo/store/palcoDeVoz";
import { abrirServidor } from "nucleo/store/ultimoLugar";

import { salas, voz } from "../../textos";
import { WidgetDaChamada } from "../../ui/ds";
import { sairDaSala } from "./acoes";
import { useTempoDecorrido } from "./hooks";

/**
 * A chamada que acompanha a pessoa enquanto ela lê um canal de texto: o widget
 * flutuante no canto escolhido, com os mesmos controles do palco e o caminho de
 * volta ("Voltar ao palco").
 *
 * Vale para qualquer servidor: a chamada sobrevive a trocar de servidor, e este
 * é o indicador persistente de que ela está de pé. Voltar ao palco de outro
 * servidor leva junto o servidor da sala.
 */
export function WidgetDaChamadaConectado({ servidorAberto }: { servidorAberto: string }) {
  const chamada = useChamada();
  const canto = useCantoDaSala();
  const canal = useChannel(chamada.channelId);
  const serverId = canal?.serverId ?? servidorAberto;
  const pessoas = usePessoasDaSala(serverId, chamada.channelId);
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const tempo = useTempoDecorrido(chamada.estado === "dentro" ? chamada.desde : 0);

  if (chamada.estado === "fora" || !canal) return null;

  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.nome || salas.alguem;
  const quemTransmite = pessoas.find((p) => p.estado === "tela");
  const quemFala = falantes[0];

  return (
    <WidgetDaChamada
      sala={canal.name}
      tempo={tempo}
      transmissao={quemTransmite ? voz.palco.telaDe(nomeDe(quemTransmite.id)) : undefined}
      quemFala={quemFala !== undefined ? nomeDe(quemFala) : undefined}
      canto={canto}
      onCanto={fixarSalaNoCanto}
      onVoltar={() => {
        if (serverId !== servidorAberto) abrirServidor(serverId);
        definirPalco({ tipo: "grade" });
      }}
      mudo={chamada.mudo}
      surdo={chamada.surdo}
      camera={chamada.camera}
      tela={chamada.tela}
      onMudo={() => void alternarMudo()}
      onSurdo={() => void alternarSurdo()}
      onCamera={chamada.estado === "dentro" ? () => void alternarCamera() : undefined}
      onTela={chamada.estado === "dentro" ? () => void alternarTela() : undefined}
      onSair={() => void sairDaSala()}
    />
  );
}
