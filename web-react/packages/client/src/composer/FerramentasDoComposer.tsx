import {
  ChartBar,
  Gif,
  Microphone,
  MusicNotes,
  Smiley,
  Sticker,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

import { aindaNao, type PendenciaId } from "../pendente/pendencias";
import { Tooltip } from "../components/ui/Tooltip";
import css from "./FerramentasDoComposer.module.css";

/**
 * A fileira de ferramentas do composer.
 *
 * ⚠ **Todos os seis são DESENHO sem implementação, e isso é decisão de quem
 * toca o produto.** A régua anterior do projeto mandava não desenhar o que não
 * funciona; a nova manda construir 1:1 com o design agora e implementar numa
 * rodada própria. Cada um está registrado em `pendente/pendencias.ts` com o que
 * faz e do que depende — clicar diz isso em vez de não fazer nada.
 *
 * A ordem é a do design, e ela não é aleatória: emoji primeiro porque é o mais
 * usado por ordens de grandeza, voz por último porque é o único que muda o
 * MODO do composer em vez de inserir algo nele.
 */
const FERRAMENTAS: readonly {
  id: PendenciaId;
  rotulo: string;
  Icone: ComponentType<{ size?: number }>;
}[] = [
  { id: "emoji", rotulo: "Emoji", Icone: Smiley },
  { id: "gif", rotulo: "GIF", Icone: Gif },
  { id: "figurinha", rotulo: "Figurinha", Icone: Sticker },
  { id: "soundboard", rotulo: "Efeitos sonoros", Icone: MusicNotes },
  { id: "enquete", rotulo: "Enquete", Icone: ChartBar },
  { id: "mensagemDeVoz", rotulo: "Mensagem de voz", Icone: Microphone },
];

export function FerramentasDoComposer({ desabilitado }: { desabilitado: boolean }) {
  return (
    <div className={css.ferramentas}>
      {FERRAMENTAS.map(({ id, rotulo, Icone }) => (
        <Tooltip key={id} texto={rotulo}>
          <button
            type="button"
            className={css.ferramenta}
            aria-label={rotulo}
            /*
              Segue o campo: sem permissão de escrever no canal, nenhuma destas
              ferramentas tem para onde inserir o que produz. Um seletor de
              emoji aberto sobre um campo desligado é um beco.
            */
            disabled={desabilitado}
            onClick={aindaNao(id)}
          >
            <Icone size={20} />
          </button>
        </Tooltip>
      ))}
    </div>
  );
}
