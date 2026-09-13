/**
 * O áudio de UMA janela compartilhada, vindo da casca como PCM.
 *
 * ⚠ **Ponte PRÓPRIA (`window.vortexAudioDeJanela`), e não um verbo a mais em
 * `vortexTela`.** O cliente é carregado por URL e atualiza antes da casca; um
 * verbo novo no contrato do seletor faria toda casca antiga parecer
 * incompleta, e `ponteDeTela()` desligaria o seletor inteiro. Ausente aqui só
 * quer dizer "a janela vai sem som".
 *
 * O lado da casca está em `vendor/stoat-desktop/src/native/audioDaJanela.ts`:
 * loopback por PROCESSO do Windows, porque o do Electron é o som do sistema
 * inteiro.
 */

export type PonteDeAudioDeJanela = {
  readonly disponivel: () => Promise<boolean>;
  /** Começa a capturar a janela que a casca acabou de entregar ao vídeo. */
  readonly iniciar: () => Promise<boolean>;
  readonly parar: () => Promise<void>;
  /** Blocos de PCM: 16 bits, estéreo intercalado, 48 kHz. */
  readonly assinar: (ouvinte: (bloco: Uint8Array) => void) => () => void;
};

declare global {
  interface Window {
    readonly vortexAudioDeJanela?: PonteDeAudioDeJanela;
  }
}

const VERBOS: Record<keyof PonteDeAudioDeJanela, true> = {
  disponivel: true,
  iniciar: true,
  parar: true,
  assinar: true,
};

/** A ponte, se completa. Incompleta vale como ausente — sem toast: o efeito é só a janela ir sem som. */
export function ponteDeAudioDeJanela(): PonteDeAudioDeJanela | undefined {
  if (typeof window === "undefined") return undefined;
  const ponte = window.vortexAudioDeJanela as
    | Record<string, unknown>
    | undefined;
  if (!ponte) return undefined;
  const completa = Object.keys(VERBOS).every(
    (v) => typeof ponte[v] === "function",
  );
  return completa ? window.vortexAudioDeJanela : undefined;
}

/** O id do `desktopCapturer` é de uma janela, e não de uma tela inteira? */
export function ehJanela(fonteId: string): boolean {
  return fonteId.startsWith("window:");
}

export const TAXA_DO_PCM = 48_000;
export const CANAIS_DO_PCM = 2;

/** 16 bits × 2 canais: um QUADRO estéreo são quatro bytes. */
const BYTES_POR_QUADRO = 2 * CANAIS_DO_PCM;

/**
 * Converte blocos de bytes em quadros inteiros de 16 bits, guardando a sobra.
 *
 * ⚠ **O IPC não promete blocos alinhados.** A captura entrega 1920 bytes por
 * vez, mas nada no caminho garante isso. Um byte solto viraria meia amostra, e
 * toda amostra seguinte sairia deslocada — ruído puro; uma amostra solta
 * trocaria esquerda por direita. A sobra espera o próximo bloco.
 *
 * Separado do resto para o teste exercitar sem WebCodecs.
 */
export function criarDecodificadorDePcm() {
  let sobra = new Uint8Array(0);
  return function decodificar(bloco: Uint8Array): Int16Array<ArrayBuffer> {
    const bytes = new Uint8Array(sobra.length + bloco.length);
    bytes.set(sobra);
    bytes.set(bloco, sobra.length);
    const util = bytes.length - (bytes.length % BYTES_POR_QUADRO);
    sobra = bytes.slice(util);
    /* Cópia para um buffer próprio: `bloco` pode começar num offset ímpar do
       buffer de origem, e um `Int16Array` direto sobre ele lançaria. */
    const saida = new Int16Array(util / 2);
    new Uint8Array(saida.buffer).set(bytes.subarray(0, util));
    return saida;
  };
}

/* WebCodecs + "breakout box" existem no Chromium do Electron, e não estão
   todos no `lib.dom` do TypeScript. */
type GeradorDeFaixa = MediaStreamTrack & {
  readonly writable: WritableStream<AudioData>;
};
declare const MediaStreamTrackGenerator:
  | (new (opcoes: { kind: "audio" }) => GeradorDeFaixa)
  | undefined;

