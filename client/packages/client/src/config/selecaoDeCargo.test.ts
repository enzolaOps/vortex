import { describe, expect, it } from "vitest";

import type { Alcance, PessoaParaCargo } from "../sdk/cargos";
import {
  cargoAoAlcance,
  filtrarPessoas,
  marcavel,
  selecaoValida,
  separarParaCargo,
} from "./selecaoDeCargo";

const CARGO = "01CARGO";

function pessoa(p: Partial<PessoaParaCargo> & { id: string }): PessoaParaCargo {
  return {
    nome: p.id,
    username: p.id,
    cargosIds: [],
    editavel: true,
    ...p,
  };
}

const alcance = (a: Partial<Alcance> = {}): Alcance => ({
  topo: 2,
  podeAtribuir: true,
  podeEditarCargos: true,
  podeEditarPermissoes: true,
  ...a,
});

const GENTE = [
  pessoa({ id: "u1", nome: "João Pedro", username: "jp", cargosIds: [CARGO] }),
  pessoa({ id: "u2", nome: "ana", username: "ana.r", cargosIds: [CARGO, "outro"] }),
  pessoa({ id: "u3", nome: "Bia", username: "bia" }),
  pessoa({ id: "u4", nome: "Álvaro", username: "alv", cargosIds: ["outro"] }),
];

describe("filtrarPessoas", () => {
  it("separa quem tem o cargo de quem não tem", () => {
    const com = filtrarPessoas(GENTE, { roleId: CARGO, comCargo: true, termo: "" });
    const sem = filtrarPessoas(GENTE, { roleId: CARGO, comCargo: false, termo: "" });
    expect(com.visiveis.map((p) => p.id)).toEqual(["u2", "u1"]);
    expect(sem.visiveis.map((p) => p.id)).toEqual(["u4", "u3"]);
  });

  it("ordena por nome com colação pt-BR, maiúscula e acento incluídos", () => {
    const todos = filtrarPessoas(
      GENTE.map((p) => ({ ...p, cargosIds: [] })),
      { roleId: CARGO, comCargo: false, termo: "" },
    );
    expect(todos.visiveis.map((p) => p.nome)).toEqual(["Álvaro", "ana", "Bia", "João Pedro"]);
  });

  it("busca sem acento acha nome com acento", () => {
    const r = filtrarPessoas(GENTE, { roleId: CARGO, comCargo: true, termo: "joao" });
    expect(r.visiveis.map((p) => p.id)).toEqual(["u1"]);
  });

  it("busca por username e por ID", () => {
    expect(
      filtrarPessoas(GENTE, { roleId: CARGO, comCargo: true, termo: "ANA.R" }).visiveis,
    ).toHaveLength(1);
    expect(
      filtrarPessoas(GENTE, { roleId: CARGO, comCargo: false, termo: "u3" }).visiveis[0]?.id,
    ).toBe("u3");
  });

  it("corta no teto mas conta todas as que casaram", () => {
    const muitas = Array.from({ length: 12 }, (_, i) =>
      pessoa({ id: `p${String(i).padStart(2, "0")}` }),
    );
    const r = filtrarPessoas(muitas, { roleId: CARGO, comCargo: false, termo: "", limite: 5 });
    expect(r.visiveis).toHaveLength(5);
    expect(r.total).toBe(12);
  });
});

describe("hierarquia", () => {
  it("cargo acima ou no mesmo nível do meu topo não está ao alcance", () => {
    expect(cargoAoAlcance(3, alcance({ topo: 2 }))).toBe(true);
    expect(cargoAoAlcance(2, alcance({ topo: 2 }))).toBe(false);
    expect(cargoAoAlcance(1, alcance({ topo: 2 }))).toBe(false);
  });

  it("dono (topo -Infinity) alcança o cargo de rank 0", () => {
    expect(cargoAoAlcance(0, alcance({ topo: -Infinity }))).toBe(true);
  });

  it("sem AssignRoles nada está ao alcance, nem abaixo", () => {
    expect(cargoAoAlcance(9, alcance({ podeAtribuir: false }))).toBe(false);
  });

  it("pessoa acima de mim não é marcável mesmo com o cargo ao alcance", () => {
    expect(marcavel(pessoa({ id: "x", editavel: false }), 9, alcance())).toBe(false);
    expect(marcavel(pessoa({ id: "x" }), 9, alcance())).toBe(true);
  });
});

describe("selecaoValida", () => {
  it("descarta quem saiu da vista ou deixou de ser marcável", () => {
    const visiveis = [
      pessoa({ id: "a" }),
      pessoa({ id: "b", editavel: false }),
      pessoa({ id: "c" }),
    ];
    const r = selecaoValida(new Set(["a", "b", "fora"]), visiveis, 9, alcance());
    expect(r).toEqual(["a"]);
  });
});

describe("separarParaCargo", () => {
  it("quem está acima ou sumiu vira falha escrita, na ordem da seleção", () => {
    const gente = [
      pessoa({ id: "a" }),
      pessoa({ id: "chefe", editavel: false }),
      pessoa({ id: "b" }),
    ];
    const r = separarParaCargo(["chefe", "a", "sumiu", "b"], gente, 5, alcance());
    expect(r.editaveis).toEqual(["a", "b"]);
    expect(r.barradas).toEqual([
      { item: "chefe", motivo: "Acima da sua hierarquia." },
      { item: "sumiu", motivo: "Essa pessoa não está mais no servidor." },
    ]);
  });

  it("cargo no mesmo nível do meu barra todo mundo", () => {
    const r = separarParaCargo(["a"], [pessoa({ id: "a" })], 2, alcance({ topo: 2 }));
    expect(r.editaveis).toEqual([]);
    expect(r.barradas.map((b) => b.item)).toEqual(["a"]);
  });
});
