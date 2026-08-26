import { describe, expect, it } from "vitest";

import { escreverPreset, lerPreset } from "./preset";
import { PRESET_PADRAO, VERSAO_ATUAL } from "./schema";

/**
 * As invariantes do preset. Três delas são as que o `enforcement.md` marcava
 * como "Fase 4" desde a fase 2, e uma tem consequência irreversível.
 *
 * Preset já compartilhado não volta atrás: se um dia sair daqui uma string com
 * ID de canal dentro, ela vai estar num chat público antes de alguém notar.
 * É a única regra deste projeto cujo erro não tem conserto — por isso o tipo
 * torna irrepresentável e o teste só confirma que o tipo continua de pé.
 */

describe("chave desconhecida é preservada", () => {
  it("chave de topo inventada por uma versão futura volta intacta", () => {
    const original = {
      version: 2,
      layout: { slots: PRESET_PADRAO.layout.slots },
      densidade: "compacta",
      atalhos: { fechar: "Esc" },
    };

    const { preset, bruto } = lerPreset(JSON.stringify(original));
    const saida = JSON.parse(escreverPreset(preset, bruto)) as Record<string, unknown>;

    expect(saida.densidade).toBe("compacta");
    expect(saida.atalhos).toEqual({ fechar: "Esc" });
  });

  it("preserva em PROFUNDIDADE, inclusive dentro de um slot", () => {
    const original = {
      version: 1,
      layout: {
        slots: {
          a: { painel: "rail", largura: 72, visivel: true, fixado: true },
          b: { painel: "canais", largura: 240, visivel: true },
          d: { painel: "membros", largura: 240, visivel: true },
        },
        colunaExtra: { painel: "voz" },
      },
    };

    const { preset, bruto } = lerPreset(JSON.stringify(original));
    const saida = JSON.parse(escreverPreset(preset, bruto)) as {
      layout: { slots: { a: Record<string, unknown> }; colunaExtra: unknown };
    };

    // Um saco de `extras` só preservaria onde alguém lembrou de colocar o
    // saco. Mesclar o conhecido sobre o bruto preserva onde ninguém pensou.
    expect(saida.layout.slots.a.fixado).toBe(true);
    expect(saida.layout.colunaExtra).toEqual({ painel: "voz" });
  });

  it("versão futura mantém o número da versão na escrita", () => {
    const { preset, bruto, avisos } = lerPreset(
      JSON.stringify({ version: 99, layout: { slots: {} } }),
    );
    const saida = JSON.parse(escreverPreset(preset, bruto)) as { version: number };

    // Escrever `version: 1` num arquivo com estrutura de v99 seria mentir
    // sobre o conteúdo, e a próxima versão a abrir confiaria na mentira.
    expect(saida.version).toBe(99);
    expect(avisos.join(" ")).toMatch(/mais nova/);
  });

  it("chave de TEMA não reconhecida não vira token, e não some", () => {
    const original = {
      version: 1,
      layout: { slots: {} },
      theme: { "--vx-accent": "#ff0000", "--vx-glow": "#00ff00" },
    };

    const { preset, bruto, avisos } = lerPreset(JSON.stringify(original));
    const saida = JSON.parse(escreverPreset(preset, bruto)) as {
      theme: Record<string, string>;
    };

    expect(preset.theme).toEqual({ "--vx-accent": "#ff0000" });
    expect(saida.theme["--vx-glow"]).toBe("#00ff00");
    expect(avisos.join(" ")).toMatch(/--vx-glow/);
  });
});

describe("chave ausente recebe default", () => {
  it("preset vazio vira o padrão de fábrica", () => {
    const { preset } = lerPreset("{}");
    expect(preset.layout.slots).toEqual(PRESET_PADRAO.layout.slots);
  });

  it("slot pela metade completa o resto sem inventar", () => {
    const { preset } = lerPreset(
      JSON.stringify({ version: 1, layout: { slots: { b: { visivel: false } } } }),
    );

    expect(preset.layout.slots.b.visivel).toBe(false);
    expect(preset.layout.slots.b.painel).toBe("canais");
    expect(preset.layout.slots.b.largura).toBe(PRESET_PADRAO.layout.slots.b.largura);
  });

  it("`painel: null` é escolha, e não ausência", () => {
    const { preset } = lerPreset(
      JSON.stringify({ version: 1, layout: { slots: { d: { painel: null } } } }),
    );
    // Colapsar ausente e null faria um slot esvaziado de propósito voltar
    // preenchido na próxima leitura.
    expect(preset.layout.slots.d.painel).toBeNull();
    expect(preset.layout.slots.d.largura).toBe(0);
  });

  it("texto ilegível não derruba nada — cai no padrão com aviso", () => {
    const { preset, avisos } = lerPreset("isto não é json");
    expect(preset).toEqual(PRESET_PADRAO);
    expect(avisos).toHaveLength(1);
  });
});

