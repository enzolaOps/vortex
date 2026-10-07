import { afterEach, describe, expect, it } from "vitest";

import { lerModal, limparModais } from "./modais";
import {
  concluirEscolhaDeTela,
  lerSeletorDeTela,
  pedirEscolhaDeTela,
  responderEscolhaDeTela,
  type EscolhaDeTela,
} from "./seletorDeTela";

const ESCOLHA: EscolhaDeTela = {
  fonteId: undefined,
  audio: true,
  resolucao: "1080p",
  taxa: 30,
};

afterEach(() => {
  /* Fecha qualquer pedido que um teste tenha deixado em voo. */
  responderEscolhaDeTela(undefined);
  concluirEscolhaDeTela();
  limparModais();
});

describe("seletor de tela — o modal não fecha no clique", () => {
  it("abre no modo pedido e com o modal registrado", () => {
    void pedirEscolhaDeTela("sistema");
    expect(lerSeletorDeTela()).toEqual({ fase: "escolhendo", modo: "sistema" });
    expect(lerModal()).toBe("tela");
  });

  it("com escolha, fica em INICIANDO até o motor concluir", async () => {
    const pedido = pedirEscolhaDeTela("casca");
    responderEscolhaDeTela({ ...ESCOLHA, fonteId: "screen:1" });

    await expect(pedido).resolves.toEqual({ ...ESCOLHA, fonteId: "screen:1" });
    expect(lerSeletorDeTela().fase).toBe("iniciando");
    expect(lerModal()).toBe("tela");

    concluirEscolhaDeTela();
    expect(lerSeletorDeTela().fase).toBe("fechado");
    expect(lerModal()).toBeNull();
  });

  it("cancelar fecha na hora e resolve undefined", async () => {
    const pedido = pedirEscolhaDeTela("sistema");
    responderEscolhaDeTela(undefined);

    await expect(pedido).resolves.toBeUndefined();
    expect(lerSeletorDeTela().fase).toBe("fechado");
    expect(lerModal()).toBeNull();
  });

  it("concluir com o pedido ainda aberto NÃO fecha o modal", () => {
    void pedirEscolhaDeTela("sistema");
    concluirEscolhaDeTela();
    expect(lerSeletorDeTela().fase).toBe("escolhendo");
    expect(lerModal()).toBe("tela");
  });

  it("recusa um segundo pedido enquanto o primeiro está iniciando", async () => {
    void pedirEscolhaDeTela("sistema");
    responderEscolhaDeTela(ESCOLHA);

    await expect(pedirEscolhaDeTela("sistema")).resolves.toBeUndefined();
    expect(lerSeletorDeTela().fase).toBe("iniciando");
  });

  it("devolve a MESMA referência enquanto nada muda", () => {
    void pedirEscolhaDeTela("casca");
    expect(lerSeletorDeTela()).toBe(lerSeletorDeTela());
  });
});
