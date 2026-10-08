import { alternarCamera, alternarMudo, alternarSurdo, alternarTela } from "nucleo/sdk/chamada";
import { useChamada, usePode } from "nucleo/store/hooks";
import { toast } from "nucleo/ui-logica/toastStore";

import { voz } from "../../textos";
import { sairDaSala } from "./acoes";

/**
 * Os cinco controles da chamada ligados ao núcleo, na forma que o `ControlesDeVoz`
 * do DS recebe. É a única definição de "o que a pessoa pode usar": a cápsula do
 * palco e o painel da coluna de salas leem daqui, e não divergem.
 *
 * Controle que a pessoa não pode usar fica `undefined` e não aparece (PRD 4.7):
 * sem `Speak` não há microfone; sem `Video`, nem câmera nem transmissão.
 */
export function useControlesDaChamada(nomeDaSala: string) {
  const chamada = useChamada();
  // Mudo e fone são preferência (valem antes de a sala existir). Câmera e tela precisam de sala.
  const dentro = chamada.estado === "dentro" || chamada.estado === "reconectando";
  const podeFalar = usePode(chamada.channelId, "falarNaVoz");
  const podeTransmitir = usePode(chamada.channelId, "transmitirVideo");
  return {
    mudo: chamada.mudo,
    surdo: chamada.surdo,
    camera: chamada.camera,
    tela: chamada.tela,
    onMudo: podeFalar ? () => void alternarMudo() : undefined,
    onSurdo: () => void alternarSurdo(),
    onCamera: dentro && podeTransmitir ? () => void alternarCamera() : undefined,
    onTela: dentro && podeTransmitir ? () => void alternarTela() : undefined,
    onSair: () => {
      void sairDaSala().then(() => {
        toast({ tipo: "info", titulo: voz.conexao.saiu(nomeDaSala) });
      });
    },
  };
}
