import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Atualizacao, PonteDesktop } from "../sdk/desktop";

const config = vi.hoisted(() => ({ minima: undefined as string | undefined }));
vi.mock("../sdk/config", () => ({
  esperarConfiguracao: () => Promise.resolve(true),
  versaoMinimaDoDesktop: () => config.minima,
}));

const desktop = vi.hoisted(() => ({
  naCasca: true,
  ouvintes: new Set<() => void>(),
}));
vi.mock("./desktop", () => ({
  lerDesktop: () => ({ naCasca: desktop.naCasca }),
  assinarDesktop: (o: () => void) => {
    desktop.ouvintes.add(o);
    return () => desktop.ouvintes.delete(o);
  },
}));

const ponteAtual = vi.hoisted((): { p: unknown } => ({ p: undefined }));
vi.mock("../sdk/desktop", () => ({
  ponte: () => ponteAtual.p as PonteDesktop | undefined,
}));

import {
  ESPERA_DA_CASCA_MS,
  assinarAtualizacao,
  baixarManualmente,
  instalarAtualizacao,
  lerAtualizacao,
  montarTela,
} from "./atualizacao";

const EM_DIA: Atualizacao = { estado: "em-dia", versao: undefined, progresso: 0 };

function casca(versao = "4.2.0") {
  let ouvinte: ((a: Atualizacao) => void) | undefined;
  const pedidos: unknown[] = [];
  const p = {
    versao,
    plataforma: "win32",
    assinarAtualizacao: (o: (a: Atualizacao) => void) => {
      ouvinte = o;
      o(EM_DIA);
      return () => (ouvinte = undefined);
    },
    verificarAtualizacao: () => Promise.resolve(),
    instalarEReiniciar: (opcoes?: unknown) => {
      pedidos.push(opcoes);
      return Promise.resolve();
    },
  };
  ponteAtual.p = p;
  return { pedidos, emitir: (a: Atualizacao) => ouvinte?.(a) };
}

describe("montarTela", () => {
  it("bloqueia pela versão exigida mesmo com a casca dizendo 'em dia'", () => {
    const t = montarTela(EM_DIA, "4.3.0", "4.2.0", "nenhum");
    expect(t.bloqueada).toBe(true);
    expect(t.exigida).toBe("4.3.0");
  });

  it("não bloqueia sem mínima, com mínima atendida ou fora da casca", () => {
    expect(montarTela(EM_DIA, undefined, "4.2.0", "nenhum").bloqueada).toBe(false);
    expect(montarTela(EM_DIA, "4.2.0", "4.2.0", "nenhum").bloqueada).toBe(false);
    expect(montarTela(EM_DIA, "9.0.0", undefined, "nenhum").bloqueada).toBe(false);
  });

  it("falha da casca ou falta de resposta encerram o 'instalando'", () => {
    const falhou = { ...EM_DIA, estado: "falhou" as const };
    expect(montarTela(falhou, "4.3.0", "4.2.0", "aguardando")).toMatchObject({
      falhou: true,
      instalando: false,
    });
    expect(montarTela(EM_DIA, "4.3.0", "4.2.0", "sem-resposta").falhou).toBe(true);
  });
});

describe("store de atualização", () => {
  let soltar: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    config.minima = undefined;
    desktop.naCasca = true;
  });

  afterEach(() => {
    soltar?.();
    vi.useRealTimers();
    ponteAtual.p = undefined;
    vi.unstubAllGlobals();
  });

  it("entra em bloqueio quando o servidor exige versão maior", async () => {
    casca("4.2.0");
    config.minima = "4.3.0";
    soltar = assinarAtualizacao(() => {});
    await vi.runAllTimersAsync();
    expect(lerAtualizacao().bloqueada).toBe(true);
  });

  it("snapshot estável entre leituras", () => {
    casca();
    soltar = assinarAtualizacao(() => {});
    expect(lerAtualizacao()).toBe(lerAtualizacao());
  });

  it("no bloqueio, instalar pede { obrigatoria: true } e desiste sem resposta", async () => {
    const c = casca("4.2.0");
    config.minima = "4.3.0";
    soltar = assinarAtualizacao(() => {});
    await vi.advanceTimersByTimeAsync(0);
    instalarAtualizacao();
    expect(c.pedidos).toEqual([{ obrigatoria: true }]);
    expect(lerAtualizacao().instalando).toBe(true);
    await vi.advanceTimersByTimeAsync(ESPERA_DA_CASCA_MS);
    expect(lerAtualizacao()).toMatchObject({ instalando: false, falhou: true });
  });

  it("resposta da casca cancela a desistência", async () => {
    const c = casca("4.2.0");
    config.minima = "4.3.0";
    soltar = assinarAtualizacao(() => {});
    await vi.advanceTimersByTimeAsync(0);
    instalarAtualizacao();
    c.emitir({ estado: "verificando", versao: undefined, progresso: 0 });
    await vi.advanceTimersByTimeAsync(ESPERA_DA_CASCA_MS);
    expect(lerAtualizacao()).toMatchObject({ instalando: true, falhou: false });
  });

  it("bloqueio vindo da casca não destrava quando ela segue o ciclo", () => {
    const c = casca("4.2.0");
    soltar = assinarAtualizacao(() => {});
    c.emitir({ estado: "obrigatoria", versao: "4.3.0", progresso: 0 });
    instalarAtualizacao();
    c.emitir({ estado: "verificando", versao: "4.3.0", progresso: 0 });
    c.emitir({ estado: "falhou", versao: "4.3.0", progresso: 0 });
    expect(lerAtualizacao()).toMatchObject({ bloqueada: true, falhou: true });
  });

  it("fora do bloqueio, instalar é o pedido comum", () => {
    const c = casca();
    soltar = assinarAtualizacao(() => {});
    instalarAtualizacao();
    expect(c.pedidos).toEqual([undefined]);
  });

  it("baixar manualmente abre o instalador da plataforma", () => {
    casca();
    const abrir = vi.fn();
    vi.stubGlobal("window", { open: abrir });
    baixarManualmente();
    expect(abrir).toHaveBeenCalledWith(
      expect.stringContaining("Vortex-Setup.exe"),
      "_blank",
      "noopener,noreferrer",
    );
  });
});
