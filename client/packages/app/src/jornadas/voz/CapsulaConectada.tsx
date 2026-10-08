import { alternarCamera, alternarMudo, alternarSurdo, alternarTela } from "nucleo/sdk/chamada";
import { pode } from "nucleo/sdk/permissoes";
import { assinarQualidadeDaTela, qualidadeEscolhida, rotuloDaQualidade } from "nucleo/store/qualidadeDaTela";
import { useChamada, useFalantes, type PessoaNaSala } from "nucleo/store/hooks";
import { toast } from "nucleo/ui-logica/toastStore";
import { useSyncExternalStore } from "react";

import { salas, voz } from "../../textos";
import { CapsulaDeControle } from "../../ui/ds";
import { sairDaSala } from "./acoes";
import { useTempoDecorrido } from "./hooks";

/**
 * A cápsula de controles da chamada, ligada aos stores.
 *
 * Microfone, fone, câmera, transmitir e sair — o rótulo é o RECURSO e o estado
 * vai em `aria-pressed` (o `ControlesDeVoz` do DS faz isso). Os cinco chamam a
 * fachada de `sdk/chamada`; nenhum fala com o motor direto.
 *
 * ⚠ Esta é a única assinatura de "quem está falando" fora dos ladrilhos, e é
 * pequena: um indicador e a lista expandida. O palco ao redor não acorda.
 */
export function CapsulaConectada({
  nomeDaSala,
  pessoas,
}: {
  nomeDaSala: string;
  pessoas: readonly PessoaNaSala[];
}) {
  const chamada = useChamada();
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const escolhida = useSyncExternalStore(assinarQualidadeDaTela, qualidadeEscolhida);
  const tempo = useTempoDecorrido(chamada.estado === "dentro" ? chamada.desde : 0);

  const status =
    chamada.estado === "conectando"
      ? voz.conexao.conectandoASala
      : chamada.estado === "reconectando"
        ? voz.conexao.reconectando
        : undefined;
  // Mudo e fone são preferência (valem antes de a sala existir). Câmera e tela precisam de sala.
  const dentro = chamada.estado === "dentro" || chamada.estado === "reconectando";
  // Controle que a pessoa não pode usar não aparece (PRD 4.7): sem `Speak` não há microfone,
  // sem `Video` não há câmera nem transmissão.
  const podeFalar = pode(chamada.channelId, "falarNaVoz");
  const podeTransmitir = pode(chamada.channelId, "transmitirVideo");

  return (
    <CapsulaDeControle
      sala={nomeDaSala}
      tempo={tempo}
      status={status}
      falando={falantes.length > 0}
      pessoas={pessoas.map((p) => ({
        id: p.id,
        nome: p.nome || salas.alguem,
        imagem: p.avatarUrl,
        falando: falantes.includes(p.id),
        mudo: p.mudo || p.surdo,
      }))}
      qualidade={chamada.tela && escolhida ? rotuloDaQualidade(escolhida) : undefined}
      mudo={chamada.mudo}
      surdo={chamada.surdo}
      camera={chamada.camera}
      tela={chamada.tela}
      onMudo={podeFalar ? () => void alternarMudo() : undefined}
      onSurdo={() => void alternarSurdo()}
      onCamera={dentro && podeTransmitir ? () => void alternarCamera() : undefined}
      onTela={dentro && podeTransmitir ? () => void alternarTela() : undefined}
      onSair={() => {
        void sairDaSala().then(() => {
          toast({ tipo: "info", titulo: voz.conexao.saiu(nomeDaSala) });
        });
      }}
    />
  );
}
