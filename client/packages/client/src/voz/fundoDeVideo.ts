import {
  BackgroundProcessor,
  supportsBackgroundProcessors,
  type BackgroundProcessorWrapper,
  type SwitchBackgroundProcessorOptions,
} from "@livekit/track-processors";

import urlDoModelo from "./modelos/selfie_segmenter.tflite?url";
import type { FundoDeVideo } from "../store/preferenciasDeVoz";

/**
 * Fundo do vídeo — desfoque ou imagem, por segmentação de pessoa.
 *
 * ⚠ **Só carregado com `await import()`, e só com a câmera LIGADA e a opção
 * ativa.** `@livekit/track-processors` traz o MediaPipe Tasks Vision (~140 kB
 * de JS) e o runtime WASM dele (~9 MB). Nada disso pode encostar no bundle
 * inicial, e nem no chunk do motor de voz: quem entra numa chamada só de áudio
 * não baixa um byte de segmentação.
 *
 * ⚠ **Tudo servido pela PRÓPRIA origem, nada de CDN.** O pacote busca, por
 * padrão, o runtime em `cdn.jsdelivr.net` e o modelo em
 * `storage.googleapis.com`. A CSP bloqueia os dois — e deveria: seria a câmera
 * de quem usa dependendo de dois domínios de terceiro, com o IP indo junto a
 * cada chamada. O runtime é copiado de `node_modules` para
 * `/mediapipe/<versão>/` pelo plugin `mediapipeLocal` do `vite.config.ts`; o
 * modelo (`selfie_segmenter.tflite`, float16, 250 kB, Apache-2.0) mora no
 * repositório ao lado deste arquivo, porque não existe em pacote npm nenhum.
 */

/**
 * O raio do desfoque, em px.
 *
 * O design desenha só as três opções ("Nenhum · Desfoque · Imagem") e não
 * decide intensidade. 10 é o `DEFAULT_BLUR_RADIUS` do próprio LiveKit: forte o
 * bastante para apagar o que está atrás, fraco o bastante para o contorno da
 * pessoa não ganhar halo.
 */
export const RAIO_DO_DESFOQUE = 10;

/**
 * Onde o runtime do MediaPipe é servido. A versão entra no caminho para o
 * cache do navegador nunca servir um `.wasm` de uma versão com o `.js` de
 * outra — e precisa bater com a do plugin, que lê a mesma dependência.
 */
export const CAMINHO_DO_RUNTIME = `${import.meta.env.BASE_URL}mediapipe/${__VERSAO_MEDIAPIPE__}`;

/** O navegador sabe fazer isto? WebGL2, `OffscreenCanvas` e `VideoFrame`. */
export function suportaFundo(): boolean {
  try {
    return supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

/**
 * A imagem de fundo.
 *
 * ⚠ **O design não desenha seletor de imagem** — "Imagem" é um dos três
 * segmentos e nada mais. Então há UMA imagem, e ela é gerada aqui em vez de
 * vir de arquivo: o gradiente da marca (`#35C2CC → #1E7F92`, o mesmo de
 * `PALETA_DA_MARCA`) sobre o neutro mais escuro da rampa. Gerada e não
 * baixada porque a CSP não deixa `img-src` sair da origem, e porque um JPEG de
 * paisagem num repositório é decisão de identidade que ninguém tomou.
 *
 * Em `data:` — o `img-src` aceita — e memorizada: gerar um canvas de 1280×720
 * a cada troca de opção seria trabalho à toa.
 */
let imagem: string | undefined;

export function imagemDeFundo(): string {
  if (imagem) return imagem;
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#08090b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    g.addColorStop(0, "rgb(53 194 204 / 55%)");
    g.addColorStop(1, "rgb(30 127 146 / 20%)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  imagem = canvas.toDataURL("image/png");
  return imagem;
}

/** As opções do LiveKit para cada escolha. "nenhum" é `disabled`. */
export function opcoesDeFundo(fundo: FundoDeVideo): SwitchBackgroundProcessorOptions {
  switch (fundo) {
    case "desfoque":
      return { mode: "background-blur", blurRadius: RAIO_DO_DESFOQUE };
    case "imagem":
      return { mode: "virtual-background", imagePath: imagemDeFundo() };
    case "nenhum":
      return { mode: "disabled" };
  }
}

/** O nome com que o processador se registra na faixa. */
export const NOME_DO_FUNDO = "vortex-fundo";

/**
 * Um processador novo, já no modo pedido.
 *
 * Lança quando o navegador não suporta — quem chama decide o que dizer.
 */
export function criarProcessadorDeFundo(
  fundo: Exclude<FundoDeVideo, "nenhum">,
): BackgroundProcessorWrapper {
  const opcoes = opcoesDeFundo(fundo);
  return BackgroundProcessor(
    {
      ...(opcoes.mode === "background-blur"
        ? { mode: "background-blur", blurRadius: opcoes.blurRadius }
        : opcoes.mode === "virtual-background"
          ? { mode: "virtual-background", imagePath: opcoes.imagePath }
          : { mode: "disabled" }),
      assetPaths: {
        tasksVisionFileSet: CAMINHO_DO_RUNTIME,
        modelAssetPath: urlDoModelo,
      },
    },
    NOME_DO_FUNDO,
  );
}
