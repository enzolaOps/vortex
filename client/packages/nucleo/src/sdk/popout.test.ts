import { afterEach, describe, expect, it, vi } from "vitest";

import {
  abrirJanela,
  modoDeDestaque,
  NOME_DA_JANELA,
  podeDestacar,
  ponteDePopout,
  protegerJanela,
} from "./popout";

/** O `window` do ambiente: o teste roda em Node, então cada caso monta o que a página teria. */
function ambiente(janela: Record<string, unknown>): void {
  vi.stubGlobal("window", janela);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("onde destacar existe", () => {
  it("sem ponte e sem Document PiP não há como — o botão some", () => {
    ambiente({});
    expect(modoDeDestaque()).toBeUndefined();
    expect(podeDestacar()).toBe(false);
  });

  it("a casca ganha do Document PiP", () => {
    ambiente({
      vortexPopout: { definirTopo: vi.fn(), protegerConteudo: vi.fn() },
      documentPictureInPicture: { requestWindow: vi.fn() },
    });
    expect(modoDeDestaque()).toBe("casca");
  });

  it("ponte pela metade conta como ausente", () => {
    ambiente({ vortexPopout: { definirTopo: vi.fn() } });
    expect(ponteDePopout()).toBeUndefined();
    expect(modoDeDestaque()).toBeUndefined();
  });

  it("Document PiP sozinho vale no navegador", () => {
    ambiente({ documentPictureInPicture: { requestWindow: vi.fn() } });
    expect(modoDeDestaque()).toBe("documento");
  });
});

describe("abrir a janela", () => {
  it("na casca é window.open com o nome combinado", async () => {
    const filha = { resizeTo: vi.fn() };
    const open = vi.fn().mockReturnValue(filha);
    ambiente({ open });
    expect(await abrirJanela("casca", { largura: 200, altura: 300 })).toBe(filha);
    expect(open).toHaveBeenCalledWith("", NOME_DA_JANELA);
  });

  it("recusa da casca vira null, sem exceção", async () => {
    ambiente({ open: vi.fn().mockReturnValue(null) });
    expect(await abrirJanela("casca", { largura: 200, altura: 300 })).toBeNull();
  });

  it("no navegador pede o tamanho ao Document PiP", async () => {
    const filha = {};
    const requestWindow = vi.fn().mockResolvedValue(filha);
    ambiente({ documentPictureInPicture: { requestWindow } });
    expect(await abrirJanela("documento", { largura: 200, altura: 300 })).toBe(filha);
    expect(requestWindow).toHaveBeenCalledWith({ width: 200, height: 300 });
  });

  it("Document PiP que lança (sem gesto) vira null", async () => {
    ambiente({ documentPictureInPicture: { requestWindow: vi.fn().mockRejectedValue(new Error("gesto")) } });
    expect(await abrirJanela("documento", { largura: 200, altura: 300 })).toBeNull();
  });
});

describe("proteger", () => {
  it("na casca liga topo e proteção de conteúdo", async () => {
    const definirTopo = vi.fn().mockResolvedValue(undefined);
    const protegerConteudo = vi.fn().mockResolvedValue(undefined);
    ambiente({ vortexPopout: { definirTopo, protegerConteudo } });
    await protegerJanela("casca");
    expect(definirTopo).toHaveBeenCalledWith(true);
    expect(protegerConteudo).toHaveBeenCalledWith(true);
  });

  it("no navegador não há nada a ligar", async () => {
    const protegerConteudo = vi.fn();
    ambiente({ vortexPopout: { definirTopo: vi.fn(), protegerConteudo } });
    await protegerJanela("documento");
    expect(protegerConteudo).not.toHaveBeenCalled();
  });

  it("a casca que falha não derruba a janela", async () => {
    ambiente({
      vortexPopout: { definirTopo: vi.fn().mockRejectedValue(new Error("x")), protegerConteudo: vi.fn() },
    });
    await expect(protegerJanela("casca")).resolves.toBeUndefined();
  });
});
