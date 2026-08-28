import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { criarNotificadorDeDigitacao } from "./digitando";

const CANAL = "c1";

function arnes() {
  const iniciar = vi.fn();
  const parar = vi.fn();
  const notificador = criarNotificadorDeDigitacao({
    iniciar,
    parar,
    intervaloMs: 3_000,
    silencioMs: 6_000,
  });
  return { iniciar, parar, notificador };
}

describe("notificador de digitação", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uma rajada de teclas vira UM anúncio", () => {
    const { iniciar, notificador } = arnes();

    // ~7 teclas por segundo durante 2s: o regime normal de quem digita.
    for (let i = 0; i < 14; i++) {
      notificador.aoDigitar(CANAL);
      vi.advanceTimersByTime(140);
    }

    expect(iniciar).toHaveBeenCalledTimes(1);
  });

  it("passado o intervalo, anuncia de novo", () => {
    const { iniciar, notificador } = arnes();

    notificador.aoDigitar(CANAL);
    vi.advanceTimersByTime(3_100);
    notificador.aoDigitar(CANAL);

    // Reanunciar existe porque o "parou" pode se perder no caminho: o
    // indicador do outro lado expira sozinho se ninguém renovar.
    expect(iniciar).toHaveBeenCalledTimes(2);
  });

  it("silêncio prolongado manda parar sem ninguém pedir", () => {
    const { parar, notificador } = arnes();

    notificador.aoDigitar(CANAL);
    vi.advanceTimersByTime(5_900);
    expect(parar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);
    // Sem isto, quem abandona uma frase no meio fica digitando para sempre na
    // tela dos outros.
    expect(parar).toHaveBeenCalledWith(CANAL);
  });

  it("o relógio do silêncio reinicia a cada tecla", () => {
    const { parar, notificador } = arnes();

    for (let i = 0; i < 10; i++) {
      notificador.aoDigitar(CANAL);
      vi.advanceTimersByTime(5_000);
    }

    expect(parar).not.toHaveBeenCalled();
  });

  it("enviar para na hora, sem esperar o silêncio", () => {
    const { parar, notificador } = arnes();

    notificador.aoDigitar(CANAL);
    notificador.aoParar(CANAL);

    expect(parar).toHaveBeenCalledTimes(1);
  });

  it("parar sem nunca ter digitado não fala com a rede", () => {
    const { parar, notificador } = arnes();

    notificador.aoParar(CANAL);
    notificador.aoParar(CANAL);

    // Focar e desfocar o campo sem escrever nada é o caso mais comum de todos.
    expect(parar).not.toHaveBeenCalled();
  });

  it("depois de parar, a próxima tecla anuncia de novo na hora", () => {
    const { iniciar, notificador } = arnes();

    notificador.aoDigitar(CANAL);
    notificador.aoParar(CANAL);
    notificador.aoDigitar(CANAL);

    // Sem zerar o relógio no `parar`, quem envia e volta a escrever fica até
    // 3s sem aparecer como digitando.
    expect(iniciar).toHaveBeenCalledTimes(2);
  });

  it("canais são independentes", () => {
    const { iniciar, parar, notificador } = arnes();

    notificador.aoDigitar("a");
    notificador.aoDigitar("b");
    notificador.aoParar("a");

    expect(iniciar).toHaveBeenCalledTimes(2);
    expect(parar).toHaveBeenCalledTimes(1);
    expect(parar).toHaveBeenCalledWith("a");
  });
});
