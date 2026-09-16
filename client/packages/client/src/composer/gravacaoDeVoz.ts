import { toast } from "../components/ui/toastStore";
import { temServidorDeMidia } from "../sdk/anexos";
import {
  DURACAO_MAXIMA_S,
  TAXA_DO_ENVIO,
  codificarWav,
  empurrarNivel,
  formatoDeGravacao,
  nivelDoTrecho,
  nomeDaGravacao,
} from "./wav";

/**
 * A gravação de mensagem de voz — store module-level, uma por aba.
 *
 * ⚠ **Fora do React, e não num `useState` do composer.** O microfone, o
 * `MediaRecorder` e o `AudioContext` são recursos da ABA, não do componente:
 * um composer que remonta (trocar de canal, mudar a densidade) não pode deixar
 * o microfone aberto sem dono — que é exatamente o que um `useRef` perdido
 * faria, com a luz de gravação do sistema acesa e nada na tela para apagá-la.
 * Aqui há UM dono, e `cancelarGravacao` sempre o encontra.
 *
 * O snapshot republica a cada 100 ms enquanto grava — tempo e onda. Quem
 * assina é só o gravador do composer; a lista de mensagens não fica sabendo.
 */
export type Gravacao =
  | { readonly fase: "parada" }
  | { readonly fase: "pedindo"; readonly channelId: string }
  | {
      readonly fase: "gravando" | "revisando" | "preparando";
      readonly channelId: string;
      readonly segundos: number;
      readonly niveis: readonly number[];
      /** Só em `revisando`: a prévia está tocando. */
      readonly tocando: boolean;
    };

const PARADA: Gravacao = { fase: "parada" };

let atual: Gravacao = PARADA;
const ouvintes = new Set<() => void>();

function publicar(proxima: Gravacao): void {
  atual = proxima;
  for (const o of ouvintes) o();
}

export function assinarGravacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerGravacao(): Gravacao {
  return atual;
}

/**
 * Dá para gravar aqui.
 *
 * Três condições, e a terceira é a que a pendência nomeava: sem servidor de
 * mídia a gravação não tem para onde ir, e pedir o microfone para produzir um
 * arquivo que morre na aba é pior que não ter o botão.
 */
export function podeGravar(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia !== undefined &&
    temServidorDeMidia()
  );
}

/* ------------------------------------------------------------ recursos */

let stream: MediaStream | undefined;
let recorder: MediaRecorder | undefined;
let pedacos: Blob[] = [];
let contexto: AudioContext | undefined;
let relogio: ReturnType<typeof setInterval> | undefined;
let gravado: Blob | undefined;
let previa: HTMLAudioElement | undefined;
let urlDaPrevia: string | undefined;

/**
 * Sobe a cada começo e a cada cancelamento.
 *
 * `getUserMedia` e `recorder.stop()` são assíncronos: sem geração, cancelar
 * enquanto o navegador ainda pergunta pela permissão deixaria a resposta
 * chegar depois e abrir o microfone de uma gravação que ninguém quer mais.
 */
let geracao = 0;

function soltarMicrofone(): void {
  if (relogio !== undefined) clearInterval(relogio);
  relogio = undefined;
  for (const t of stream?.getTracks() ?? []) t.stop();
  stream = undefined;
  void contexto?.close();
  contexto = undefined;
}

function soltarTudo(): void {
  soltarMicrofone();
  if (recorder !== undefined && recorder.state !== "inactive") recorder.stop();
  recorder = undefined;
  pedacos = [];
  gravado = undefined;
  previa?.pause();
  previa = undefined;
  if (urlDaPrevia !== undefined) URL.revokeObjectURL(urlDaPrevia);
  urlDaPrevia = undefined;
}

/* ------------------------------------------------------------- ações */

export async function comecarGravacao(channelId: string): Promise<void> {
  if (atual.fase !== "parada" || !podeGravar()) return;
  const minha = ++geracao;
  publicar({ fase: "pedindo", channelId });

  let obtido: MediaStream;
  try {
    obtido = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  } catch (e) {
    if (minha !== geracao) return;
    publicar(PARADA);
    const nome = e instanceof DOMException ? e.name : "";
    toast({
      tipo: "erro",
      titulo:
        nome === "NotFoundError"
          ? "Nenhum microfone encontrado."
          : nome === "NotAllowedError"
            ? "Sem permissão para usar o microfone."
            : "Não deu para abrir o microfone.",
      descricao:
        nome === "NotAllowedError"
          ? "Libere o microfone para este site nas permissões do navegador."
          : undefined,
    });
    return;
  }

  if (minha !== geracao) {
    for (const t of obtido.getTracks()) t.stop();
    return;
  }

  stream = obtido;
  const tipo = formatoDeGravacao((t) => MediaRecorder.isTypeSupported(t));
  recorder = new MediaRecorder(obtido, tipo ? { mimeType: tipo } : undefined);
  pedacos = [];
  recorder.addEventListener("dataavailable", (e) => {
    if (e.data.size > 0) pedacos.push(e.data);
  });
  recorder.start(250);

  /*
    A onda sai de um `AnalyserNode` lido no MESMO relógio do tempo, e não de
    `requestAnimationFrame`: 10 quadros por segundo bastam para uma onda de
    32 barras, e rAF a 60 Hz republicaria o snapshot seis vezes mais para
    nada. Também não para quando a aba perde composição — ver a linha do
    painel escondido no `CLAUDE.md`.
  */
  contexto = new AudioContext();
  const analisador = contexto.createAnalyser();
  analisador.fftSize = 1024;
  contexto.createMediaStreamSource(obtido).connect(analisador);
  const trecho = new Float32Array(analisador.fftSize);

  const inicio = performance.now();
  let niveis: readonly number[] = [];
  publicar({ fase: "gravando", channelId, segundos: 0, niveis, tocando: false });

  relogio = setInterval(() => {
    if (atual.fase !== "gravando") return;
    analisador.getFloatTimeDomainData(trecho);
    niveis = empurrarNivel(niveis, nivelDoTrecho(trecho));
    const segundos = (performance.now() - inicio) / 1000;
    publicar({ ...atual, segundos, niveis });
    if (segundos >= DURACAO_MAXIMA_S) void pararGravacao();
  }, 100);
}

