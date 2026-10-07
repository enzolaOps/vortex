import { describe, expect, it } from "vitest";

import { escolherFoco, type PessoaParaFoco } from "./foco";

const p = (id: string, extra: Partial<PessoaParaFoco> = {}): PessoaParaFoco => ({
  id,
  transmitindo: false,
  camera: false,
  ...extra,
});

describe("o foco do PiP", () => {
  it("transmissão de outra pessoa ganha de quem fala", () => {
    const pessoas = [p("A"), p("B", { transmitindo: true }), p("C")];
    expect(escolherFoco(pessoas, ["C"], "A")).toEqual({ tipo: "tela", userId: "B" });
  });

  it("a própria transmissão só vale quando é a única", () => {
    const pessoas = [p("A", { transmitindo: true }), p("B", { transmitindo: true })];
    expect(escolherFoco(pessoas, [], "A")).toEqual({ tipo: "tela", userId: "B" });
    expect(escolherFoco([p("A", { transmitindo: true }), p("B")], [], "A")).toEqual({ tipo: "tela", userId: "A" });
  });

  it("sem transmissão, quem fala — com câmera quando ela está ligada", () => {
    const pessoas = [p("A"), p("B", { camera: true })];
    expect(escolherFoco(pessoas, ["B"], "A")).toEqual({ tipo: "pessoa", userId: "B", comCamera: true });
    expect(escolherFoco(pessoas, ["A"], "A")).toEqual({ tipo: "pessoa", userId: "A", comCamera: false });
  });

  it("falante que já saiu da sala não vira foco", () => {
    expect(escolherFoco([p("A")], ["fantasma"], "A")).toBeUndefined();
  });

  it("ninguém falando e ninguém transmitindo: sem foco", () => {
    expect(escolherFoco([p("A"), p("B")], [], "A")).toBeUndefined();
  });
});
