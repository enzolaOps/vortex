import { beforeEach, describe, expect, it } from "vitest";

import {
  aceitaDm,
  algumaRestricaoDeDm,
  aplicarATodos,
  definirPrivacidadeDoServidor,
  exportarPrivacidadeDoServidor,
  hidratarPrivacidadeDoServidor,
  lerPrivacidadeDoServidor,
  limparPrivacidadeDoServidor,
  PADRAO,
  privacidadeRestringe,
} from "./privacidadeDoServidor";

const A = "01JQSERV0000000000000000A1";
const B = "01JQSERV0000000000000000B1";

beforeEach(() => limparPrivacidadeDoServidor());

describe("padrão conservador", () => {
  it("quem nunca mexeu mantém DM aberta e mídia sem filtro pessoal", () => {
    expect(lerPrivacidadeDoServidor(A)).toBe(PADRAO);
    expect(PADRAO.dm).toBe("todos");
    expect(PADRAO.filtro).toBe("nao");
    expect(algumaRestricaoDeDm()).toBe(false);
  });

  /*
    ⚠ O caso que faria da feature um defeito: todo cliente já tinha subido o
    padrão de fábrica ANTIGO. Lido como escolha, ele fecharia DMs de quem
    nunca abriu o modal.
  */
  it("formato sem versão: o padrão de fábrica antigo NÃO vira escolha", () => {
    const antigo = {
      dm: "cargoComum",
      filtro: "deNaoAmigos",
      mostrarPresenca: true,
      mostrarAtividade: false,
      permitirAmizade: true,
    };
    hidratarPrivacidadeDoServidor(
      JSON.stringify({ padrao: antigo, porServidor: { [A]: { ...antigo, dm: "ninguem" } } }),
    );
    expect(lerPrivacidadeDoServidor(B)).toBe(PADRAO);
    // O que difere do padrão antigo é escolha, e fica.
    expect(lerPrivacidadeDoServidor(A).dm).toBe("ninguem");
    expect(lerPrivacidadeDoServidor(A).filtro).toBe("nao");
  });

  it("formato v2 é lido como está, e a exportação carrega a versão", () => {
    definirPrivacidadeDoServidor(A, { dm: "cargoComum", filtro: "deNaoAmigos" });
    const cru = exportarPrivacidadeDoServidor();
    expect(JSON.parse(cru)).toMatchObject({ versao: 2 });
    limparPrivacidadeDoServidor();
    hidratarPrivacidadeDoServidor(cru);
    expect(lerPrivacidadeDoServidor(A).dm).toBe("cargoComum");
    expect(lerPrivacidadeDoServidor(A).filtro).toBe("deNaoAmigos");
    expect(algumaRestricaoDeDm()).toBe(true);
  });

  it("aplicar a todos troca o padrão e liga a restrição", () => {
    definirPrivacidadeDoServidor(A, { dm: "ninguem" });
    aplicarATodos(A);
    expect(lerPrivacidadeDoServidor(B).dm).toBe("ninguem");
  });
});

describe("regras puras", () => {
  it("aceitaDm", () => {
    expect(aceitaDm({ ...PADRAO, dm: "todos" }, false)).toBe(true);
    expect(aceitaDm({ ...PADRAO, dm: "ninguem" }, true)).toBe(false);
    expect(aceitaDm({ ...PADRAO, dm: "cargoComum" }, true)).toBe(true);
    expect(aceitaDm({ ...PADRAO, dm: "cargoComum" }, false)).toBe(false);
  });

  it("restringe só quando TODOS os servidores em comum negam", () => {
    const nega = new Set([A]);
    const permite = (id: string) => !nega.has(id);
    expect(privacidadeRestringe([A], permite)).toBe(true);
    expect(privacidadeRestringe([A, B], permite)).toBe(false);
    expect(privacidadeRestringe([], permite)).toBe(false);
    expect(privacidadeRestringe(undefined, permite)).toBe(false);
  });
});
