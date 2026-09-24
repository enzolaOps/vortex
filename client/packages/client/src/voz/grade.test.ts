import { describe, expect, it } from "vitest";

import { iconesDoParticipante } from "../canais/iconesDeVoz";
import {
  capacidadeDaChamada,
  chipDaConexao,
  contagemDaChamada,
  estadoDaPlaca,
} from "./grade";

describe("capacidadeDaChamada", () => {
  it("no grupo de DM o total é quem faz parte do grupo", () => {
    expect(
      capacidadeDaChamada({ tipo: "grupo", participantes: 25, limite: undefined }),
    ).toBe(25);
  });

  it("no canal de servidor o total é o teto da sala", () => {
    expect(capacidadeDaChamada({ tipo: "voz", participantes: 0, limite: 8 })).toBe(8);
  });

  it("sala sem teto não tem denominador", () => {
    expect(
      capacidadeDaChamada({ tipo: "voz", participantes: 0, limite: undefined }),
    ).toBeUndefined();
    expect(capacidadeDaChamada(undefined)).toBeUndefined();
  });

  it("o `limite` de um grupo não vira denominador", () => {
    expect(capacidadeDaChamada({ tipo: "grupo", participantes: 0, limite: 8 })).toBe(
      undefined,
    );
  });
});

describe("contagemDaChamada", () => {
  it('"7 de 25 na chamada" (D-VOZ-25)', () => {
    expect(contagemDaChamada(7, 25)).toBe("7 de 25 na chamada");
  });

  it("sem total, só a contagem", () => {
    expect(contagemDaChamada(3, undefined)).toBe("3 na chamada");
  });

  it('todo mundo dentro não repete o número ("5 de 5")', () => {
    expect(contagemDaChamada(5, 5)).toBe("5 na chamada");
  });

  it('teto furado por quem modera não afirma "6 de 5"', () => {
    expect(contagemDaChamada(6, 5)).toBe("6 na chamada");
  });
});

describe("chipDaConexao", () => {
  it('"excelente" com RTT quando dentro e ótima (D-DVM-11)', () => {
    expect(chipDaConexao("dentro", "otima")).toEqual({
      texto: "excelente",
      tom: "bom",
      comRtt: true,
    });
  });

  it("reconectando ganha da qualidade e não mostra RTT", () => {
    expect(chipDaConexao("reconectando", "otima")).toEqual({
      texto: "reconectando…",
      tom: "perigo",
      comRtt: false,
    });
  });

  it("entrando não mostra RTT", () => {
    expect(chipDaConexao("conectando", "desconhecida").comRtt).toBe(false);
  });

  it("instável é aviso, não perigo", () => {
    expect(chipDaConexao("dentro", "ruim").tom).toBe("aviso");
    expect(chipDaConexao("dentro", "perdida").tom).toBe("perigo");
  });
});

describe("placa da grade (D-DVM-14, D-VOZ-29)", () => {
  const base = {
    transmitindo: false,
    camera: false,
    mudo: false,
    surdo: false,
    mudoPeloServidor: false,
    surdoPeloServidor: false,
  };

  it("ensurdecido aparece na placa", () => {
    const { visiveis } = iconesDoParticipante(estadoDaPlaca({ ...base, surdo: true }));
    expect(visiveis).toEqual(["surdo"]);
  });

  it("câmera aparece na placa", () => {
    const { visiveis } = iconesDoParticipante(estadoDaPlaca({ ...base, camera: true }));
    expect(visiveis).toEqual(["video"]);
  });

  it("a tela ganha da câmera, como no ladrilho", () => {
    expect(estadoDaPlaca({ ...base, camera: true, transmitindo: true }).estado).toBe(
      "tela",
    );
  });

  it("o que o servidor impôs aparece junto do que a pessoa escolheu", () => {
    const { visiveis } = iconesDoParticipante(
      estadoDaPlaca({ ...base, mudo: true, mudoPeloServidor: true, surdoPeloServidor: true }),
    );
    expect(visiveis).toEqual(["srvSurdo", "srvMudo", "mudo"]);
  });

  it("voz simples não pede ícone nenhum", () => {
    expect(iconesDoParticipante(estadoDaPlaca(base)).visiveis).toEqual([]);
  });
});
