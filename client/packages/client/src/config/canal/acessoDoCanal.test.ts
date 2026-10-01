import { describe, expect, it } from "vitest";

import { BIT_VER_CANAL } from "../../sdk/bits";
import { bitDaPermissao } from "../../sdk/cargos";
import type { ConjuntoDeSobreposicoes } from "../../sdk/categorias";
import {
  ALVO_EVERYONE,
  alvosDaMatriz,
  canalPrivado,
  cargosComAcessoExplicito,
  cargosParaAdicionar,
  contarDecisoes,
  herdado,
  notaDoAlvo,
  overrideDoAlvo,
  procedencia,
  resumoDeAcesso,
  rotuloDeAcesso,
  tomDaContagem,
} from "./acessoDoCanal";

const VER = BIT_VER_CANAL;
const ENVIAR = bitDaPermissao("SendMessage");
const GERENCIAR = bitDaPermissao("ManageChannel");
const vazio: ConjuntoDeSobreposicoes = { padrao: undefined, cargos: {} };

const CARGOS = [
  { id: "NUCLEO", nome: "Núcleo" },
  { id: "MOD", nome: "Moderação" },
  { id: "DESIGN", nome: "Design" },
];

describe("canal privado", () => {
  it("lê @everyone de `padrao` (default_permissions)", () => {
    expect(canalPrivado({ padrao: { allow: 0n, deny: VER }, cargos: {} })).toBe(true);
    expect(overrideDoAlvo({ padrao: { allow: 0n, deny: VER }, cargos: {} }, ALVO_EVERYONE))
      .toEqual({ allow: 0n, deny: VER });
  });

  it("canal sem override nenhum NÃO é privado", () => {
    expect(canalPrivado(vazio)).toBe(false);
  });

  it("ignora um cargo chamado 'default' — o @everyone não mora em role_permissions", () => {
    const c = { padrao: undefined, cargos: { default: { allow: 0n, deny: VER } } };
    expect(canalPrivado(c)).toBe(false);
    expect(overrideDoAlvo(c, ALVO_EVERYONE)).toEqual({ allow: 0n, deny: 0n });
  });

  it("negar o bit 0 (ManageChannel) não é privado", () => {
    expect(canalPrivado({ padrao: { allow: 0n, deny: 1n }, cargos: {} })).toBe(false);
  });
});

describe("lista de acesso", () => {
  const conjunto: ConjuntoDeSobreposicoes = {
    padrao: { allow: 0n, deny: VER },
    cargos: {
      NUCLEO: { allow: VER, deny: 0n },
      MOD: { allow: VER | ENVIAR, deny: GERENCIAR },
    },
  };

  it("só quem decide algo tem acesso explícito", () => {
    expect(cargosComAcessoExplicito(conjunto, CARGOS).map((c) => c.id)).toEqual([
      "NUCLEO",
      "MOD",
    ]);
    expect(resumoDeAcesso(2)).toBe("2 cargos com acesso explícito");
    expect(resumoDeAcesso(1)).toBe("1 cargo com acesso explícito");
    expect(resumoDeAcesso(0)).toMatch(/^Nenhum cargo/);
  });

  it("veredito por linha", () => {
    expect(rotuloDeAcesso(conjunto.padrao!)).toEqual({ tom: "negado", texto: "sem acesso" });
    expect(rotuloDeAcesso(conjunto.cargos.NUCLEO!)).toEqual({
      tom: "total",
      texto: "acesso total",
    });
    expect(rotuloDeAcesso(conjunto.cargos.MOD!)).toEqual({ tom: "neutro", texto: "3 overrides" });
    expect(rotuloDeAcesso({ allow: 0n, deny: 0n }).texto).toBe("herda do servidor");
  });
});

