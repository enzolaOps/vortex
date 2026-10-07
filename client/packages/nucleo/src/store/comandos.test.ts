import { describe, expect, it, vi } from "vitest";

import { ouvirIrParaMensagem, pedirIrParaMensagem } from "./comandos";

const CANAL = "01CANAL00000000000000000A";
const MSG = "01MENSAGEM000000000000001";

describe("ir para uma mensagem", () => {
  it("entrega a quem já está ouvindo", () => {
    const ouvinte = vi.fn();
    const parar = ouvirIrParaMensagem(CANAL, ouvinte);
    pedirIrParaMensagem(CANAL, MSG);
    expect(ouvinte).toHaveBeenCalledWith(MSG);
    parar();
  });

  /*
    O caso que o permalink criou. "Sem ouvinte é no-op" era a regra certa
    enquanto todo pedido nascia de um clique — se ninguém ouve, ninguém pediu.
    Abrir `/servidor/A/canal/B/01MENSAGEM` pede o salto quando a rota é lida, e
    a lista daquele canal ainda nem montou.
  */
  it("guarda o pedido que chegou ANTES da lista existir", () => {
    const ouvinte = vi.fn();
    pedirIrParaMensagem(CANAL, MSG);
    const parar = ouvirIrParaMensagem(CANAL, ouvinte);
    expect(ouvinte).toHaveBeenCalledWith(MSG);
    parar();
  });

  /*
    Guardar depois de entregue faria o salto repetir a cada remontagem — e
    trocar de canal e voltar remonta a lista, por decisão de projeto.
  */
  it("o guardado é consumido uma vez só", () => {
    pedirIrParaMensagem(CANAL, MSG);
    const primeiro = vi.fn();
    ouvirIrParaMensagem(CANAL, primeiro)();
    expect(primeiro).toHaveBeenCalledTimes(1);

    const segundo = vi.fn();
    ouvirIrParaMensagem(CANAL, segundo)();
    expect(segundo).not.toHaveBeenCalled();
  });

  it("dois pedidos antes da lista: o último ganha", () => {
    pedirIrParaMensagem(CANAL, MSG);
    pedirIrParaMensagem(CANAL, "01OUTRA00000000000000001");
    const ouvinte = vi.fn();
    ouvirIrParaMensagem(CANAL, ouvinte)();
    expect(ouvinte).toHaveBeenCalledWith("01OUTRA00000000000000001");
    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it("o guardado é por canal, não global", () => {
    pedirIrParaMensagem(CANAL, MSG);
    const outro = vi.fn();
    ouvirIrParaMensagem("01OUTROCANAL000000000001", outro)();
    expect(outro).not.toHaveBeenCalled();

    const certo = vi.fn();
    ouvirIrParaMensagem(CANAL, certo)();
    expect(certo).toHaveBeenCalledWith(MSG);
  });
});
