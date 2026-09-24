import { describe, expect, it } from "vitest";

import { iconesDoParticipante } from "../canais/iconesDeVoz";
import {
  capacidadeDaChamada,
  chipDaConexao,
  contagemDaChamada,
  estadoDaPlaca,
  estadoNaChamada,
  HISTERESE_MS,
  ORADOR_INICIAL,
  proximoOrador,
  repartirGrade,
  rotuloNaLista,
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

describe("estadoNaChamada", () => {
  const chamada = {
    participantes: ["eu", "ana", "bia"],
    camera: false,
    comCamera: ["ana"],
    tela: true,
    transmitindo: ["bia"],
    mudo: false,
    mudos: ["ana"],
    surdo: false,
  } as const;
  const sala = [
    { userId: "bia", surdo: true, mudoPeloServidor: true, surdoPeloServidor: false },
    { userId: "eu", surdo: false, mudoPeloServidor: false, surdoPeloServidor: true },
  ];

  it("o mudo de OUTRA pessoa aparece — o bug da lista lateral (D-DVM-15)", () => {
    expect(estadoNaChamada(chamada, sala, "ana").mudo).toBe(true);
    expect(estadoNaChamada(chamada, sala, "bia").mudo).toBe(false);
  });

  it("o seu estado vem de Chamada, nunca das listas", () => {
    const eu = estadoNaChamada({ ...chamada, mudo: true, mudos: [] }, sala, "eu");
    expect(eu).toMatchObject({ eu: true, mudo: true, transmitindo: true, camera: false });
  });

  it("o surdo dos outros e o imposto pelo servidor vêm do protocolo", () => {
    expect(estadoNaChamada(chamada, sala, "bia")).toMatchObject({
      surdo: true,
      mudoPeloServidor: true,
      transmitindo: true,
    });
    expect(estadoNaChamada(chamada, sala, "eu").surdoPeloServidor).toBe(true);
  });
});

describe("rotuloNaLista", () => {
  const nada = {
    eu: false,
    camera: false,
    transmitindo: false,
    mudo: false,
    surdo: false,
    mudoPeloServidor: false,
    surdoPeloServidor: false,
  };

  it("uma palavra por estado, na cor do design", () => {
    expect(rotuloNaLista(nada, true)).toMatchObject({ texto: "falando", tom: "falando" });
    expect(rotuloNaLista({ ...nada, mudo: true }, false)).toMatchObject({
      texto: "mudo",
      tom: "mudo",
    });
    expect(rotuloNaLista({ ...nada, transmitindo: true }, false)).toMatchObject({
      texto: "compartilhando tela",
      tom: "tela",
    });
    expect(rotuloNaLista({ ...nada, camera: true }, false).texto).toBe("vídeo ligado");
  });

  it("ensurdecido esmaece e ganha de mudo", () => {
    expect(rotuloNaLista({ ...nada, mudo: true, surdo: true }, false)).toEqual({
      texto: "ensurdecido",
      tom: "neutro",
      esmaecido: true,
    });
  });

  it("falar ganha de mostrar, e sem estado não há segunda linha", () => {
    expect(rotuloNaLista({ ...nada, transmitindo: true }, true).texto).toBe("falando");
    expect(rotuloNaLista(nada, false).texto).toBeUndefined();
  });
});

describe("repartirGrade", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `p${String(i)}`);

  it("até 16 é tudo ladrilho", () => {
    const r = repartirGrade(ids.slice(0, 16), undefined);
    expect(r.ladrilhos).toHaveLength(16);
    expect(r.fila).toEqual([]);
  });

  it("acima de 16, os últimos viram fila (D-VOZ-26)", () => {
    const r = repartirGrade(ids, undefined);
    expect(r.ladrilhos).toEqual(ids.slice(0, 16));
    expect(r.fila).toEqual(["p16", "p17", "p18", "p19"]);
  });

  it("quem está em destaque nunca fica na fila", () => {
    const r = repartirGrade(ids, "p18");
    expect(r.ladrilhos).toContain("p18");
    expect(r.ladrilhos).toHaveLength(16);
    expect(r.fila).toEqual(["p16", "p17", "p15", "p19"]);
  });
});

describe("proximoOrador", () => {
  const sala = ["a", "b", "c"];

  it("sem orador, o primeiro a falar assume na hora", () => {
    expect(proximoOrador(ORADOR_INICIAL, ["b"], sala, 0).estado.orador).toBe("b");
  });

  it("uma célula só: com dois falando, o orador fica", () => {
    const r = proximoOrador({ orador: "a", caladoDesde: undefined }, ["a", "b"], sala, 0);
    expect(r.estado.orador).toBe("a");
  });

  it("o orador calado só sai depois de 1,2 s E se outro fala (D-VOZ-27)", () => {
    let r = proximoOrador({ orador: "a", caladoDesde: undefined }, ["b"], sala, 1000);
    expect(r.estado).toEqual({ orador: "a", caladoDesde: 1000 });
    expect(r.revisarEm).toBe(HISTERESE_MS);

    r = proximoOrador(r.estado, ["b"], sala, 1000 + HISTERESE_MS - 1);
    expect(r.estado.orador).toBe("a");
    expect(r.revisarEm).toBe(1);

    r = proximoOrador(r.estado, ["b"], sala, 1000 + HISTERESE_MS);
    expect(r.estado.orador).toBe("b");
  });

  it("sala em silêncio mantém quem falou por último", () => {
    const r = proximoOrador({ orador: "a", caladoDesde: 0 }, [], sala, 60_000);
    expect(r.estado.orador).toBe("a");
    expect(r.revisarEm).toBeUndefined();
  });

  it("voltar a falar zera a contagem", () => {
    const r = proximoOrador({ orador: "a", caladoDesde: 0 }, ["a", "b"], sala, 900);
    expect(r.estado).toEqual({ orador: "a", caladoDesde: undefined });
  });

  it("orador que saiu é trocado na hora", () => {
    const r = proximoOrador({ orador: "z", caladoDesde: undefined }, ["c"], sala, 0);
    expect(r.estado.orador).toBe("c");
  });
});