/** Para de gravar e passa a revisar. O arquivo fica guardado. */
export async function pararGravacao(): Promise<void> {
  if (atual.fase !== "gravando" || recorder === undefined) return;
  const minha = geracao;
  const r = recorder;
  if (relogio !== undefined) clearInterval(relogio);
  relogio = undefined;

  await new Promise<void>((resolver) => {
    r.addEventListener("stop", () => resolver(), { once: true });
    r.stop();
  });
  if (minha !== geracao || atual.fase !== "gravando") return;

  gravado = new Blob(pedacos, { type: r.mimeType });
  soltarMicrofone();
  publicar({ ...atual, fase: "revisando", tocando: false });
}

/** Toca ou pausa o que foi gravado, antes de enviar. */
export function alternarPrevia(): void {
  if (atual.fase !== "revisando" || gravado === undefined) return;
  if (previa === undefined) {
    urlDaPrevia = URL.createObjectURL(gravado);
    previa = new Audio(urlDaPrevia);
    previa.addEventListener("ended", () => {
      if (atual.fase === "revisando") publicar({ ...atual, tocando: false });
    });
  }
  if (previa.paused) {
    void previa.play();
    publicar({ ...atual, tocando: true });
  } else {
    previa.pause();
    publicar({ ...atual, tocando: false });
  }
}

/**
 * Descarta. Sem argumento, descarta qualquer uma; com canal, só a daquele
 * canal — é o que o composer chama ao desmontar, e não pode derrubar uma
 * gravação de outro canal que acabou de montar.
 */
export function cancelarGravacao(channelId?: string): void {
  if (atual.fase === "parada") return;
  if (channelId !== undefined && atual.channelId !== channelId) return;
  geracao += 1;
  soltarTudo();
  publicar(PARADA);
}

/**
 * Termina (parando antes, se preciso) e devolve o arquivo pronto para subir.
 *
 * `undefined` = não havia o que enviar, ou foi cancelado no meio.
 */
export async function finalizarGravacao(): Promise<File | undefined> {
  if (atual.fase === "gravando") await pararGravacao();
  if (atual.fase !== "revisando" || gravado === undefined) return undefined;

  const minha = geracao;
  const bruto = gravado;
  previa?.pause();
  publicar({ ...atual, fase: "preparando", tocando: false });

  const arquivo = await paraWav(bruto).catch((): File => {
    /*
      ⚠ **Se decodificar falhar, vai o arquivo cru**, e é escolha: perder a
      gravação é pior que ela chegar como cartão de arquivo em vez de player.
      Na prática não acontece — o navegador decodifica o que ele mesmo gravou.
    */
    const ext = bruto.type.includes("ogg") ? "ogg" : bruto.type.includes("mp4") ? "m4a" : "webm";
    return new File([bruto], nomeDaGravacao(new Date()).replace(/\.wav$/, `.${ext}`), {
      type: bruto.type,
    });
  });

  if (minha !== geracao) return undefined;
  soltarTudo();
  publicar(PARADA);
  return arquivo;
}

/**
 * O que o `MediaRecorder` gravou, reescrito como WAV mono de 24 kHz.
 *
 * Ver `codificarWav` para o porquê: é o formato que o `autumn` classifica
 * como áudio. O `OfflineAudioContext` faz as duas conversões de uma vez —
 * `decodeAudioData` já reamostra para a taxa DELE, e renderizar num contexto
 * de um canal mistura o estéreo para mono.
 */
async function paraWav(bruto: Blob): Promise<File> {
  const decodificador = new OfflineAudioContext(1, 1, TAXA_DO_ENVIO);
  const audio = await decodificador.decodeAudioData(await bruto.arrayBuffer());

  const quadros = Math.max(1, Math.ceil(audio.duration * TAXA_DO_ENVIO));
  const mistura = new OfflineAudioContext(1, quadros, TAXA_DO_ENVIO);
  const fonte = mistura.createBufferSource();
  fonte.buffer = audio;
  fonte.connect(mistura.destination);
  fonte.start(0);
  const pronto = await mistura.startRendering();

  const wav = codificarWav(pronto.getChannelData(0), TAXA_DO_ENVIO);
  return new File([wav], nomeDaGravacao(new Date()), { type: "audio/wav" });
}