describe("largura fica dentro dos limites", () => {
  it("valor absurdo é limitado, não aceito nem rejeitado", () => {
    const { preset } = lerPreset(
      JSON.stringify({
        version: 1,
        layout: { slots: { b: { painel: "canais", largura: 99_999 } } },
      }),
    );
    expect(preset.layout.slots.b.largura).toBe(420);
  });

  it("largura de um painel não é aplicada a outro sem passar pelo limite", () => {
    // 200px é legítimo para a lista de canais e acima do teto do rail.
    const { preset } = lerPreset(
      JSON.stringify({
        version: 1,
        layout: { slots: { a: { painel: "rail", largura: 400 } } },
      }),
    );
    expect(preset.layout.slots.a.largura).toBe(240);
  });
});

describe("a semente de tema", () => {
  it("sobrevive a um ciclo ler → escrever", () => {
    const original = {
      version: 1,
      layout: { slots: {} },
      tema: { modo: "claro", matiz: 120, croma: 1.5, acento: "#00aa55" },
    };

    const { preset, bruto } = lerPreset(JSON.stringify(original));
    expect(preset.tema).toEqual(original.tema);

    const saida = JSON.parse(escreverPreset(preset, bruto)) as typeof original;
    expect(saida.tema).toEqual(original.tema);
  });

  it("campo inválido cai no padrão em vez de explodir num render", () => {
    // `acento` é a única string livre do schema inteiro, e um hex que não é hex
    // viraria exceção lá na frente, dentro de `hexParaOklch`, longe daqui.
    const { preset } = lerPreset(
      JSON.stringify({
        version: 1,
        layout: { slots: {} },
        tema: { modo: "escuro", matiz: "roxo", croma: -5, acento: "javascript:alert(1)" },
      }),
    );

    expect(preset.tema?.acento).toBe("#bcaef2");
    expect(preset.tema?.matiz).toBe(295);
    expect(preset.tema?.croma).toBe(0);
  });

  it("matiz fora de volta é normalizado, não rejeitado", () => {
    const { preset } = lerPreset(
      JSON.stringify({ version: 1, layout: {}, tema: { modo: "escuro", matiz: 725 } }),
    );
    expect(preset.tema?.matiz).toBe(5);
  });

  it("a semente também não tem onde guardar dado de sessão", () => {
    const texto = escreverPreset({
      ...PRESET_PADRAO,
      tema: { modo: "escuro", matiz: 295, croma: 1, acento: "#bcaef2" },
    });
    const saida = JSON.parse(texto) as { tema: Record<string, unknown> };

    // Quatro campos, e o tipo não admite um quinto. Uma string de ID não teria
    // onde entrar nem se alguém quisesse.
    expect(Object.keys(saida.tema).sort()).toEqual([
      "acento",
      "croma",
      "matiz",
      "modo",
    ]);
  });
});

describe("nenhum dado de sessão sai daqui", () => {
  /**
   * O teste feio que transforma privacidade em algo que não pode ser violado
   * em silêncio. ULID e snowflake são os dois formatos que o protocolo usa.
   */
  const PARECE_ID = /\b(?:[0-9A-HJKMNP-TV-Z]{26}|\d{17,20})\b/;

  it("um preset completo serializado não contém ID em formato de domínio", () => {
    const texto = escreverPreset({
      ...PRESET_PADRAO,
      theme: { "--vx-accent": "#5b45c4", "--vx-surface-0": "#141318" },
    });

    expect(texto).not.toMatch(PARECE_ID);
  });

  it("o tipo não tem onde guardar um ID — a regressão seria de compilação", () => {
    const texto = escreverPreset(PRESET_PADRAO);
    const saida = JSON.parse(texto) as Record<string, unknown>;

    // Só três chaves de topo existem. Uma quarta com nome de entidade não
    // passaria pelo tipo, e este teste é o que avisa se alguém afrouxar o tipo.
    expect(Object.keys(saida).sort()).toEqual(["layout", "version"]);
    expect(saida.version).toBe(VERSAO_ATUAL);
  });

  it("ID injetado por um preset de fora não vira estado do app", () => {
    const { preset } = lerPreset(
      JSON.stringify({
        version: 1,
        layout: { slots: { a: { painel: "01JQ0000000000000000000001" } } },
      }),
    );
    // `painel` é união fechada de TIPOS. Uma instância não é um valor válido,
    // então vira slot vazio em vez de virar referência a um servidor.
    expect(preset.layout.slots.a.painel).toBeNull();
  });
});
