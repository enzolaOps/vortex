import { beforeEach, describe, expect, it, vi } from "vitest";

import { definirChamada } from "./chamada";
import { alternarSilencioDe, estaSilenciado } from "./sobrePessoas";
import {
  assinarQualquerVolumeDaTransmissao,
  assinarVolumeDaTransmissao,
  definirVolumeDaTransmissao,
  lerVolumeDaTransmissao,
  limparVolumesDaTransmissao,
  VOLUME_DA_TRANSMISSAO_MAXIMO,
  VOLUME_DA_TRANSMISSAO_PADRAO,
  volumeEfetivoDaTransmissao,
} from "./volumesDeTransmissao";
import { definirVolume, lerVolume, limparVolumes } from "./volumesDeVoz";

const QUEM_TRANSMITE = "01JQPESSOA000000000000010";
const CHAVE = "vortex:volumes-de-transmissao";

beforeEach(() => {
  limparVolumesDaTransmissao();
  limparVolumes();
  localStorage.removeItem(CHAVE);
  if (estaSilenciado(QUEM_TRANSMITE)) alternarSilencioDe(QUEM_TRANSMITE);
  definirChamada({ surdo: false, mudo: false });
});

describe("volume da transmissão", () => {
  it("começa em 100% e vai de 0 a 300, nunca além", () => {
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(VOLUME_DA_TRANSMISSAO_PADRAO);
    expect(VOLUME_DA_TRANSMISSAO_MAXIMO).toBe(300);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 300);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(300);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 999);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(300);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 0);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(0);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, -20);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(0);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, Number.NaN);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(0);
  });

  it("o ganho efetivo passa de 1 — é o que o motor aplica acima de 100%", () => {
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 250);
    expect(volumeEfetivoDaTransmissao(QUEM_TRANSMITE)).toBe(2.5);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 300);
    expect(volumeEfetivoDaTransmissao(QUEM_TRANSMITE)).toBe(3);
  });

  it("é eixo separado do volume da pessoa", () => {
    definirVolume(QUEM_TRANSMITE, 40);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 200);
    expect(lerVolume(QUEM_TRANSMITE)).toBe(40);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(200);
  });

  it("ensurdecer e silenciar calam a transmissão sem apagar o ajuste", () => {
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 180);
    definirChamada({ surdo: true });
    expect(volumeEfetivoDaTransmissao(QUEM_TRANSMITE)).toBe(0);
    definirChamada({ surdo: false });
    expect(volumeEfetivoDaTransmissao(QUEM_TRANSMITE)).toBe(1.8);
    alternarSilencioDe(QUEM_TRANSMITE);
    expect(volumeEfetivoDaTransmissao(QUEM_TRANSMITE)).toBe(0);
    expect(lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(180);
  });

  it("persiste no dispositivo por pessoa e não guarda o padrão", async () => {
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 220);
    expect(JSON.parse(localStorage.getItem(CHAVE) ?? "{}")).toEqual({ [QUEM_TRANSMITE]: 220 });

    /* Um módulo novo é a aba recarregada: lê do armazenamento. */
    vi.resetModules();
    const recarregado = await import("./volumesDeTransmissao");
    expect(recarregado.lerVolumeDaTransmissao(QUEM_TRANSMITE)).toBe(220);

    definirVolumeDaTransmissao(QUEM_TRANSMITE, VOLUME_DA_TRANSMISSAO_PADRAO);
    expect(JSON.parse(localStorage.getItem(CHAVE) ?? "{}")).toEqual({});
  });

  it("descarta o que foi guardado com forma errada e limita o resto", async () => {
    localStorage.setItem(CHAVE, JSON.stringify({ a: "200", b: 9000, c: 50 }));
    vi.resetModules();
    const m = await import("./volumesDeTransmissao");
    expect(m.lerVolumeDaTransmissao("a")).toBe(VOLUME_DA_TRANSMISSAO_PADRAO);
    expect(m.lerVolumeDaTransmissao("b")).toBe(300);
    expect(m.lerVolumeDaTransmissao("c")).toBe(50);
  });

  it("avisa quem assina aquela transmissão e o motor, só quando muda", () => {
    const dela = vi.fn();
    const motor = vi.fn();
    const pararDela = assinarVolumeDaTransmissao(QUEM_TRANSMITE, dela);
    const pararMotor = assinarQualquerVolumeDaTransmissao(motor);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 150);
    definirVolumeDaTransmissao(QUEM_TRANSMITE, 150);
    expect(dela).toHaveBeenCalledTimes(1);
    expect(motor).toHaveBeenCalledWith(QUEM_TRANSMITE);
    expect(motor).toHaveBeenCalledTimes(1);
    pararDela();
    pararMotor();
  });
});
