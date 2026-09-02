import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { faixasDeVideo } from "../store/video";

/**
 * A troca de dono de uma faixa de vídeo.
 *
 * ⚠ **O defeito que estas asserções guardam foi relatado por quem usa, com
 * captura de tela.** Clicar em "Assistir" numa transmissão deixava a tela em
 * "pedindo o vídeo…" para sempre, e voltar para a grade deixava o ladrilho só
 * com o avatar. Os dois têm a mesma causa, e ela não estava em nenhuma das
 * duas telas: o ladrilho e a tela de assistir pedem a MESMA faixa, e quem
 * soltava primeiro derrubava a de quem estava chegando.
 *
 * Duas armadilhas empilhadas, e a segunda só apareceu depois de consertar a
 * primeira:
 *
 * 1. Sem contagem, o `setSubscribed(false)` do que sai cancela o do que entra.
 * 2. Com contagem, ainda passa por zero — o React roda a limpeza do que sai
 *    ANTES do efeito do que entra, mesmo no mesmo commit.
 *
 * Por isso a devolução é adiada: o pedido de quem chega cancela a de quem sai.
 *
 * ⚠ **Testa o MOTOR e não o LiveKit.** `publicacaoDeVideo` é dublada; o que
 * está sob asserção é quantas vezes `setSubscribed` é chamado e com quê, que é
 * exatamente onde o defeito morava.
 */

const USUARIO = "01JQ0000000000000001000000";
const CHAVE = `${USUARIO}:tela`;

/** O que a publicação dublada recebeu. */
let chamadas: boolean[] = [];
let faixaFalsa: MediaStreamTrack;

vi.mock("livekit-client", async () => {
  const real = await vi.importActual<Record<string, unknown>>("livekit-client");
  return real;
});

beforeEach(() => {
  vi.useFakeTimers();
  chamadas = [];
  faixaFalsa = { id: "faixa-de-teste" } as MediaStreamTrack;
  faixasDeVideo.limpar();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * A versão testável da regra, com a publicação injetada.
 *
 * ⚠ **Reimplementa a contagem em vez de importar `motorDeVoz`**, e a razão é
 * ambiente: aquele módulo carrega `livekit-client` inteiro, que abre um
 * `RTCPeerConnection` que o jsdom não tem. O que se quer provar aqui é a
 * ÁLGEBRA da contagem — quando o servidor é consultado e quando não é —, e ela
 * é a mesma nos dois lugares. A cópia é deliberada e está apontada nos dois.
 */
function criarAssinatura(atraso = 250) {
  const contagem = new Map<string, number>();
  const pendentes = new Map<string, ReturnType<typeof setTimeout>>();
  const assinado = new Set<string>();
  const pub = {
    setSubscribed: (v: boolean) => chamadas.push(v),
    track: { mediaStreamTrack: faixaFalsa },
  };

  return function assinar(chave: string, sim: boolean) {
    const depois = Math.max(0, (contagem.get(chave) ?? 0) + (sim ? 1 : -1));
    if (depois === 0) contagem.delete(chave);
    else contagem.set(chave, depois);

    const adiado = pendentes.get(chave);
    if (adiado !== undefined) {
      clearTimeout(adiado);
      pendentes.delete(chave);
    }

    if (sim) {
      if (!assinado.has(chave)) {
        assinado.add(chave);
        pub.setSubscribed(true);
      }
    } else if (depois === 0) {
      pendentes.set(
        chave,
        setTimeout(() => {
          pendentes.delete(chave);
          if ((contagem.get(chave) ?? 0) > 0) return;
          assinado.delete(chave);
          pub.setSubscribed(false);
          faixasDeVideo.apagar(chave);
        }, atraso),
      );
    }

    if (sim && pub.track.mediaStreamTrack) {
      faixasDeVideo.set(chave, pub.track.mediaStreamTrack);
    }
  };
}

describe("troca de dono da faixa de vídeo", () => {
  /*
    ⚠ **O teste que reproduz a captura de tela.** Grade e tela de assistir na
    ordem em que o React as executa: limpeza do que sai, depois efeito do que
    entra. Sem a espera, sai um `false` no meio e o servidor recebe os dois
    juntos — que é quando ele termina assinado sem reentregar.
  */
  it("trocar da grade para 'Assistir' NÃO consulta o servidor", () => {
    const assinar = criarAssinatura();

    assinar(CHAVE, true); // ladrilho da grade monta
    expect(chamadas).toEqual([true]);

    assinar(CHAVE, false); // grade desmonta (limpeza primeiro)
    assinar(CHAVE, true); // tela de assistir monta
    vi.advanceTimersByTime(1000);

    /* Um único `true` no começo, e nada além. A faixa nunca parou de descer. */
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBe(faixaFalsa);
  });

  it("voltar de 'Assistir' para a grade também não consulta", () => {
    const assinar = criarAssinatura();
    assinar(CHAVE, true);
    assinar(CHAVE, false);
    assinar(CHAVE, true);
    vi.advanceTimersByTime(1000);

    chamadas = [];
    assinar(CHAVE, false); // tela de assistir desmonta
    assinar(CHAVE, true); // ladrilho volta
    vi.advanceTimersByTime(1000);

    expect(chamadas).toEqual([]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBe(faixaFalsa);
  });

  /*
    A outra metade, e a que a contagem existe para não perder: quando o ÚLTIMO
    consumidor solta, a faixa tem de parar mesmo. Sem isto a correção viraria
    um vazamento de banda — dez faixas descendo para telas fechadas, que é o
    desperdício que `autoSubscribe: false` foi instalado para evitar.
  */
  it("o último a soltar DEVOLVE a faixa, depois da espera", () => {
    const assinar = criarAssinatura();
    assinar(CHAVE, true);
    chamadas = [];

    assinar(CHAVE, false);
    expect(chamadas).toEqual([]); // ainda não: está adiado

    vi.advanceTimersByTime(250);
    expect(chamadas).toEqual([false]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBeUndefined();
  });

  it("dois consumidores ao mesmo tempo assinam uma vez só", () => {
    const assinar = criarAssinatura();
    assinar(CHAVE, true); // ladrilho
    assinar(CHAVE, true); // prévia noutro lugar
    expect(chamadas).toEqual([true]);

    assinar(CHAVE, false); // um sai
    vi.advanceTimersByTime(1000);

    /* O outro continua querendo, então nada é devolvido. */
    expect(chamadas).toEqual([true]);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBe(faixaFalsa);
  });

  /*
    ⚠ **Repovoar na assinatura é o que cobre "já estava assinado".**
    `TrackSubscribed` é evento de CHEGADA: assinar algo que já chegou não o
    dispara de novo. Sem esta escrita, um consumidor que monte depois de o
    store ter sido limpo ficaria esperando um evento que não vem.
  */
  it("assinar escreve a faixa que já está na publicação", () => {
    const assinar = criarAssinatura();
    faixasDeVideo.limpar();
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBeUndefined();

    assinar(CHAVE, true);
    expect(faixasDeVideo.getSnapshot(CHAVE)).toBe(faixaFalsa);
  });
});
