import { usuarioLocalId } from "nucleo/sdk/adapter";
import { fixarSalaNoCanto } from "nucleo/store/preferenciasDaSala";
import {
  useCantoDaSala,
  useChamada,
  useChannel,
  useFalantes,
  usePessoasDaSala,
} from "nucleo/store/hooks";
import { abrirConversa } from "nucleo/store/navegacao";
import { definirPalco } from "nucleo/store/palcoDeVoz";
import { abrirServidor } from "nucleo/store/ultimoLugar";

import { salas, voz } from "../../textos";
import { WidgetDaChamada } from "../../ui/ds";
import { escolherFoco } from "./foco";
import { useTempoDecorrido } from "./hooks";
import { VideoEmFoco } from "./VideoEmFoco";

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
  // DM e grupo não têm servidor: os nomes se resolvem pela pessoa (chave de servidor vazia).
  const serverId = canal === undefined ? servidorAberto : (canal.serverId ?? "");
  const pessoas = usePessoasDaSala(serverId, chamada.channelId);
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const eu = usuarioLocalId();
  const tempo = useTempoDecorrido(chamada.estado === "dentro" ? chamada.desde : 0);

  if (chamada.estado === "fora" || !canal) return null;

  // ⚠ A janelinha existe SÓ para a transmissão (inclusive a sua). Sem ninguém transmitindo não há
  // o que espiar: os controles da chamada ficam na coluna de salas.
  const quemTransmite = pessoas.find((p) => p.estado === "tela");
  if (quemTransmite === undefined && !chamada.tela) return null;

  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.nome || salas.alguem;
  const quemFala = falantes[0];
  const foco = escolherFoco(
    pessoas.map((p) => ({
      id: p.id,
      transmitindo: p.estado === "tela",
      camera: p.id === eu ? chamada.camera : chamada.comCamera.includes(p.id),
    })),
    falantes,
    eu,
  );

  return (
    <WidgetDaChamada
      sala={canal.name}
      tempo={tempo}
      transmissao={quemTransmite ? voz.palco.telaDe(nomeDe(quemTransmite.id)) : voz.palco.suaTela}
      quemFala={quemFala !== undefined ? nomeDe(quemFala) : undefined}
      video={
        foco ? (
          <VideoEmFoco
            foco={foco}
            nome={nomeDe(foco.userId)}
            imagem={pessoas.find((p) => p.id === foco.userId)?.avatarUrl}
            proprio={foco.userId === eu}
          />
        ) : undefined
      }
      canto={canto}
      onCanto={fixarSalaNoCanto}
      onVoltar={() => {
        // Chamada de DM ou grupo: o palco é da conversa, não de um servidor.
        if (canal.serverId === undefined) abrirConversa(chamada.channelId);
        else if (serverId !== servidorAberto) abrirServidor(serverId);
        definirPalco({ tipo: "grade" });
      }}
    />
  );
}
