import { describe, expect, it } from "vitest";

import { escritasDePermissao, permissoesDoCanal } from "./canal";
import { client } from "./client";
import { inserirDepois } from "./servidores";

/**
 * Duplicar canal — as três peças que podem errar em silêncio.
 */

function semear(id: string, extra: object): void {
  client.channels.getOrCreate(id, {
    _id: id,
    channel_type: "TextChannel",
    server: "01JQSERVIDOR00000000000000",
    name: "liderança",
    ...extra,
  } as never);
}

describe("permissões do canal", () => {
  it("lê o padrão e cada cargo, em BigInt", () => {
    semear("01JQCANALRESTRITO000000000", {
      // ViewChannel negado para todo mundo; um cargo com bit 38 (MentionRoles)
      // — acima de 32, onde `number` com bitwise truncaria.
      default_permissions: { a: 0, d: 1 },
      role_permissions: {
        CARGO_A: { a: 2 ** 38 + 1, d: 0 },
        CARGO_ZERADO: { a: 0, d: 0 },
      },
    });
    expect(permissoesDoCanal("01JQCANALRESTRITO000000000")).toEqual({
      padrao: { allow: 0n, deny: 1n },
      porCargo: { CARGO_A: { allow: 2n ** 38n + 1n, deny: 0n } },
    });
  });

  it("canal sem override herda tudo — e isso é resposta, não falha", () => {
    semear("01JQCANALABERTO00000000000", {});
    expect(permissoesDoCanal("01JQCANALABERTO00000000000")).toEqual({
      padrao: undefined,
      porCargo: {},
    });
  });

  /*
    ⚠ O caso que a duplicação inteira protege: sem saber, não se cria nada.
  */
  it("canal fora do cache é `undefined`, e não 'sem restrição'", () => {
    expect(permissoesDoCanal("01JQNAOEXISTE0000000000000")).toBeUndefined();
  });
});

describe("ordem das escritas", () => {
  it("o padrão vem primeiro — é nele que mora o privado", () => {
    const escritas = escritasDePermissao({
      padrao: { allow: 0n, deny: 1n },
      porCargo: { A: { allow: 1n, deny: 0n }, B: { allow: 0n, deny: 4n } },
    });
    expect(escritas.map((e) => e.roleId)).toEqual([undefined, "A", "B"]);
  });

  it("sem padrão, só os cargos", () => {
    expect(
      escritasDePermissao({
        padrao: undefined,
        porCargo: { A: { allow: 1n, deny: 0n } },
      }).map((e) => e.roleId),
    ).toEqual(["A"]);
  });
});

describe("posição da cópia", () => {
  const categorias = [
    { id: "c1", title: "geral", channels: ["a", "b", "c"] },
    { id: "c2", title: "voz", channels: ["d"] },
  ];

  it("entra logo depois do original, na mesma categoria", () => {
    expect(inserirDepois(categorias, "b", "novo")).toEqual([
      { id: "c1", title: "geral", channels: ["a", "b", "novo", "c"] },
      { id: "c2", title: "voz", channels: ["d"] },
    ]);
  });

  it("não muta o que veio", () => {
    inserirDepois(categorias, "a", "novo");
    expect(categorias[0]!.channels).toEqual(["a", "b", "c"]);
  });
});
