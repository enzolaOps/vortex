import { loadRnnoise, RnnoiseWorkletNode } from "@sapphi-red/web-noise-suppressor";
import urlDoWasm from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import urlDoWasmSimd from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import urlDoWorklet from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";

import { TAXA_DO_RNNOISE } from "./processamento";

/**
 * Supressão de ruído FORTE — RNNoise em WebAssembly, rodando num AudioWorklet.
 *
 * ⚠ **Este módulo só é carregado com `await import()`, e só quando a opção
 * "Agressiva" está ligada.** Worklet mais os dois binários somam ~370 kB, e a
 * maioria das sessões nunca abre o microfone. Nada daqui entra no bundle
 * inicial nem no chunk do motor de voz.
 *
 * ⚠ **Por que RNNoise e não `@livekit/krisp-noise-filter`.** O Krisp é
 * melhor, e é exclusivo do LiveKit CLOUD: ele valida a URL do servidor e se
 * recusa a rodar contra um LiveKit próprio, que é exatamente o que o compose
 * desta instância sobe. RNNoise é aberto (BSD), roda inteiro na máquina de
 * quem fala, e o pacote (`@sapphi-red/web-noise-suppressor`, MIT) é só o
 * empacotamento para worklet — sem rede, sem conta, sem chave.
 *
 * ⚠ **O contexto de áudio é de 48 kHz, e não é gosto.** O modelo do RNNoise
 * foi treinado a 48 kHz e o worklet ASSUME essa taxa: num contexto de 44,1 kHz
 * ele processaria quadros do tamanho errado e a voz sairia picotada, sem erro
 * nenhum. Quem cria o contexto é o motor de voz (`sdk/motorDeVoz.ts`), fora
 * deste módulo: criar um `AudioContext` não pode custar o download do WASM.
 */

/**
 * Os binários são buscados UMA vez por sessão.
 *
 * Ligar e desligar a opção várias vezes numa chamada não deve baixar o WASM a
 * cada volta; a promessa fica guardada, e uma falha é esquecida para a próxima
 * tentativa poder baixar de novo.
 */
let binario: Promise<ArrayBuffer> | undefined;

function carregarBinario(): Promise<ArrayBuffer> {
  binario ??= loadRnnoise({ url: urlDoWasm, simdUrl: urlDoWasmSimd }).catch(
    (e: unknown) => {
      binario = undefined;
      throw e;
    },
  );
  return binario;
}

/** O worklet é registrado por CONTEXTO — registrar de novo lança. */
const registrados = new WeakSet<BaseAudioContext>();

async function registrar(contexto: AudioContext): Promise<void> {
  if (registrados.has(contexto)) return;
  await contexto.audioWorklet.addModule(urlDoWorklet);
  registrados.add(contexto);
}

export type SupressorDeRuido = {
  /** A faixa limpa — é esta que vai para o transporte. */
  readonly faixa: MediaStreamTrack;
  /** Solta o grafo e a faixa de saída. A de ENTRADA é de quem chamou. */
  destruir(): void;
};

/**
 * Passa uma faixa de microfone pelo RNNoise.
 *
 * `fonte → rnnoise → destino`, e a faixa do destino é a saída. Mono de
 * propósito (`maxChannels: 1`): voz é mono, e o custo do RNNoise é por canal.
 */
export async function suprimirRuido(
  entrada: MediaStreamTrack,
  contexto: AudioContext,
): Promise<SupressorDeRuido> {
  if (contexto.sampleRate !== TAXA_DO_RNNOISE) {
    throw new Error(`o RNNoise exige ${TAXA_DO_RNNOISE} Hz, o contexto tem ${contexto.sampleRate}`);
  }
  const [wasmBinary] = await Promise.all([carregarBinario(), registrar(contexto)]);

  /* Contexto criado fora de um gesto nasce suspenso em alguns navegadores, e
     um contexto suspenso entrega silêncio — a pessoa falaria para ninguém. */
  if (contexto.state === "suspended") await contexto.resume();

  const fonte = contexto.createMediaStreamSource(new MediaStream([entrada]));
  const rnnoise = new RnnoiseWorkletNode(contexto, { maxChannels: 1, wasmBinary });
  const destino = contexto.createMediaStreamDestination();
  fonte.connect(rnnoise).connect(destino);

  const [faixa] = destino.stream.getAudioTracks();
  if (!faixa) throw new Error("o destino de áudio não produziu faixa");

  return {
    faixa,
    destruir() {
      fonte.disconnect();
      rnnoise.disconnect();
      rnnoise.destroy();
      faixa.stop();
    },
  };
}
