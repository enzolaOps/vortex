import { describe, expect, it } from "vitest";

import { agruparSistema, chaveDeFusao, type LinhaParaFundir } from "./agrupamentoDeSistema";
import type { SistemaSnapshot } from "./domain";

const entrou = (userId: string): SistemaSnapshot => ({ tipo: "entrou", userId });
const linha = (
  sistema: SistemaSnapshot | undefined,
  extra: { dia?: string; primeiraNaoLida?: boolean } = {},
): LinhaParaFundir => ({ sistema, dia: extra.dia, primeiraNaoLida: extra.primeiraNaoLida ?? false });

function de(mapa: Record<string, LinhaParaFundir>) {
  return (id: string) => mapa[id];
}

describe("agruparSistema", () => {
  it("sem nada a fundir devolve o MESMO array (nenhuma alocação no caso comum)", () => {
    const ids = ["a", "b"];
    const r = agruparSistema(ids, de({ a: linha(entrou("u1")), b: linha({ tipo: "saiu", userId: "u2" }) }));
    expect(r.visiveis).toBe(ids);
    expect(r.grupos.size).toBe(0);
  });

  it("entradas seguidas viram uma linha e carregam todas as pessoas", () => {
    const r = agruparSistema(
      ["a", "b", "c"],
      de({ a: linha(entrou("u1")), b: linha(entrou("u2")), c: linha(entrou("u3")) }),
    );
    expect(r.visiveis).toEqual(["a"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2", "u3"]);
  });

  it("uma mensagem de gente, um tipo diferente, um dia novo ou a primeira não lida quebram a fusão", () => {
    const r = agruparSistema(
      ["a", "b", "m", "c", "d", "e", "f"],
      de({
        a: linha(entrou("u1")),
        b: linha(entrou("u2")),
        m: linha(undefined),
        c: linha(entrou("u3")),
        d: linha({ tipo: "saiu", userId: "u4" }),
        e: linha({ tipo: "saiu", userId: "u5" }, { dia: "Hoje" }),
        f: linha({ tipo: "saiu", userId: "u6" }, { primeiraNaoLida: true }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "m", "c", "d", "e", "f"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2"]);
    expect(r.grupos.size).toBe(1);
  });

  it("fatos que não se fundem ficam cada um na sua linha", () => {
    const r = agruparSistema(
      ["a", "b"],
      de({
        a: linha({ tipo: "fixou", porId: "u1" }),
        b: linha({ tipo: "fixou", porId: "u1" }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "b"]);
  });

  it("adicionar/remover só funde quando quem fez é o mesmo", () => {
    const r = agruparSistema(
      ["a", "b", "c"],
      de({
        a: linha({ tipo: "adicionou", userId: "u1", porId: "x" }),
        b: linha({ tipo: "adicionou", userId: "u2", porId: "x" }),
        c: linha({ tipo: "adicionou", userId: "u3", porId: "y" }),
      }),
    );
    expect(r.visiveis).toEqual(["a", "c"]);
    expect(r.grupos.get("a")).toEqual(["u1", "u2"]);
  });

  it("reaproveita a referência do grupo que não mudou (a linha é memo)", () => {
    const ler = de({ a: linha(entrou("u1")), b: linha(entrou("u2")) });
    const primeira = agruparSistema(["a", "b"], ler);
    const segunda = agruparSistema(["a", "b"], ler, primeira.grupos);
    expect(segunda.grupos.get("a")).toBe(primeira.grupos.get("a"));
    const maior = agruparSistema(
      ["a", "b", "c"],
      de({ a: linha(entrou("u1")), b: linha(entrou("u2")), c: linha(entrou("u3")) }),
      primeira.grupos,
    );
    expect(maior.grupos.get("a")).not.toBe(primeira.grupos.get("a"));
  });

  it("mensagem ainda não resolvida quebra a fusão em vez de derrubá-la", () => {
    const r = agruparSistema(["a", "x", "b"], de({ a: linha(entrou("u1")), b: linha(entrou("u2")) }));
    expect(r.visiveis).toEqual(["a", "x", "b"]);
  });

  it("chaveDeFusao: só entradas, saídas, moderação e adições se fundem", () => {
    expect(chaveDeFusao(entrou("u"))).toBe("entrou");
    expect(chaveDeFusao({ tipo: "chamada", porId: "u", duracaoTexto: undefined })).toBeUndefined();
    expect(chaveDeFusao({ tipo: "desconhecido" })).toBeUndefined();
  });
});
