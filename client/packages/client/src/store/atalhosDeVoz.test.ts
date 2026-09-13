import { describe, expect, it } from "vitest";

import { comandoDaTecla } from "../sdk/atalhosDeVoz";
import {
  ATALHOS_PADRAO,
  acoesEmConflito,
  atalhosAtivos,
  combinacaoDoEvento,
  teclasDaCombinacao,
  type AtalhosDeVoz,
} from "./atalhosDeVoz";
import { microfoneAberto } from "./pushToTalk";

const tecla = (
  type: string,
  code: string,
  m: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean }> = {},
) => ({
  type,
  code,
  repeat: false,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...m,
});

describe("combinação de teclas", () => {
  it("só modificador não é combinação", () => {
    expect(combinacaoDoEvento(tecla("keydown", "ControlLeft", { ctrlKey: true }), false)).toBeUndefined();
  });

  /* `mod` é Ctrl fora do Mac e ⌘ no Mac — a mesma tecla física não serve aos dois. */
  it("mod segue a plataforma", () => {
    const e = tecla("keydown", "KeyM", { ctrlKey: true, metaKey: false });
    expect(combinacaoDoEvento(e, false)?.mod).toBe(true);
    expect(combinacaoDoEvento(e, true)?.mod).toBe(false);
  });

  it("os padrões são os do design", () => {
    expect(teclasDaCombinacao(ATALHOS_PADRAO.pushToTalk!)).toEqual(["alt", "Espaço"]);
    expect(teclasDaCombinacao(ATALHOS_PADRAO.mutar!)).toEqual(["shift", "mod", "M"]);
  });
});

describe("conflito", () => {
  const repetido: AtalhosDeVoz = { ...ATALHOS_PADRAO, desconectar: ATALHOS_PADRAO.mutar };

  it("marca as DUAS ações", () => {
    expect([...acoesEmConflito(repetido)].sort()).toEqual(["desconectar", "mutar"]);
  });

  it("nenhuma das duas fica ativa", () => {
    const ativos = atalhosAtivos(repetido);
    expect(ativos.mutar).toBeUndefined();
    expect(ativos.desconectar).toBeUndefined();
    expect(ativos.ensurdecer).toBeDefined();
  });

  it("os padrões não têm conflito", () => {
    expect(acoesEmConflito(ATALHOS_PADRAO).size).toBe(0);
  });
});

describe("tecla na janela", () => {
  const ativos = atalhosAtivos(ATALHOS_PADRAO);

  it("Alt+Espaço começa a falar, e soltar o Espaço termina", () => {
    expect(comandoDaTecla(tecla("keydown", "Space", { altKey: true }), ativos, false)).toBe("pushToTalkInicio");
    /* O Alt pode ter sido solto antes: basta a tecla principal. */
    expect(comandoDaTecla(tecla("keyup", "Space"), ativos, false)).toBe("pushToTalkFim");
  });

  /* Segurar mutar não pode alternar trinta vezes por segundo. */
  it("repetição automática não dispara de novo", () => {
    expect(
      comandoDaTecla(tecla("keydown", "KeyM", { ctrlKey: true, shiftKey: true, repeat: true }), ativos, false),
    ).toBeUndefined();
  });

  it("Ctrl+Shift+M muta, e M sozinho não", () => {
    expect(comandoDaTecla(tecla("keydown", "KeyM", { ctrlKey: true, shiftKey: true }), ativos, false)).toBe("mutar");
    expect(comandoDaTecla(tecla("keydown", "KeyM"), ativos, false)).toBeUndefined();
  });
});

describe("quando o microfone transmite", () => {
  const base = { mudo: false, surdo: false, segurando: false };

  it("em detecção de voz, a tecla não importa", () => {
    expect(microfoneAberto({ ...base, modo: "deteccao" })).toBe(true);
  });

  it("em push-to-talk, só segurando", () => {
    expect(microfoneAberto({ ...base, modo: "pressionar" })).toBe(false);
    expect(microfoneAberto({ ...base, modo: "pressionar", segurando: true })).toBe(true);
  });

  /* Quem se mutou de propósito não volta a falar por esbarrar no atalho. */
  it("mudo e surdo ganham da tecla", () => {
    expect(microfoneAberto({ ...base, modo: "pressionar", segurando: true, mudo: true })).toBe(false);
    expect(microfoneAberto({ ...base, modo: "pressionar", segurando: true, surdo: true })).toBe(false);
  });
});
