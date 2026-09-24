import { describe, expect, it } from "vitest";

import { acaoDoNovoGrupo, dicaDoNovoGrupo, TETO } from "./rodapeDoNovoGrupo";

describe("rodapé do novo grupo (D-DMN-05/06)", () => {
  it("sem ninguém escolhido pede uma pessoa e não faz nada", () => {
    expect(dicaDoNovoGrupo(0)).toBe("Escolha pelo menos uma pessoa");
    expect(acaoDoNovoGrupo(0)).toBe("nenhuma");
  });

  it("uma pessoa abre a DM em vez de criar grupo", () => {
    expect(acaoDoNovoGrupo(1)).toBe("abrirDm");
    expect(dicaDoNovoGrupo(1)).toBe("8 vagas restantes");
  });

  it("duas ou mais criam grupo", () => {
    expect(acaoDoNovoGrupo(2)).toBe("criarGrupo");
    expect(acaoDoNovoGrupo(TETO - 1)).toBe("criarGrupo");
  });

  it("conta você na vaga: singular na penúltima", () => {
    expect(dicaDoNovoGrupo(TETO - 2)).toBe("1 vaga restante");
  });

  it("no teto diz o limite em vez de zero vagas", () => {
    expect(dicaDoNovoGrupo(TETO - 1)).toBe("Limite de 10 alcançado");
  });
});
