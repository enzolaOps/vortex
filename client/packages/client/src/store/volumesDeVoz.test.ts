import { beforeEach, describe, expect, it, vi } from "vitest";

import { alternarSurdoNoStore, definirChamada, lerChamada } from "./chamada";
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
/** Nunca tocada por nenhum teste: é a "faixa que chega depois". */
const RECEM_CHEGADA = "01JQPESSOA000000000000002";

beforeEach(() => {
  limparVolumes();
  if (estaSilenciado(PESSOA)) alternarSilencioDe(PESSOA);
  if (estaSilenciado(RECEM_CHEGADA)) alternarSilencioDe(RECEM_CHEGADA);
  definirChamada({ surdo: false, mudo: false });
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

  /**
   * ⚠ **O defeito que estes três casos guardam é de ALCANCE, não de valor.**
   *
   * `alternarSurdo` varria `querySelectorAll("audio")`, ou seja só os elementos
   * que existiam naquele instante. Como `TrackSubscribed` aplica
   * `volumeEfetivo` a toda faixa recém-assinada, é aqui — e só aqui — que o
   * surdo alcança quem chega depois: quem entra na sala já ensurdecido, e o
   * áudio da tela de alguém cuja transmissão você abre já ensurdecido.
   */
  describe("surdo", () => {
    it("vale para faixa que chega depois, de alguém nunca visto", () => {
      expect(volumeEfetivo(RECEM_CHEGADA)).toBe(1);
      alternarSurdoNoStore();
      expect(lerChamada().surdo).toBe(true);
      // Ninguém mexeu nesta pessoa; o ganho aplicado na assinatura já é 0.
      expect(volumeEfetivo(RECEM_CHEGADA)).toBe(0);
    });

    it("desensurdecer devolve o volume guardado de cada pessoa", () => {
      definirVolume(PESSOA, 40);
      alternarSurdoNoStore();
      expect(volumeEfetivo(PESSOA)).toBe(0);
      expect(lerVolume(PESSOA)).toBe(40);
      alternarSurdoNoStore();
      expect(volumeEfetivo(PESSOA)).toBe(0.4);
    });

    it("quem está silenciado só para mim continua em 0 depois de desensurdecer", () => {
      definirVolume(PESSOA, 70);
      alternarSilencioDe(PESSOA);
      alternarSurdoNoStore();
      expect(volumeEfetivo(PESSOA)).toBe(0);
      alternarSurdoNoStore();
      expect(lerChamada().surdo).toBe(false);
      // O eixo por pessoa sobreviveu ao eixo global.
      expect(volumeEfetivo(PESSOA)).toBe(0);
      expect(volumeEfetivo(RECEM_CHEGADA)).toBe(1);
    });
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
