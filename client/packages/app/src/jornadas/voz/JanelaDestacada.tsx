import { useChamada, useJanelaDestacada } from "nucleo/store/hooks";
import { definirJanelaDestacada, fecharJanelaDestacada } from "nucleo/store/janelaDestacada";
import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";

import { modoDaJanela, prepararDocumentoDestacado } from "./destacar";
import { espelharEstilos } from "./espelharEstilos";
import { OverlayDaChamada } from "./OverlayDaChamada";

/**
 * Desenha a chamada na janela destacada, se houver uma.
 *
 * ⚠ **Portal, e não uma segunda aplicação.** A janela é um documento em branco
 * onde ESTA árvore escreve: mesmos stores, mesmas ações, mesma conexão de voz,
 * e o vídeo continua funcionando porque a faixa já está neste renderer. Nada é
 * serializado e nenhum socket novo abre.
 *
 * Montado uma vez, na raiz do app, e não dentro do widget ou do palco: a janela
 * precisa continuar viva quando a pessoa troca de tela.
 *
 * Responsabilidades:
 * - espelhar os estilos (e tema) da principal para o documento dela;
 * - esquecer a janela quando a pessoa a fecha pelo sistema (`pagehide`);
 * - fechar a janela quando a chamada acaba — janela sempre no topo com a sala
 *   de uma chamada que já não existe seria uma chamada fantasma;
 * - ajustar o tamanho dela ao conteúdo.
 */
export function JanelaDestacada() {
  const janela = useJanelaDestacada();
  const chamada = useChamada();
  const fora = chamada.estado === "fora";

  useEffect(() => {
    if (janela && fora) fecharJanelaDestacada();
  }, [janela, fora]);

  useEffect(() => {
    if (!janela) return;
    const parar = espelharEstilos(document, janela.document);
    prepararDocumentoDestacado(janela);

    const aoFechar = () => {
      definirJanelaDestacada(undefined);
    };
    janela.addEventListener("pagehide", aoFechar);
    // Fechar a principal leva a janela junto: ela não tem dono sem a árvore que a desenha.
    const aoSairDaPrincipal = () => {
      fecharJanelaDestacada();
    };
    window.addEventListener("pagehide", aoSairDaPrincipal);
    return () => {
      parar();
      janela.removeEventListener("pagehide", aoFechar);
      window.removeEventListener("pagehide", aoSairDaPrincipal);
    };
  }, [janela]);

  const ajustar = useCallback(
    (largura: number, altura: number) => {
      if (!janela || largura === 0 || altura === 0) return;
      try {
        if (modoDaJanela() === "casca") {
          // A casca ancora o canto de baixo e do fim (`boundsAncorados`).
          janela.resizeTo(largura, altura);
        } else {
          // No Document PiP `resizeTo` é tamanho EXTERNO; a diferença corrige só o conteúdo.
          janela.resizeBy(largura - janela.innerWidth, altura - janela.innerHeight);
        }
      } catch {
        // Janela que não aceita redimensionar fica como está.
      }
    },
    [janela],
  );

  if (!janela) return null;
  return createPortal(<OverlayDaChamada documento={janela.document} aoMedir={ajustar} />, janela.document.body);
}
