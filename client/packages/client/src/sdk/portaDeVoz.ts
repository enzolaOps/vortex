import {
  dbDoRms,
  decidirPorta,
  PORTA_FECHADA,
  rmsDe,
  type EstadoDaPorta,
} from "../lib/nivelDeAudio";
import {
  lerPreferenciasDeVoz,
  type PreferenciasDeVoz,
} from "../store/preferenciasDeVoz";

/**
 * A porta de voz do LIMIAR MANUAL — o que faz "barras à esquerda dela não
 * transmitem" ser verdade.
 *
 * Vale só no modo detecção com a sensibilidade automática DESLIGADA. Com a
 * automática ligada quem decide é o navegador (supressão de ruído e controle
 * de ganho); no push-to-talk quem decide é a tecla.
 *
 * ⚠ **`enabled` da faixa de ORIGEM, e não `mute()` do LiveKit.** `mute()`
 * sinaliza: todo mundo na sala veria o seu ícone de microfone cortado piscar a
 * cada sílaba — na coluna de canais, no cartão e na grade. `enabled = false`
 * manda silêncio pela mesma publicação, sem evento nenhum. É também a origem
 * que alimenta o RNNoise quando ele está ligado, então a porta vale com e sem
 * processador.
 *
 * ⚠ **Mede um CLONE da faixa.** Medir a própria origem fecharia a porta para
 * sempre: com `enabled = false` o analisador passa a ler zeros, e zero nunca
 * passa do limiar.
 *
 * ⚠ **`setInterval` e não `requestAnimationFrame`.** Com a janela em segundo
 * plano o rAF para de vez e a porta ficaria travada no último estado; um
 * intervalo continua rodando (aba com áudio tocando não entra em throttle
 * intenso), e na casca também.
 */

/** O que a porta precisa da faixa do LiveKit — estreito para caber em teste. */
export type FaixaDoMicrofone = {
  readonly mediaStreamTrack: MediaStreamTrack;
  readonly isMuted: boolean;
};

export function portaAtiva(p: PreferenciasDeVoz): boolean {
  return p.modo === "deteccao" && !p.sensibilidadeAutomatica;
}

/**
 * Escreve `enabled` na origem — e SÓ quando o LiveKit não a mutou.
 *
 * ⚠ Mudo e push-to-talk são do LiveKit (`setMicrophoneEnabled`), e ele também
 * mexe em `enabled`. Escrever `true` numa faixa mutada reabriria o microfone
 * de quem se mutou de propósito. A porta só FECHA o que o resto deixou aberto.
 */
export function aplicarPorta(faixa: FaixaDoMicrofone, aberta: boolean): void {
  if (faixa.isMuted) return;
  if (faixa.mediaStreamTrack.enabled !== aberta) {
    faixa.mediaStreamTrack.enabled = aberta;
  }
}

const INTERVALO_MS = 50;

/**
 * Liga a porta para a chamada atual. Devolve o desligar — que REABRE a faixa,
 * senão sair do modo manual no meio de um silêncio deixaria o microfone mudo.
 */
export function ligarPortaDeVoz(
  obterFaixa: () => FaixaDoMicrofone | undefined,
): () => void {
  let porta: EstadoDaPorta = PORTA_FECHADA;
  let origem: MediaStreamTrack | undefined;
  let ctx: AudioContext | undefined;
  let clone: MediaStreamTrack | undefined;
  let analisador: AnalyserNode | undefined;
  let amostra: Float32Array<ArrayBuffer> | undefined;
  /** A última faixa em que a porta escreveu — para devolvê-la aberta. */
  let escrita: FaixaDoMicrofone | undefined;

  function soltarMedicao() {
    clone?.stop();
    clone = undefined;
    analisador = undefined;
    origem = undefined;
    void ctx?.close();
    ctx = undefined;
  }

  function reabrir() {
    if (escrita) aplicarPorta(escrita, true);
    escrita = undefined;
    porta = PORTA_FECHADA;
  }

  function medir(faixa: FaixaDoMicrofone): number | undefined {
    /* A origem troca quando o dispositivo troca ou a faixa é reaberta: o
       clone velho mediria um microfone que não transmite mais. */
    if (faixa.mediaStreamTrack !== origem) {
      soltarMedicao();
      origem = faixa.mediaStreamTrack;
      clone = origem.clone();
      clone.enabled = true;
      ctx = new AudioContext();
      const fonte = ctx.createMediaStreamSource(new MediaStream([clone]));
      analisador = ctx.createAnalyser();
      analisador.fftSize = 1024;
      fonte.connect(analisador);
      amostra = new Float32Array(analisador.fftSize);
    }
    if (!analisador || !amostra) return undefined;
    analisador.getFloatTimeDomainData(amostra);
    return dbDoRms(rmsDe(amostra));
  }

  const timer = setInterval(() => {
    const prefs = lerPreferenciasDeVoz();
    const faixa = obterFaixa();
    if (!portaAtiva(prefs) || !faixa) {
      reabrir();
      soltarMedicao();
      return;
    }
    const db = medir(faixa);
    if (db === undefined) return;
    porta = decidirPorta(porta, db, prefs.limiarDb, performance.now());
    escrita = faixa;
    aplicarPorta(faixa, porta.aberta);
  }, INTERVALO_MS);

  return () => {
    clearInterval(timer);
    reabrir();
    soltarMedicao();
  };
}