/**
 * Uma `MediaStreamTrack` de áudio alimentada pelos blocos da casca.
 *
 * ⚠ **`MediaStreamTrackGenerator` e não `AudioWorklet`.** O worklet exige
 * carregar um módulo por URL, e a CSP da casca não aceita `blob:`. O gerador
 * recebe `AudioData` direto e só existe no Chromium — que é exatamente onde a
 * casca roda.
 *
 * `undefined` quando o motor não tem a API (navegador que não é Chromium).
 */
export function criarFaixaDePcm():
  | { faixa: MediaStreamTrack; escrever: (bloco: Uint8Array) => void; fechar: () => void }
  | undefined {
  if (typeof MediaStreamTrackGenerator === "undefined") return undefined;

  const gerador = new MediaStreamTrackGenerator({ kind: "audio" });
  const escritor = gerador.writable.getWriter();
  const decodificar = criarDecodificadorDePcm();
  /** Microssegundos desde o início, derivados das AMOSTRAS e não do relógio. */
  let quadros = 0;
  let aberto = true;

  return {
    faixa: gerador,
    escrever(bloco) {
      if (!aberto) return;
      const amostras = decodificar(bloco);
      const n = amostras.length / CANAIS_DO_PCM;
      if (n === 0) return;
      const dado = new AudioData({
        format: "s16",
        sampleRate: TAXA_DO_PCM,
        numberOfFrames: n,
        numberOfChannels: CANAIS_DO_PCM,
        timestamp: Math.round((quadros * 1_000_000) / TAXA_DO_PCM),
        data: amostras,
      });
      quadros += n;
      /* Sem `await`: um bloco a cada 10 ms, e esperar a escrita anterior só
         acumularia atraso. O gerador enfileira. */
      escritor.write(dado).catch(() => {
        aberto = false;
      });
    },
    fechar() {
      if (!aberto) return;
      aberto = false;
      void escritor.close().catch(() => undefined);
      gerador.stop();
    },
  };
}

/**
 * As opções de `getDisplayMedia` com o áudio de janela restrito à janela.
 *
 * ⚠ **No navegador, compartilhar uma janela oferecia "áudio do sistema".** O
 * Chromium, com `systemAudio: "include"`, mostra esse interruptor também na
 * aba Janela, e ele captura o computador inteiro — relatado por quem usa, no
 * Brave. `windowAudio` (Chromium 141+) é a dica que separa os dois casos:
 * `"window"` só oferece o som daquela janela; onde o navegador não sabe fazer
 * isso, não oferece som nenhum. Nos dois casos o sistema não vaza.
 *
 * Tela inteira continua com `systemAudio`, e aba com o som da aba.
 *
 * Só age quando há áudio pedido e ninguém escolheu `windowAudio` antes.
 */
export function comAudioSoDaJanela<T extends object>(
  opcoes: T | undefined,
): T & { windowAudio?: "window" } {
  const o = (opcoes ?? {}) as T & { audio?: unknown; windowAudio?: unknown };
  if (!o.audio || o.windowAudio !== undefined) return o as T;
  return { ...o, windowAudio: "window" };
}

let getDisplayMediaEmbrulhado = false;

/**
 * Faz toda captura de tela da página passar por `comAudioSoDaJanela`.
 *
 * ⚠ **Embrulha o método do navegador, e a razão é o LiveKit.** Ele monta as
 * opções de `getDisplayMedia` campo a campo (`screenCaptureToDisplayMediaStreamOptions`)
 * e não conhece `windowAudio`, então passá-lo por `setScreenShareEnabled` não
 * chega ao navegador. A alternativa — capturar e publicar à mão — duplicaria o
 * ciclo de vida da transmissão que o SDK já resolve. Idempotente.
 */
export function restringirAudioDeJanelaNoNavegador(): void {
  if (getDisplayMediaEmbrulhado) return;
  const dispositivos =
    typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!dispositivos || typeof dispositivos.getDisplayMedia !== "function") {
    return;
  }
  const original = dispositivos.getDisplayMedia.bind(dispositivos);
  dispositivos.getDisplayMedia = (opcoes?: DisplayMediaStreamOptions) =>
    original(comAudioSoDaJanela(opcoes));
  getDisplayMediaEmbrulhado = true;
}
