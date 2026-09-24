import { describe, expect, it } from "vitest";

import { bitDaPermissao } from "./cargos";
import {
  ALVO_PADRAO,
  conjuntoPrivado,
  descreverOverride,
  diferencasDoCanal,
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

describe("diferencasDoCanal — o que \"Ver diferença\" mostra", () => {
  const ver = bitDaPermissao("ViewChannel");
  const enviar = bitDaPermissao("SendMessage");
  const nome = (id: string) => ({ mod: "Moderação", dev: "Dev" })[id] ?? id;

  it("uma linha por ALVO que diverge — o mesmo número do banner", () => {
    const categoria = conjuntoPrivado(["mod"]);
    const canal: ConjuntoDeSobreposicoes = {
      padrao: undefined,
      cargos: { mod: categoria.cargos["mod"]!, dev: { allow: enviar, deny: 0n } },
    };
    const linhas = diferencasDoCanal(canal, categoria, ["mod", "dev"], nome);
    expect(linhas).toHaveLength(divergencias(canal, categoria));
    expect(linhas.map((l) => l.campo)).toEqual([ALVO_PADRAO, "Dev"]);
  });

  it("antes é o CANAL e depois é a CATEGORIA — a direção do Sincronizar", () => {
    const [linha] = diferencasDoCanal(
      { padrao: { allow: 0n, deny: ver }, cargos: {} },
      NADA,
      [],
      nome,
    );
    expect(linha).toEqual({
      campo: ALVO_PADRAO,
      antes: "✕ Ver o canal",
      depois: "herda tudo",
    });
  });

  it("segue a ordem da tela, e cargo que a tela não conhece vai por último", () => {
    const canal: ConjuntoDeSobreposicoes = {
      padrao: undefined,
      cargos: {
        zzz: { allow: ver, deny: 0n },
        dev: { allow: ver, deny: 0n },
        mod: { allow: ver, deny: 0n },
      },
    };
    const linhas = diferencasDoCanal(canal, NADA, ["mod", "dev"], nome);
    expect(linhas.map((l) => l.campo)).toEqual(["Moderação", "Dev", "zzz"]);
  });

  it("sincronizado não tem linha nenhuma", () => {
    const c = conjuntoPrivado(["mod"]);
    expect(diferencasDoCanal(c, conjuntoPrivado(["mod"]), ["mod"], nome)).toEqual([]);
  });
});

describe("descreverOverride", () => {
  it("vazio e {0,0} herdam tudo", () => {
    expect(descreverOverride(undefined)).toBe("herda tudo");
    expect(descreverOverride({ allow: 0n, deny: 0n })).toBe("herda tudo");
  });

  it("permite e nega com os glifos da legenda da matriz", () => {
    const d = descreverOverride({
      allow: bitDaPermissao("ViewChannel"),
      deny: bitDaPermissao("SendMessage"),
    });
    expect(d).toMatch(/^✓ .+ · ✕ .+$/);
  });

  it("bit que a tela de cargos não lista é CONTADO, não omitido", () => {
    /* Bit 63: acima de qualquer permissão do protocolo. */
    expect(descreverOverride({ allow: 1n << 63n, deny: 0n })).toBe("✓ 1 outra");
  });
});
