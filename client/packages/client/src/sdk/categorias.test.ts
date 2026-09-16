import { describe, expect, it } from "vitest";

import { bitDaPermissao } from "./cargos";
import {
  conjuntoPrivado,
  divergencias,
  temSobreposicoes,
  type ConjuntoDeSobreposicoes,
} from "./categorias";

/**
 * A comparação que decide o banner "dessincronizado".
 *
 * Ela precisa concordar com a do SERVIDOR (`util/overrides.rs::normalize`):
 * sobreposição `{0, 0}` vale o mesmo que ausente. Se as duas divergirem, a tela
 * acusa "1 override próprio" num canal que o servidor considera sincronizado —
 * e sincronizar não apaga o aviso, porque não há nada a mudar.
 */

const NADA: ConjuntoDeSobreposicoes = { padrao: undefined, cargos: {} };

describe("divergencias", () => {
  it("conjuntos iguais não divergem", () => {
    const c = conjuntoPrivado(["mod"]);
    expect(divergencias(c, conjuntoPrivado(["mod"]))).toBe(0);
  });

  it("{0,0} vale o mesmo que ausente, no padrão e nos cargos", () => {
    expect(
      divergencias(
        { padrao: { allow: 0n, deny: 0n }, cargos: { mod: { allow: 0n, deny: 0n } } },
        NADA,
      ),
    ).toBe(0);
  });

  it("conta por ALVO: padrão diferente e um cargo a mais dão 2", () => {
    const categoria = conjuntoPrivado(["mod"]);
    const canal: ConjuntoDeSobreposicoes = {
      padrao: undefined,
      cargos: { mod: categoria.cargos["mod"]!, dev: { allow: 1n, deny: 0n } },
    };
    expect(divergencias(canal, categoria)).toBe(2);
  });

  it("mesmo allow com deny diferente diverge", () => {
    expect(
      divergencias(
        { padrao: undefined, cargos: { mod: { allow: 4n, deny: 1n } } },
        { padrao: undefined, cargos: { mod: { allow: 4n, deny: 0n } } },
      ),
    ).toBe(1);
  });
});

describe("conjuntoPrivado", () => {
  it("nega ver para @everyone e concede aos escolhidos", () => {
    const ver = bitDaPermissao("ViewChannel");
    const c = conjuntoPrivado(["a", "b"]);
    expect(c.padrao).toEqual({ allow: 0n, deny: ver });
    expect(c.cargos["a"]).toEqual({ allow: ver, deny: 0n });
    expect(Object.keys(c.cargos)).toEqual(["a", "b"]);
  });
});

describe("temSobreposicoes", () => {
  it("categoria sem nada, ou só com {0,0}, não tem o que herdar", () => {
    expect(temSobreposicoes(NADA)).toBe(false);
    expect(temSobreposicoes({ padrao: { allow: 0n, deny: 0n }, cargos: {} })).toBe(false);
    expect(temSobreposicoes(conjuntoPrivado([]))).toBe(true);
  });
});
