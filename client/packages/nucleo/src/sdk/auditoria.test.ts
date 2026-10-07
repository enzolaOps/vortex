import { decodeTime } from "ulid";
import { describe, expect, it } from "vitest";

import {
  alvoDaAcao,
  cargosMudados,
  fraseDaAcao,
  idDeInstante,
} from "./auditoria";

/* Dois cargos com ULID de verdade — nome resolvido pelo mapa, como no app. */
const DESIGN = "01J0000000000000000DESIGN";
const NUCLEO = "01J0000000000000000NUCLEO";
const nomeDoCargo = (id: string) =>
  id === DESIGN ? "Design" : id === NUCLEO ? "Núcleo" : id;

describe("alvoDaAcao", () => {
  it("lê o `user` das variantes que o carregam", () => {
    expect(alvoDaAcao({ type: "BanCreate", user: "u1" })).toBe("u1");
    expect(alvoDaAcao({ type: "MemberKick", user: "u2" })).toBe("u2");
  });

  it("devolve ausência quando a ação não é sobre ninguém", () => {
    expect(alvoDaAcao({ type: "ChannelCreate", channel: "c1", name: "geral" })).toBe(
      undefined,
    );
  });
});

describe("cargosMudados", () => {
  it("diz o que entrou e o que saiu, por nome", () => {
    const r = cargosMudados(
      {
        type: "MemberEdit",
        user: "u1",
        before: { roles: [NUCLEO] },
        after: { roles: [NUCLEO, DESIGN] },
      },
      nomeDoCargo,
    );
    expect(r).toEqual({ dados: ["Design"], tirados: [] });
  });

  it("cargo que o cliente não conhece cai no ID, e não some", () => {
    const r = cargosMudados(
      { type: "MemberEdit", before: { roles: [] }, after: { roles: ["01DESCONHECIDO"] } },
      nomeDoCargo,
    );
    expect(r).toEqual({ dados: ["01DESCONHECIDO"], tirados: [] });
  });

  /* ⚠ Apelido e castigo também são `MemberEdit`; "nenhum cargo mudou" não pode
     virar uma frase sobre cargo. */
  it("devolve ausência quando a edição não tocou em cargos", () => {
    expect(
      cargosMudados(
        { type: "MemberEdit", before: { nickname: "a" }, after: { nickname: "b" } },
        nomeDoCargo,
      ),
    ).toBe(undefined);
  });

  it("devolve ausência quando a lista veio igual", () => {
    expect(
      cargosMudados(
        { type: "MemberEdit", before: { roles: [DESIGN] }, after: { roles: [DESIGN] } },
        nomeDoCargo,
      ),
    ).toBe(undefined);
  });
});

describe("fraseDaAcao", () => {
  it("nomeia o cargo atribuído — D-LAC-18", () => {
    expect(
      fraseDaAcao(
        {
          type: "MemberEdit",
          user: "u1",
          before: { roles: [] },
          after: { roles: [DESIGN] },
        },
        nomeDoCargo,
      ),
    ).toBe("atribuiu Design");
  });

  it("junta atribuído e removido numa frase só", () => {
    expect(
      fraseDaAcao(
        {
          type: "MemberEdit",
          before: { roles: [NUCLEO] },
          after: { roles: [DESIGN] },
        },
        nomeDoCargo,
      ),
    ).toBe("atribuiu Design e removeu Núcleo");
  });

  it("`MemberEdit` sem cargo volta à frase genérica", () => {
    expect(
      fraseDaAcao(
        { type: "MemberEdit", before: { nickname: "a" }, after: { nickname: "b" } },
        nomeDoCargo,
      ),
    ).toBe("editou um membro");
  });

  it("ação que este cliente não traduz continua aparecendo", () => {
    expect(fraseDaAcao({ type: "AlgoNovoDoServidor" }, nomeDoCargo)).toBe(
      "fez algo que este cliente ainda não traduz",
    );
  });
});

describe("idDeInstante", () => {
  it("tem 26 caracteres, que é o que a rota valida", () => {
    expect(idDeInstante(Date.now())).toHaveLength(26);
  });

  it("carrega o instante pedido", () => {
    const ms = Date.UTC(2025, 4, 17, 12, 0, 0);
    expect(decodeTime(idDeInstante(ms))).toBe(ms);
  });

  /* ⚠ A rota filtra com `_id > x` comparando STRING. Sem ordem lexicográfica
     preservada, "últimos 90 dias" traria a janela errada. */
  it("é um piso: ordena como o tempo ordena", () => {
    const antes = idDeInstante(Date.UTC(2025, 0, 1));
    const depois = idDeInstante(Date.UTC(2025, 6, 1));
    expect(antes < depois).toBe(true);
  });
});
