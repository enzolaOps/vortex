import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aplicarAtualizacao, limparSync } from "./sincronizar";
import {
  alternarSilencio,
  assinarSilencio,
  definirOpcoesDoServidor,
  estaSilenciado,
  limparSilencio,
  opcoesDoServidor,
} from "../store/silencio";
import { ligarEnvio, type ChaveSync } from "../store/sync";

/**
 * O caminho de SINCRONIA do silêncio, de ponta a ponta: store → fila de envio
 * → `UserSettingsUpdate` → store de novo.
 *
 * O que só este arquivo vê: o eco. Aplicar o que o servidor mandou passa pelos
 * mesmos mapas que um clique, e sem `aplicarRemoto` cada atualização recebida
 * viraria um POST de volta — dois dispositivos abertos trocariam a mesma chave
 * para sempre.
 */

const CANAL = "01JQCANAL0000000000000009";
const SERVIDOR = "01JQSERV00000000000000009";

let enviados: [ChaveSync, string][] = [];

beforeEach(() => {
  enviados = [];
  limparSilencio();
  limparSync();
  ligarEnvio((chave, valor) => enviados.push([chave, valor]));
});

afterEach(() => {
  ligarEnvio(() => {});
  limparSync();
  limparSilencio();
});

describe("ida", () => {
  it("silenciar avisa a chave notifications com o formato upstream", () => {
    alternarSilencio(CANAL);
    expect(enviados).toHaveLength(1);
    const [chave, valor] = enviados[0]!;
    expect(chave).toBe("notifications");
    expect(JSON.parse(valor)).toMatchObject({ channel_mutes: { [CANAL]: {} } });
  });

  it("opção de servidor vai na chave própria", () => {
    definirOpcoesDoServidor(SERVIDOR, { suprimirCargos: true });
    expect(enviados.map(([c]) => c)).toEqual(["vortex:notificacoesDoServidor"]);
  });
});

describe("volta", () => {
  it("atualização remota aplica, acorda ouvintes e NÃO ecoa", () => {
    const ouvinte = vi.fn();
    const parar = assinarSilencio(ouvinte);
    aplicarAtualizacao({
      notifications: [
        Date.now() + 1000,
        JSON.stringify({ channel_mutes: { [CANAL]: {} } }),
      ],
      "vortex:notificacoesDoServidor": [
        Date.now() + 1000,
        JSON.stringify({ [SERVIDOR]: { suprimirTodos: false, suprimirCargos: true } }),
      ],
    });
    parar();
    expect(estaSilenciado(CANAL)).toBe(true);
    expect(opcoesDoServidor(SERVIDOR).suprimirCargos).toBe(true);
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(enviados).toEqual([]);
  });

  it("remoto mais velho que a revisão local reenvia o local", () => {
    aplicarAtualizacao({
      notifications: [100, JSON.stringify({ channel_mutes: { [CANAL]: {} } })],
    });
    aplicarAtualizacao({
      notifications: [50, JSON.stringify({ channel_mutes: {} })],
    });
    expect(estaSilenciado(CANAL)).toBe(true);
    expect(enviados.map(([c]) => c)).toEqual(["notifications"]);
  });

  it("prazo que já venceu no remoto não silencia", () => {
    aplicarAtualizacao({
      notifications: [
        Date.now() + 1000,
        JSON.stringify({ channel_mutes: { [CANAL]: { until: Date.now() - 1 } } }),
      ],
    });
    expect(estaSilenciado(CANAL)).toBe(false);
  });

  it("JSON podre mantém o local", () => {
    alternarSilencio(CANAL);
    aplicarAtualizacao({ notifications: [Date.now() + 1000, "{nao é json"] });
    expect(estaSilenciado(CANAL)).toBe(true);
  });
});
