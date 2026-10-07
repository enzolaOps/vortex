import { useFaixaDeVideo, useFalantes } from "nucleo/store/hooks";
import { useRef } from "react";

import { voz } from "../../textos";
import { Avatar } from "../../ui/ds";
import { useAssinaturaDeVideo } from "./hooks";
import type { FocoDoPip } from "./foco";
import css from "./Pip.module.css";
import { VideoDaFaixa } from "./VideoDaFaixa";

/**
 * O vídeo do foco, num PiP: a transmissão ou a câmera de quem fala, e o avatar
 * quando não há imagem para mostrar.
 *
 * ⚠ **Pede a camada MÉDIA, que é a menor que o motor sabe pedir**, e pede só
 * enquanto este elemento está visível (`useAssinaturaDeVideo`). O PiP nunca é
 * o lugar de ver a transmissão em detalhe — o palco é —, então ele não paga
 * pela camada alta.
 *
 * ⚠ **`documento` é onde o vídeo aparece.** Na janela destacada a visibilidade
 * que importa é a da janela destacada, e não a da principal (que está atrás de
 * um jogo, escondida, justamente no caso em que esta janela existe).
 *
 * Quem fala é lido aqui, por pessoa: o widget e o overlay não acordam a cada
 * sílaba (lei nº 1).
 */
export function VideoEmFoco({
  foco,
  nome,
  imagem,
  proprio,
  documento = document,
}: {
  foco: FocoDoPip;
  nome: string;
  imagem?: string | undefined;
  proprio: boolean;
  documento?: Document;
}) {
  const fonte = foco.tipo === "tela" ? "tela" : "camera";
  const comImagem = foco.tipo === "tela" || foco.comCamera;
  const faixa = useFaixaDeVideo(foco.userId, fonte);
  const falando = useFalantes([foco.userId]).length > 0;
  const alvo = useRef<HTMLDivElement>(null);
  useAssinaturaDeVideo(alvo, foco.userId, fonte, "miniatura", proprio || !comImagem, documento);

  const rotulo = foco.tipo === "tela" ? voz.palco.telaDe(nome) : voz.pip.videoDe(nome);
  return (
    <div
      ref={alvo}
      className={css.foco}
      role="group"
      aria-label={rotulo}
      data-testid="video-do-pip"
      data-pessoa={foco.userId}
      data-fonte={fonte}
    >
      {comImagem && faixa ? (
        <VideoDaFaixa faixa={faixa} rotulo={rotulo} />
      ) : (
        <Avatar nome={nome} id={foco.userId} tamanho={44} imagem={imagem} falando={falando} />
      )}
    </div>
  );
}