describe("matriz: alvos, nota e contagem", () => {
  const conjunto: ConjuntoDeSobreposicoes = {
    padrao: { allow: 0n, deny: GERENCIAR },
    cargos: { NUCLEO: { allow: VER | ENVIAR, deny: 0n } },
  };

  it("coluna: @everyone, quem decide e quem acabou de ser acrescentado", () => {
    const r = alvosDaMatriz(conjunto, CARGOS, new Set(["DESIGN"]), "");
    expect(r.everyone).toBe(true);
    expect(r.cargos.map((c) => c.id)).toEqual(["NUCLEO", "DESIGN"]);
    expect(cargosParaAdicionar(conjunto, CARGOS, new Set(["DESIGN"])).map((c) => c.id)).toEqual([
      "MOD",
    ]);
  });

  it("a busca filtra os cargos e o @everyone, sem caixa nem acento parcial", () => {
    const r = alvosDaMatriz(conjunto, CARGOS, new Set(["DESIGN"]), "NÚC");
    expect(r.everyone).toBe(false);
    expect(r.cargos.map((c) => c.id)).toEqual(["NUCLEO"]);
    expect(alvosDaMatriz(conjunto, CARGOS, new Set(), "every").everyone).toBe(true);
  });

  it("nota do cabeçalho", () => {
    expect(notaDoAlvo(ALVO_EVERYONE, conjunto.padrao!)).toBe("base do canal · 1 override");
    expect(notaDoAlvo("NUCLEO", conjunto.cargos.NUCLEO!)).toBe("2 overrides");
    expect(notaDoAlvo("DESIGN", { allow: 0n, deny: 0n })).toBe("herda tudo");
    expect(notaDoAlvo(ALVO_EVERYONE, { allow: 0n, deny: 0n })).toBe("base do canal · herda tudo");
  });

  it("permitidas · negadas, com a negação ganhando no bit duplo", () => {
    expect(contarDecisoes({ allow: VER | ENVIAR, deny: ENVIAR | GERENCIAR })).toEqual({
      permitidas: 1,
      negadas: 2,
    });
    expect(tomDaContagem(conjunto.padrao!)).toBe("negar");
    expect(tomDaContagem(conjunto.cargos.NUCLEO!)).toBe("permitir");
    expect(tomDaContagem({ allow: VER, deny: GERENCIAR })).toBe("misto");
    expect(tomDaContagem({ allow: 0n, deny: 0n })).toBeUndefined();
  });
});

describe("herdar: de onde e quanto", () => {
  const servidor = {
    padrao: VER,
    cargos: { MOD: { allow: GERENCIAR, deny: 0n }, NUCLEO: { allow: 0n, deny: VER } },
  };
  const categoria = {
    titulo: "Produto",
    conjunto: { padrao: undefined, cargos: {} } as ConjuntoDeSobreposicoes,
  };

  it("@everyone herda o piso do servidor, pela categoria que também herda", () => {
    const h = herdado({ alvo: ALVO_EVERYONE, bit: VER, canal: vazio, categoria, servidor });
    expect(h).toEqual({ origem: "Produto", permitido: true });
    expect(procedencia("herdar", h)).toBe("Herdando de Produto · permitido");
  });

  it("cargo: o par do servidor vale sobre o piso", () => {
    expect(herdado({ alvo: "MOD", bit: GERENCIAR, canal: vazio, categoria, servidor }).permitido)
      .toBe(true);
    expect(herdado({ alvo: "NUCLEO", bit: VER, canal: vazio, categoria, servidor }).permitido)
      .toBe(false);
  });

  it("cargo: o @everyone DESTE canal decide depois do servidor, e vira a origem", () => {
    const canal: ConjuntoDeSobreposicoes = { padrao: { allow: 0n, deny: GERENCIAR }, cargos: {} };
    expect(herdado({ alvo: "MOD", bit: GERENCIAR, canal, categoria, servidor })).toEqual({
      origem: "@everyone",
      permitido: false,
    });
  });

  it("categoria que DECIDE o bit não é dita como origem — o canal não recebe o valor dela", () => {
    const cat = {
      titulo: "Produto",
      conjunto: { padrao: { allow: 0n, deny: VER }, cargos: {} } as ConjuntoDeSobreposicoes,
    };
    const h = herdado({ alvo: ALVO_EVERYONE, bit: VER, canal: vazio, categoria: cat, servidor });
    expect(h).toEqual({ origem: "servidor", permitido: true });
    expect(herdado({ alvo: ALVO_EVERYONE, bit: VER, canal: vazio, categoria: undefined, servidor }).origem)
      .toBe("servidor");
  });

  it("sub-linha dos estados decididos", () => {
    const h = { origem: "x", permitido: true };
    expect(procedencia("negar", h)).toBe("Negado neste canal");
    expect(procedencia("permitir", h)).toBe("Permitido explicitamente");
  });
});
