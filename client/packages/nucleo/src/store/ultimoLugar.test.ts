import { beforeEach, describe, expect, it } from "vitest";

import { canaisDeTexto, canaisDeVoz } from "../sdk/adapter";
import { lerCanalAtivo, lerServidorAtivo } from "./navegacao";
import { lerCantoDaSala, fixarSalaNoCanto, limparPreferenciasDaSala } from "./preferenciasDaSala";
import {
  abrirServidor,
  abrirTexto,
  escolherSala,
  lembrarSala,
  lerUltimoLugar,
  lerUltimoServidor,
  limparUltimoLugar,
} from "./ultimoLugar";

beforeEach(() => {
  limparUltimoLugar();
  limparPreferenciasDaSala();
  canaisDeTexto.set("S1", ["geral", "avisos"]);
  canaisDeVoz.set("S1", ["sala-a", "sala-b"]);
});

describe("último lugar por servidor", () => {
  it("abre o primeiro canal de texto quando nada foi lembrado", () => {
    abrirServidor("S1");
    expect(lerServidorAtivo()).toBe("S1");
    expect(lerCanalAtivo()).toBe("geral");
    expect(lerUltimoServidor()).toBe("S1");
  });

  it("volta ao último canal de texto lembrado", () => {
    abrirTexto("S1", "avisos");
    abrirServidor("S1");
    expect(lerCanalAtivo()).toBe("avisos");
  });

  it("ignora o canal lembrado que deixou de existir", () => {
    abrirTexto("S1", "avisos");
    canaisDeTexto.set("S1", ["geral"]);
    abrirServidor("S1");
    expect(lerCanalAtivo()).toBe("geral");
  });

  it("lembra a sala do widget e cai na primeira se ela sumiu", () => {
    expect(escolherSala("S1")).toBe("sala-a");
    lembrarSala("S1", "sala-b");
    expect(escolherSala("S1")).toBe("sala-b");
    canaisDeVoz.set("S1", ["sala-a"]);
    expect(escolherSala("S1")).toBe("sala-a");
    expect(lerUltimoLugar("S1").sala).toBe("sala-b");
  });

  it("sobrevive a recarregar: o que foi lembrado está no armazenamento", () => {
    lembrarSala("S1", "sala-b");
    expect(JSON.parse(localStorage.getItem("vortex:ultimo-lugar") ?? "{}")).toMatchObject({
      servidor: "S1",
      lugares: { S1: { sala: "sala-b" } },
    });
  });
});

describe("canto do widget", () => {
  it("é persistido e começa no canto de baixo à direita", () => {
    expect(lerCantoDaSala()).toBe("br");
    fixarSalaNoCanto("tl");
    expect(lerCantoDaSala()).toBe("tl");
    expect(localStorage.getItem("vortex:preferencias-da-sala")).toContain('"tl"');
  });
});
