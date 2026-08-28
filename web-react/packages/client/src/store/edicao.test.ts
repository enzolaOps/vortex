import { beforeEach, describe, expect, it, vi } from "vitest";

import { escreverPreset, lerPreset } from "../preset/preset";
import { PRESET_PADRAO } from "../preset/schema";
import { aoTerminarArraste, estaArrastando, iniciarArraste, terminarArraste } from "./arraste";
import { entrar, lerEdicao, sair, temMudanca } from "./edicao";
import { aplicarPreset, definirSlot, lerBruto, lerLayout, resetar } from "./layout";

beforeEach(() => {
  sair(true);
  resetar();
});

describe("sair sem salvar reverte", () => {
  it("cancelar devolve o layout exato da entrada", () => {
    definirSlot("b", { largura: 300 });
    const antes = lerLayout();

    entrar();
    definirSlot("b", { largura: 400 });
    definirSlot("d", { visivel: false });
    expect(lerLayout()).not.toBe(antes);

    sair(false);

    // Não há botão de "aplicar": tudo já estava valendo. Cancelar só funciona
    // porque o retrato foi tirado na entrada.
    expect(lerLayout()).toBe(antes);
    expect(lerLayout().layout.slots.b.largura).toBe(300);
    expect(lerLayout().layout.slots.d.visivel).toBe(true);
  });

  it("concluir mantém o que foi mexido", () => {
    entrar();
    definirSlot("b", { largura: 400 });
    sair(true);

    expect(lerLayout().layout.slots.b.largura).toBe(400);
  });

  it("cancelar devolve TAMBÉM as chaves que o app não entende", () => {
    const { preset, bruto } = lerPreset(
      JSON.stringify({ version: 1, layout: { slots: {} }, densidade: "compacta" }),
    );
    aplicarPreset(preset, bruto);

    entrar();
    definirSlot("b", { largura: 400 });
    sair(false);

    // Um desfazer que preserva o que entende e perde o que não entende é pior
    // que não ter desfazer: o dano fica invisível.
    const saida = JSON.parse(escreverPreset(lerLayout(), lerBruto())) as Record<
      string,
      unknown
    >;
    expect(saida.densidade).toBe("compacta");
  });

  it("sair duas vezes não desfaz o que veio depois", () => {
    entrar();
    definirSlot("b", { largura: 400 });
    sair(true);

    definirSlot("b", { largura: 200 });
    sair(false);

    expect(lerLayout().layout.slots.b.largura).toBe(200);
  });
});

describe("estado do modo", () => {
  it("entrar duas vezes não troca o retrato", () => {
    entrar();
    definirSlot("b", { largura: 400 });
    entrar();
    sair(false);

    // Um segundo `entrar()` que tirasse retrato novo transformaria a mudança
    // já feita em ponto de retorno, e o cancelamento pararia no meio.
    expect(lerLayout().layout.slots.b.largura).toBe(
      PRESET_PADRAO.layout.slots.b.largura,
    );
  });

  it("temMudanca só é verdade quando algo mudou", () => {
    entrar();
    expect(temMudanca()).toBe(false);
    definirSlot("b", { largura: 400 });
    expect(temMudanca()).toBe(true);
  });

  it("lerEdicao devolve primitivo — sem armadilha de referência", () => {
    expect(lerEdicao()).toBe(false);
    entrar();
    expect(lerEdicao()).toBe(true);
  });
});

describe("sinal de arraste", () => {
  it("avisa uma vez no fim, e não avisa se não começou", () => {
    const ouviu = vi.fn();
    aoTerminarArraste(ouviu);

    terminarArraste();
    expect(ouviu).not.toHaveBeenCalled();

    iniciarArraste();
    expect(estaArrastando()).toBe(true);
    terminarArraste();

    expect(estaArrastando()).toBe(false);
    expect(ouviu).toHaveBeenCalledTimes(1);
  });

  it("terminar duas vezes avisa uma vez", () => {
    const ouviu = vi.fn();
    aoTerminarArraste(ouviu);

    iniciarArraste();
    terminarArraste();
    terminarArraste();

    // O `pointerup` e o `lostpointercapture` chegam os dois. Sem a guarda, a
    // lista remediria duas vezes por arraste.
    expect(ouviu).toHaveBeenCalledTimes(1);
  });
});
