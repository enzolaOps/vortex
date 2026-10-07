/**
 * O lado de quem ASSISTE: anunciar o que se está vendo, e em que qualidade.
 *
 * O motor avisa quando uma tela é assinada (`comecou`) e devolvida
 * (`terminou`); este módulo mede o que está chegando a cada `intervaloDeAmostra`
 * e escreve o atributo `vx.assiste` (ver `espectadores.ts`) no próprio
 * participante.
 *
 * ⚠ **Throttle na ESCRITA, não só na leitura.** Todo `setAttributes` vira uma
 * mensagem de sinalização que o servidor repassa para a sala inteira; um
 * anúncio por mudança de resolução, numa sala de dez pessoas com a rede
 * oscilando, seria tráfego proporcional ao ruído da rede de todo mundo.
 * Uma escrita por `intervaloDeEscrita` no máximo, a última sempre ganha, e
 * valor igual ao escrito não é reescrito.
 *
 * Puro de `livekit-client`: o motor entrega as quatro operações que precisam
 * da sala, e o teste as dubla.
 */

import type { Assistindo } from "../store/espectadores";
import { codificarAssistindo, limitadoPelaRede } from "./espectadores";

export interface Medida {
  /** Altura do quadro que chega. */
  readonly recebida?: number;
  /** Altura do que o dono publica. */
  readonly publicada?: number;
  /** `false` quando o vídeo está desligado ("só áudio") — não é assistir. */
  readonly ativa: boolean;
}

export interface FonteDoAnuncio {
  /** A conexão tem `canUpdateMetadata`? Sem ela, escrever é recusado. */
  podeEscrever(): boolean;
  escrever(valor: string): Promise<void>;
  /** O que chega da tela de `dono` agora; `undefined` se ela sumiu. */
  medir(dono: string): Promise<Medida | undefined>;
  telaCheia(): boolean;
  /** Quem escreveu: o estado local também precisa chegar ao store. */
  aoEscrever?(lista: readonly Assistindo[]): void;
}

export interface AnuncioDeAssistir {
  comecou(dono: string): void;
  terminou(dono: string): void;
  /** A pessoa escolheu uma qualidade menor: não é a rede, é ela. */
  pediuMenos(dono: string, sim: boolean): void;
  /** Mede de novo agora — depois de trocar qualidade, entrar em tela cheia. */
  reamostrar(): void;
  /** A sala acabou. Não escreve nada: não há mais onde escrever. */
  limpar(): void;
}

export function criarAnuncioDeAssistir(
  fonte: FonteDoAnuncio,
  { intervaloDeEscrita = 1000, intervaloDeAmostra = 2000 } = {},
): AnuncioDeAssistir {
  /** dono → a pessoa pediu menos? */
  const assistindo = new Map<string, boolean>();
  let atual: readonly Assistindo[] = [];
  let escrito = "";
  let ultimaEscrita = -Infinity;
  let escritaAdiada: ReturnType<typeof setTimeout> | undefined;
  let amostrador: ReturnType<typeof setInterval> | undefined;
  let geracao = 0;

  function escreverAgora(): void {
    escritaAdiada = undefined;
    const valor = codificarAssistindo(atual);
    fonte.aoEscrever?.(atual);
    if (valor === escrito || !fonte.podeEscrever()) return;
    escrito = valor;
    ultimaEscrita = Date.now();
    /* Recusa do servidor (grant ausente, sala caindo) não derruba nada: o
       anúncio é exibição, e a próxima mudança tenta de novo. */
    fonte.escrever(valor).catch(() => {
      escrito = "";
    });
  }

  function agendarEscrita(): void {
    if (escritaAdiada !== undefined) return;
    const espera = ultimaEscrita + intervaloDeEscrita - Date.now();
    if (espera <= 0) escreverAgora();
    else escritaAdiada = setTimeout(escreverAgora, espera);
  }

  async function amostrar(): Promise<void> {
    const minha = ++geracao;
    const cheia = fonte.telaCheia();
    const lista: Assistindo[] = [];
    for (const [dono, pediu] of assistindo) {
      const m = await fonte.medir(dono);
      if (!m?.ativa) continue;
      lista.push({
        dono,
        ...(m.recebida === undefined ? {} : { altura: m.recebida }),
        rede: limitadoPelaRede(m.recebida, m.publicada, pediu),
        cheia,
      });
    }
    /* Uma amostra mais nova começou enquanto esta esperava estatística: a
       antiga não pode sobrescrever o que a nova vai dizer. */
    if (minha !== geracao) return;
    atual = lista;
    agendarEscrita();
  }

  function ligarAmostrador(): void {
    if (assistindo.size === 0) {
      if (amostrador !== undefined) clearInterval(amostrador);
      amostrador = undefined;
      return;
    }
    amostrador ??= setInterval(() => void amostrar(), intervaloDeAmostra);
  }

  return {
    comecou(dono) {
      if (assistindo.has(dono)) return;
      assistindo.set(dono, false);
      ligarAmostrador();
      void amostrar();
    },
    terminou(dono) {
      if (!assistindo.delete(dono)) return;
      ligarAmostrador();
      void amostrar();
    },
    pediuMenos(dono, sim) {
      if (!assistindo.has(dono)) return;
      assistindo.set(dono, sim);
      void amostrar();
    },
    reamostrar() {
      if (assistindo.size > 0 || atual.length > 0) void amostrar();
    },
    limpar() {
      geracao++;
      assistindo.clear();
      atual = [];
      escrito = "";
      ultimaEscrita = -Infinity;
      if (escritaAdiada !== undefined) clearTimeout(escritaAdiada);
      escritaAdiada = undefined;
      if (amostrador !== undefined) clearInterval(amostrador);
      amostrador = undefined;
    },
  };
}
