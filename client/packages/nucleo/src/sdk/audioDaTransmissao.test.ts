import { describe, expect, it, vi } from "vitest";

import { criarAudioDaTransmissao, type FaixaDeSomDaTela } from "./audioDaTransmissao";

/** Dublê de `RemoteAudioTrack`: registra a ordem e o que foi aplicado. */
function faixa() {
  const ordem: string[] = [];
  const f = {
    attachedElements: [] as HTMLMediaElement[],
    contexto: undefined as AudioContext | undefined,
    volume: undefined as number | undefined,
    ordem,
    attach() {
      ordem.push("attach");
      const el = document.createElement("audio");
      f.attachedElements.push(el);
      return el;
    },
    setAudioContext(c: AudioContext | undefined) {
      ordem.push("contexto");
      f.contexto = c;
    },
    setVolume(v: number) {
      /* O `<audio>` lança fora de [0, 1]; com contexto o ganho vai ao GainNode. */
      if (!f.contexto && v > 1) throw new DOMException("fora de [0, 1]", "IndexSizeError");
      f.volume = v;
    },
  };
  return f satisfies FaixaDeSomDaTela;
}

function espiao() {
  const setSinkId = vi.fn<(id: string) => Promise<void>>(() => Promise.resolve());
  const close = vi.fn(() => Promise.resolve());
  const ctx = { setSinkId, close } as unknown as AudioContext;
  return { ctx, setSinkId, close };
}

function contexto(): AudioContext {
  return espiao().ctx;
}

function montar(ganhos: Record<string, number>, criar: () => AudioContext | undefined = contexto) {
  const destino = document.createElement("div");
  const criarContexto = vi.fn(criar);
  const som = criarAudioDaTransmissao({
    criarContexto,
    destino: () => destino,
    ganho: (id) => ganhos[id] ?? 1,
  });
  return { som, destino, criarContexto };
}

describe("som da transmissão", () => {
  it("dá o contexto ANTES de anexar e aplica ganho acima de 100%", () => {
    const { som, destino } = montar({ ana: 3 });
    const f = faixa();
    som.receber("ana", f);
    expect(f.ordem).toEqual(["contexto", "attach"]);
    expect(f.contexto).toBeDefined();
    expect(destino.children).toHaveLength(1);
    expect(f.volume).toBe(3);
  });

  it("reaplica o volume guardado quando a faixa é re-assinada (faixa nova)", () => {
    const ganhos = { ana: 2.5 };
    const { som, criarContexto } = montar(ganhos);
    som.receber("ana", faixa());
    ganhos.ana = 0.4;
    const nova = faixa();
    som.receber("ana", nova);
    expect(nova.contexto).toBeDefined();
    expect(nova.volume).toBe(0.4);
    /* Um contexto por sala, não um por faixa. */
    expect(criarContexto).toHaveBeenCalledTimes(1);
  });

  it("depois de fechar (reconexão, outra sala), a faixa nova ganha contexto novo", () => {
    const { som, criarContexto } = montar({ ana: 2 });
    som.receber("ana", faixa());
    som.fechar();
    const nova = faixa();
    som.receber("ana", nova);
    expect(criarContexto).toHaveBeenCalledTimes(2);
    expect(nova.volume).toBe(2);
  });

  it("não anexa de novo a faixa que já toca, e aplica o ganho atual", () => {
    const ganhos = { ana: 1.5 };
    const { som, destino } = montar(ganhos);
    const f = faixa();
    som.receber("ana", f);
    ganhos.ana = 0;
    som.receber("ana", f);
    expect(destino.children).toHaveLength(1);
    expect(f.ordem.filter((o) => o === "contexto")).toHaveLength(1);
    expect(f.volume).toBe(0);
  });

  it("sem Web Audio o teto volta a 100% em vez de lançar", () => {
    const { som } = montar({ ana: 3 }, () => undefined);
    const f = faixa();
    expect(() => {
      som.receber("ana", f);
    }).not.toThrow();
    expect(f.volume).toBe(1);
  });

  it("leva a saída escolhida ao contexto; padrão vira string vazia", async () => {
    const { ctx, setSinkId, close } = espiao();
    const { som } = montar({ ana: 1 }, () => ctx);
    await som.trocarSaida("fone-usb");
    som.receber("ana", faixa());
    await vi.waitFor(() => {
      expect(setSinkId).toHaveBeenLastCalledWith("fone-usb");
    });
    await som.trocarSaida("default");
    expect(setSinkId).toHaveBeenLastCalledWith("");
    som.fechar();
    expect(close).toHaveBeenCalled();
  });
});
