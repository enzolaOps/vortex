import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Assistindo } from "../store/espectadores";
import { criarAnuncioDeAssistir, type Medida } from "./anuncioDeAssistir";

function montar({ pode = true, cheia = false } = {}) {
  const escritas: string[] = [];
  const locais: (readonly Assistindo[])[] = [];
  const medidas = new Map<string, Medida>();
  const estado = { pode, cheia };
  const anuncio = criarAnuncioDeAssistir(
    {
      podeEscrever: () => estado.pode,
      escrever: (v) => {
        escritas.push(v);
        return Promise.resolve();
      },
      medir: (dono) => Promise.resolve(medidas.get(dono)),
      telaCheia: () => estado.cheia,
      aoEscrever: (l) => locais.push(l),
    },
    { intervaloDeEscrita: 1000, intervaloDeAmostra: 2000 },
  );
  return { anuncio, escritas, locais, medidas, estado };
}

/** Deixa as promessas de `medir` resolverem. */
async function drenar(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("anúncio do que se assiste", () => {
  it("assinar a tela escreve o anúncio com a altura que chega", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    expect(t.escritas).toEqual(["dono,1080,"]);
  });

  it("resolução cortada sem pedir sai como rede; pedida, não", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 720, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    expect(t.escritas.at(-1)).toBe("dono,720,r");

    t.anuncio.pediuMenos("dono", true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.escritas.at(-1)).toBe("dono,720,");
  });

  it("só áudio não é assistir", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: false, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    /* Nada a anunciar e nada escrito antes: o valor vazio é o de partida. */
    expect(t.escritas).toEqual([]);
    expect(t.locais.at(-1)).toEqual([]);
  });

  it("devolver a tela apaga o anúncio", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    t.anuncio.terminou("dono");
    await vi.advanceTimersByTimeAsync(1000);
    expect(t.escritas).toEqual(["dono,1080,", ""]);
  });

  /* Toda escrita é repassada à sala inteira: rede oscilando não pode virar
     uma mensagem por oscilação. */
  it("escreve no máximo uma vez por intervalo, e a última ganha", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();

    t.medidas.set("dono", { ativa: true, recebida: 720, publicada: 1080 });
    t.anuncio.reamostrar();
    await drenar();
    t.medidas.set("dono", { ativa: true, recebida: 480, publicada: 1080 });
    t.anuncio.reamostrar();
    await drenar();
    expect(t.escritas).toEqual(["dono,1080,"]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(t.escritas).toEqual(["dono,1080,", "dono,480,r"]);
  });

  it("valor igual ao escrito não é reescrito", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.escritas).toEqual(["dono,1080,"]);
  });

  it("amostra de novo sozinha e vê a tela cheia", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    t.estado.cheia = true;
    await vi.advanceTimersByTimeAsync(2000);
    expect(t.escritas.at(-1)).toBe("dono,1080,c");
  });

  /* Servidor sem o grant: escrever seria recusado. O estado local segue
     existindo, mas a sala não recebe nada. */
  it("sem permissão não escreve na sala", async () => {
    const t = montar({ pode: false });
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    expect(t.escritas).toEqual([]);
    expect(t.locais.at(-1)?.[0]?.dono).toBe("dono");
  });

  it("limpar para o amostrador e não escreve", async () => {
    const t = montar();
    t.medidas.set("dono", { ativa: true, recebida: 1080, publicada: 1080 });
    t.anuncio.comecou("dono");
    await drenar();
    t.anuncio.limpar();
    t.medidas.set("dono", { ativa: true, recebida: 720, publicada: 1080 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.escritas).toEqual(["dono,1080,"]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
