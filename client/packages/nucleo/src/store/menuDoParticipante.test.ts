import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  alvoDoEvento,
  assinarMenuDoParticipante,
  definirAlvoDoParticipante,
  lerAlvoDoParticipante,
} from "./menuDoParticipante";

const SALA = "01JQSALA00000000000000001";

beforeEach(() => {
  definirAlvoDoParticipante(null);
  document.body.innerHTML = "";
});

describe("alvo do menu do participante", () => {
  it("resolve a pessoa pelo `data-participante` mais próximo", () => {
    document.body.innerHTML =
      '<div data-participante="ana"><span><b id="dentro">Ana</b></span></div>' +
      '<p id="fora">vão</p>';
    expect(alvoDoEvento(document.getElementById("dentro"), SALA)).toEqual({
      userId: "ana",
      channelId: SALA,
    });
    /* Fora de um participante não há alvo — é o que faz o menu NÃO abrir. */
    expect(alvoDoEvento(document.getElementById("fora"), SALA)).toBeNull();
  });

  it("sem sala não há alvo, mesmo sobre um participante", () => {
    document.body.innerHTML = '<div data-participante="ana" id="a"></div>';
    expect(alvoDoEvento(document.getElementById("a"), "")).toBeNull();
  });

  it("compara por campo: o mesmo alvo montado de novo não republica", () => {
    const ouvinte = vi.fn();
    const parar = assinarMenuDoParticipante(ouvinte);
    definirAlvoDoParticipante({ userId: "ana", channelId: SALA });
    definirAlvoDoParticipante({ userId: "ana", channelId: SALA });
    expect(ouvinte).toHaveBeenCalledTimes(1);
    definirAlvoDoParticipante({ userId: "bia", channelId: SALA });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(lerAlvoDoParticipante()?.userId).toBe("bia");
    parar();
  });
});
