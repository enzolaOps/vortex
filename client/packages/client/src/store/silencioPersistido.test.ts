import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  alternarSilencio,
  assinarSilencio,
  definirNivelDoCanal,
  definirNivelDoServidor,
  definirOpcoesDoServidor,
  estaSilenciado,
  exportarNotificacoes,
  exportarOpcoesDeServidor,
  hidratarNotificacoes,
  hidratarOpcoesDeServidor,
  limparSilencio,
  nivelDoCanal,
  nivelDoServidor,
  opcoesDoServidor,
  servidorSilenciado,
  silencioAte,
  silenciarServidor,
} from "./silencio";

/**
 * O silêncio sobrevive ao F5 e atravessa dispositivos.
 *
 * Antes disto os cinco mapas viviam só na memória: silenciar um canal "até eu
 * reativar" durava até a próxima atualização da página. O formato de
 * `notifications` é o do cliente OFICIAL, e o que estes testes guardam é a
 * tradução nos dois sentidos — é ela que quebra calada.
 */

const CANAL = "01JQCANAL0000000000000001";
const OUTRO = "01JQCANAL0000000000000002";
const SERVIDOR = "01JQSERV00000000000000001";

beforeEach(() => {
  vi.useRealTimers();
  limparSilencio();
});

describe("formato upstream de notifications", () => {
  it("até eu reativar sai SEM until, e prazo sai como epoch", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    alternarSilencio(CANAL);
    alternarSilencio(OUTRO, 60_000);
    silenciarServidor(SERVIDOR);
    definirNivelDoServidor(SERVIDOR, "mencoes");

    const o = JSON.parse(exportarNotificacoes()) as Record<string, unknown>;
    expect(o).toEqual({
      server: { [SERVIDOR]: "mention" },
      channel: {},
      server_mutes: { [SERVIDOR]: {} },
      channel_mutes: { [CANAL]: {}, [OUTRO]: { until: 1_060_000 } },
    });
  });

  it("nível 'nada' vira none e silencia pelo acoplamento de sempre", () => {
    definirNivelDoCanal(CANAL, "nada");
    const o = JSON.parse(exportarNotificacoes()) as {
      channel: Record<string, string>;
      channel_mutes: Record<string, unknown>;
    };
    expect(o.channel[CANAL]).toBe("none");
    expect(o.channel_mutes[CANAL]).toEqual({});
  });

  it("prazo vencido não é gravado", () => {
    vi.useFakeTimers({ now: 1_000_000 });
    alternarSilencio(CANAL, 1_000);
    vi.setSystemTime(2_000_000);
    const o = JSON.parse(exportarNotificacoes()) as {
      channel_mutes: Record<string, unknown>;
    };
    expect(o.channel_mutes).toEqual({});
  });
});

describe("ida e volta", () => {
  it("exportar → limpar → hidratar devolve o mesmo estado", () => {
    alternarSilencio(CANAL);
    alternarSilencio(OUTRO, 3_600_000);
    silenciarServidor(SERVIDOR, 60_000);
    definirNivelDoServidor(SERVIDOR, "todas");
    definirNivelDoCanal(OUTRO, "mencoes");
    definirOpcoesDoServidor(SERVIDOR, { suprimirTodos: false, suprimirCargos: true });
    const ate = silencioAte(OUTRO);

    const notificacoes = exportarNotificacoes();
    const opcoes = exportarOpcoesDeServidor();
    limparSilencio();
    expect(estaSilenciado(CANAL)).toBe(false);

    hidratarNotificacoes(notificacoes);
    hidratarOpcoesDeServidor(opcoes);

    expect(silencioAte(CANAL)).toBe(Infinity);
    expect(silencioAte(OUTRO)).toBe(ate);
    expect(servidorSilenciado(SERVIDOR)).toBe(true);
    expect(nivelDoServidor(SERVIDOR)).toBe("todas");
    expect(nivelDoCanal(OUTRO)).toBe("mencoes");
    expect(opcoesDoServidor(SERVIDOR)).toEqual({
      suprimirTodos: false,
      suprimirCargos: true,
    });
  });

  it("o F5: o módulo recarregado lê o localStorage", async () => {
    alternarSilencio(CANAL);
    definirOpcoesDoServidor(SERVIDOR, { suprimirCargos: true });
    vi.resetModules();
    const novo = await import("./silencio");
    expect(novo.estaSilenciado(CANAL)).toBe(true);
    expect(novo.opcoesDoServidor(SERVIDOR).suprimirCargos).toBe(true);
  });

  it("opção igual ao padrão não é exportada", () => {
    definirOpcoesDoServidor(SERVIDOR, { suprimirCargos: true });
    definirOpcoesDoServidor(SERVIDOR, { suprimirCargos: false });
    expect(exportarOpcoesDeServidor()).toBe("{}");
  });
});

describe("hidratar", () => {
  it("dispara os ouvintes uma vez", () => {
    const ouvinte = vi.fn();
    const parar = assinarSilencio(ouvinte);
    hidratarNotificacoes(JSON.stringify({ channel_mutes: { [CANAL]: {} } }));
    expect(ouvinte).toHaveBeenCalledTimes(1);
    parar();
  });

  /*
    ⚠ O cliente oficial produz "none" SEM mute. Hidratar pelos setters
    reescreveria isso num silêncio que ninguém pôs.
  */
  it("'none' remoto sem mute NÃO vira silêncio", () => {
    hidratarNotificacoes(JSON.stringify({ channel: { [CANAL]: "none" } }));
    expect(nivelDoCanal(CANAL)).toBe("nada");
    expect(estaSilenciado(CANAL)).toBe(false);
  });

  it("until vencido é descartado, until null vale para sempre", () => {
    hidratarNotificacoes(
      JSON.stringify({
        channel_mutes: { [CANAL]: { until: 1 }, [OUTRO]: { until: null } },
      }),
    );
    expect(estaSilenciado(CANAL)).toBe(false);
    expect(silencioAte(OUTRO)).toBe(Infinity);
  });

  it("'muted' legado do upstream vira silêncio sem prazo", () => {
    hidratarNotificacoes(JSON.stringify({ server: { [SERVIDOR]: "muted" } }));
    expect(servidorSilenciado(SERVIDOR)).toBe(true);
    expect(nivelDoServidor(SERVIDOR)).toBeUndefined();
  });

  it("lixo por entrada é ignorado sem derrubar o resto", () => {
    hidratarNotificacoes(
      JSON.stringify({
        channel: { [CANAL]: "barulho", [OUTRO]: "mention" },
        channel_mutes: { [CANAL]: 42 },
      }),
    );
    expect(nivelDoCanal(CANAL)).toBeUndefined();
    expect(estaSilenciado(CANAL)).toBe(false);
    expect(nivelDoCanal(OUTRO)).toBe("mencoes");
    hidratarOpcoesDeServidor(JSON.stringify({ [SERVIDOR]: { suprimirTodos: "sim" } }));
    expect(opcoesDoServidor(SERVIDOR).suprimirTodos).toBe(true);
  });

  it("não-objeto mantém o local", () => {
    alternarSilencio(CANAL);
    hidratarNotificacoes("[]");
    expect(estaSilenciado(CANAL)).toBe(true);
  });
});
