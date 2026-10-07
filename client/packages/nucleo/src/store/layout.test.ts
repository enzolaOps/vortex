import { beforeEach, describe, expect, it, vi } from "vitest";

import { escreverPreset, lerPreset } from "../preset/preset";
import { LARGURA, PRESET_PADRAO } from "../preset/schema";
import { SEMENTE_PADRAO } from "../tema/derivar";
import {
  aplicarPreset,
  assinarLayout,
  definirSemente,
  definirSlot,
  lerBruto,
  lerLayout,
  lerSemente,
  resetar,
  slotDe,
  trocarSlots,
} from "./layout";

beforeEach(() => resetar());

describe("granularidade da notificação", () => {
  it("mudança que não muda nada não notifica", () => {
    const ouviu = vi.fn();
    assinarLayout(ouviu);

    definirSlot("b", { largura: PRESET_PADRAO.layout.slots.b.largura });

    // Um store que emite a cada escrita, mudando algo ou não, faz o arraste de
    // borda re-renderizar o shell inteiro em cada frame parado.
    expect(ouviu).not.toHaveBeenCalled();
  });

  it("o snapshot é referência estável enquanto nada muda", () => {
    const antes = lerLayout();
    definirSlot("b", { visivel: true });
    // A armadilha nº 1 vale aqui igual: `getSnapshot` que devolve objeto novo
    // a cada chamada põe o `useSyncExternalStore` em laço.
    expect(lerLayout()).toBe(antes);
  });

  it("mudança de verdade troca a referência e notifica", () => {
    const ouviu = vi.fn();
    assinarLayout(ouviu);
    const antes = lerLayout();

    definirSlot("b", { visivel: false });

    expect(ouviu).toHaveBeenCalledTimes(1);
    expect(lerLayout()).not.toBe(antes);
  });
});

describe("limites de largura", () => {
  it("largura é limitada na escrita, não na leitura", () => {
    definirSlot("b", { largura: 5_000 });
    expect(lerLayout().layout.slots.b.largura).toBe(LARGURA.canais.max);

    definirSlot("b", { largura: 1 });
    expect(lerLayout().layout.slots.b.largura).toBe(LARGURA.canais.min);
  });

  it("trocar o PAINEL de um slot revalida a largura", () => {
    // 400px é legítimo para a lista de canais e muito acima do teto do rail.
    definirSlot("b", { largura: 400 });
    definirSlot("b", { painel: "rail" });

    // Sem revalidar, o rail herdaria 400px de um limite que não é dele.
    expect(lerLayout().layout.slots.b.largura).toBe(LARGURA.rail.max);
  });

  it("slot vazio tem largura zero, não a última que teve", () => {
    definirSlot("d", { painel: null });
    expect(lerLayout().layout.slots.d.largura).toBe(0);
  });
});

describe("trocar de lado", () => {
  it("a largura viaja com o PAINEL, não fica no slot", () => {
    definirSlot("b", { largura: 320 });
    trocarSlots("b", "d");

    const slots = lerLayout().layout.slots;
    expect(slots.d.painel).toBe("canais");
    // Quem escolheu 320px para a lista de canais espera 320px onde quer que
    // ela vá parar.
    expect(slots.d.largura).toBe(320);
    expect(slots.b.painel).toBe("membros");
  });

  it("a largura que viaja também passa pelos limites do destino", () => {
    definirSlot("d", { largura: 400 });
    trocarSlots("a", "d");

    // O rail foi para o slot que tinha membros; membros veio com 400px, que
    // é legítimo para ele. O rail é que não pode levar os 72px para um
    // limite alheio nem trazer largura de volta fora do dele.
    const slots = lerLayout().layout.slots;
    expect(slots.a.painel).toBe("membros");
    expect(slots.a.largura).toBe(400);
    expect(slots.d.painel).toBe("rail");
    expect(slots.d.largura).toBe(LARGURA.rail.padrao);
  });

  it("slotDe encontra o painel depois da troca", () => {
    expect(slotDe("membros")).toBe("d");
    trocarSlots("a", "d");
    expect(slotDe("membros")).toBe("a");
  });
});

describe("ciclo completo: ler, editar, escrever", () => {
  it("chave desconhecida sobrevive a uma edição feita no app", () => {
    const deFora = JSON.stringify({
      version: 1,
      layout: { slots: PRESET_PADRAO.layout.slots },
      densidade: "compacta",
    });

    const { preset, bruto } = lerPreset(deFora);
    aplicarPreset(preset, bruto);

    // O usuário mexe no layout dentro do app.
    definirSlot("b", { largura: 300 });

    const saida = JSON.parse(escreverPreset(lerLayout(), lerBruto())) as Record<
      string,
      unknown
    >;

    // A edição foi gravada E a chave que o app não entende continua lá.
    expect((saida.layout as { slots: { b: { largura: number } } }).slots.b.largura).toBe(300);
    expect(saida.densidade).toBe("compacta");
  });
});

describe("persistência", () => {
  it("tema e largura de slot sobrevivem a um reload", () => {
    const semente = { ...SEMENTE_PADRAO.claro, matiz: 40 };
    definirSemente(semente);
    definirSlot("b", { largura: 300 });

    const cru = localStorage.getItem("vortex:preset");
    expect(cru).toBeTruthy();

    resetar();
    expect(lerSemente()).toEqual(SEMENTE_PADRAO.escuro);

    const { preset, bruto } = lerPreset(cru!);
    aplicarPreset(preset, bruto);

    expect(lerSemente()).toEqual(semente);
    expect(lerLayout().layout.slots.b.largura).toBe(300);
  });
});
