import { beforeEach, describe, expect, it, vi } from "vitest";

import { alternarSilencioDe, estaSilenciado } from "./sobrePessoas";
import {
  assinarVolume,
  assinarVolumeEfetivo,
  definirVolume,
  lerVolume,
  limparVolumes,
  VOLUME_MAXIMO,
  VOLUME_PADRAO,
  volumeEfetivo,
} from "./volumesDeVoz";

const PESSOA = "01JQPESSOA000000000000001";

beforeEach(() => {
  limparVolumes();
  if (estaSilenciado(PESSOA)) alternarSilencioDe(PESSOA);
});

describe("volume individual", () => {
  it("começa no padrão e grava dentro dos limites", () => {
    expect(lerVolume(PESSOA)).toBe(VOLUME_PADRAO);
    definirVolume(PESSOA, 250);
    expect(lerVolume(PESSOA)).toBe(VOLUME_MAXIMO);
    definirVolume(PESSOA, -5);
    expect(lerVolume(PESSOA)).toBe(0);
    definirVolume(PESSOA, 42.6);
    expect(lerVolume(PESSOA)).toBe(43);
  });

  it("persiste por usuário e não guarda o padrão", () => {
    definirVolume(PESSOA, 40);
    expect(JSON.parse(localStorage.getItem("vortex:volumes-de-voz") ?? "{}"))
      .toEqual({ [PESSOA]: 40 });
    definirVolume(PESSOA, VOLUME_PADRAO);
    expect(JSON.parse(localStorage.getItem("vortex:volumes-de-voz") ?? "{}"))
      .toEqual({});
  });

  it("avisa só quem assina aquela pessoa, e só quando muda", () => {
    const dela = vi.fn();
    const outra = vi.fn();
    const pararDela = assinarVolume(PESSOA, dela);
    const pararOutra = assinarVolume("outra", outra);
    definirVolume(PESSOA, 30);
    definirVolume(PESSOA, 30);
    expect(dela).toHaveBeenCalledTimes(1);
    expect(outra).not.toHaveBeenCalled();
    pararDela();
    pararOutra();
  });
});

describe("volume efetivo", () => {
  it("silenciar ganha do volume, e dessilenciar devolve o ajuste", () => {
    definirVolume(PESSOA, 60);
    expect(volumeEfetivo(PESSOA)).toBe(0.6);
    alternarSilencioDe(PESSOA);
    expect(volumeEfetivo(PESSOA)).toBe(0);
    expect(lerVolume(PESSOA)).toBe(60);
    alternarSilencioDe(PESSOA);
    expect(volumeEfetivo(PESSOA)).toBe(0.6);
  });

  it("o motor ouve os dois eixos, com o ID de quem mudou", () => {
    const motor = vi.fn();
    const parar = assinarVolumeEfetivo(motor);
    definirVolume(PESSOA, 20);
    alternarSilencioDe(PESSOA);
    expect(motor.mock.calls).toEqual([[PESSOA], [PESSOA]]);
    parar();
    definirVolume(PESSOA, 90);
    expect(motor).toHaveBeenCalledTimes(2);
  });
});
