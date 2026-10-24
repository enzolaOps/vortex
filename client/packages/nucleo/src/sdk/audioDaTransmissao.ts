/**
 * O caminho do SOM de uma tela compartilhada, de quem assiste — e só ele.
 *
 * ⚠ **Por que não `webAudioMix` na sala.** O LiveKit aplica ganho acima de 1
 * quando a faixa tem um `AudioContext`; sem ele escreve em
 * `HTMLMediaElement.volume`, que lança fora de [0, 1]. `webAudioMix` daria
 * contexto a TODA faixa — a voz das pessoas, o volume por pessoa, o seletor de
 * saída e o ensurdecer mudariam de caminho para servir a um controle que só a
 * transmissão tem. Aqui o contexto é dado SÓ às faixas de som de tela, por
 * `setAudioContext` antes do `attach`: o `<audio>` fica mudo e o som sai pelo
 * `GainNode` do contexto.
 *
 * ⚠ **A saída de áudio precisa ser repetida no contexto.** `switchActiveDevice`
 * da sala troca o `sinkId` dos elementos, e o elemento aqui está mudo: sem
 * `AudioContext.setSinkId` o som da tela continuaria no dispositivo padrão
 * enquanto a voz ia para o fone escolhido.
 *
 * Sem LiveKit importado: o motor passa as faixas e o teste passa dublês com a
 * mesma forma.
 */

/** O que este módulo usa de uma `RemoteAudioTrack`. */
export interface FaixaDeSomDaTela {
  readonly attachedElements: readonly HTMLMediaElement[];
  attach(): HTMLMediaElement;
  setAudioContext(contexto: AudioContext | undefined): void;
  setVolume(volume: number): void;
}

export interface OpcoesDoAudioDaTransmissao {
  /** `undefined` quando o navegador não tem Web Audio. */
  criarContexto: () => AudioContext | undefined;
  /** Onde os `<audio>` moram (fora da árvore React). */
  destino: () => HTMLElement;
  /** O ganho guardado de quem transmite, de 0 a 3. */
  ganho: (userId: string) => number;
}

export interface AudioDaTransmissao {
  /**
   * A faixa chegou (primeira assinatura, re-assinatura ou reconexão): dá o
   * contexto, anexa se ninguém anexou e aplica o ganho.
   */
  receber(userId: string, faixa: FaixaDeSomDaTela): void;
  /** Reaplica o ganho guardado numa faixa já anexada. */
  aplicar(userId: string, faixa: FaixaDeSomDaTela): void;
  /** O seletor de saída mudou. `undefined` ou `"default"` = padrão do sistema. */
  trocarSaida(deviceId: string | undefined): Promise<void>;
  /** A sala acabou. */
  fechar(): void;
}

type ContextoComSaida = AudioContext & { setSinkId?: (id: string) => Promise<void> };

export function criarAudioDaTransmissao(opcoes: OpcoesDoAudioDaTransmissao): AudioDaTransmissao {
  let contexto: ContextoComSaida | undefined;
  let saida: string | undefined;
  /* Faixas que receberam o contexto. Fraco: a faixa morre com a assinatura. */
  let comContexto = new WeakSet<FaixaDeSomDaTela>();

  function obterContexto(): ContextoComSaida | undefined {
    if (!contexto) {
      contexto = opcoes.criarContexto();
      if (contexto) void aplicarSaidaNoContexto(contexto);
    }
    return contexto;
  }

  async function aplicarSaidaNoContexto(c: ContextoComSaida): Promise<void> {
    if (!c.setSinkId) return;
    /* `"default"` não é aceito por `AudioContext.setSinkId`; a string vazia é o
       padrão do sistema. */
    const id = saida === undefined || saida === "default" ? "" : saida;
    try {
      await c.setSinkId(id);
    } catch {
      /* Dispositivo sumiu: o padrão do sistema assume, como na voz. */
    }
  }

  function aplicar(userId: string, faixa: FaixaDeSomDaTela): void {
    const bruto = opcoes.ganho(userId);
    /*
      ⚠ **Sem contexto o teto volta a ser 1**, e não é cautela: o LiveKit
      escreveria 3 em `HTMLMediaElement.volume` e LANÇARIA dentro do handler
      de `TrackSubscribed`, derrubando o som da tela inteira em vez de só o
      ganho extra.
    */
    const teto = comContexto.has(faixa) ? 3 : 1;
    faixa.setVolume(Math.min(teto, Math.max(0, bruto)));
  }

  return {
    receber(userId, faixa) {
      const c = obterContexto();
      if (c && !comContexto.has(faixa)) {
        /* ANTES do `attach`: é ele que liga o `GainNode` e emudece o elemento. */
        faixa.setAudioContext(c);
        comContexto.add(faixa);
      }
      if (faixa.attachedElements.length === 0) opcoes.destino().appendChild(faixa.attach());
      aplicar(userId, faixa);
    },
    aplicar,
    async trocarSaida(deviceId) {
      saida = deviceId;
      if (contexto) await aplicarSaidaNoContexto(contexto);
    },
    fechar() {
      void contexto?.close().catch(() => {});
      contexto = undefined;
      comContexto = new WeakSet();
    },
  };
}
