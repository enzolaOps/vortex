import { beforeEach, describe, expect, it, vi } from "vitest";

import { abrirModal, assinarModal, fecharModal, lerModal, limparModais } from "./modais";

beforeEach(() => {
  limparModais();
});

describe("um modal de cada vez", () => {
  it("nasce fechado", () => {
    expect(lerModal()).toBeNull();
  });

  it("abre e fecha", () => {
    abrirModal("paleta");
    expect(lerModal()).toBe("paleta");
    fecharModal();
    expect(lerModal()).toBeNull();
  });
});

describe("quem assina só acorda quando muda", () => {
  it("abrir avisa", () => {
    const ouvinte = vi.fn();
    const parar = assinarModal(ouvinte);
    abrirModal("paleta");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    parar();
  });

  /*
    Abrir o que já está aberto NÃO avisa. Sem isto, um botão clicado duas vezes
    acordaria a camada `sobreposto` do shell por nada — e ela está acima da
    lista de mensagens.
  */
  it("abrir o mesmo de novo não avisa", () => {
    abrirModal("paleta");
    const ouvinte = vi.fn();
    const parar = assinarModal(ouvinte);
    abrirModal("paleta");
    expect(ouvinte).not.toHaveBeenCalled();
    parar();
  });

  it("fechar o que já está fechado não avisa", () => {
    const ouvinte = vi.fn();
    const parar = assinarModal(ouvinte);
    fecharModal();
    expect(ouvinte).not.toHaveBeenCalled();
    parar();
  });

  it("cancelar a assinatura para de avisar", () => {
    const ouvinte = vi.fn();
    assinarModal(ouvinte)();
    abrirModal("paleta");
    expect(ouvinte).not.toHaveBeenCalled();
  });
});

describe("o snapshot é comparável por valor", () => {
  /*
    É string, não objeto — a armadilha nº 1 do briefing não se aplica aqui, e
    isso é por projeto e não por sorte: guardar `{id, dados}` exigiria
    referência cacheada, e o alvo de cada modal vive no store dele (como o
    `menuDeMensagem` já faz).
  */
  it("duas leituras devolvem o mesmo valor", () => {
    abrirModal("paleta");
    expect(lerModal()).toBe(lerModal());
  });
});
