import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CHANNEL_ID, SERVER_ID, seed } from "../dev/firehose";
import {
  channels,
  definirCanalAberto,
  marcarCanalLido,
  membrosOffline,
  membrosOnline,
  servers,
} from "./adapter";
import { client } from "./client";

/**
 * As invariantes das colunas laterais.
 *
 * Nenhuma delas dá erro quando quebra, e as duas primeiras degradam de formas
 * particularmente traiçoeiras: contar não-lida no canal aberto produz um badge
 * que nunca zera (e a pessoa aprende a ignorar o badge), e reordenar a member
 * list a cada evento de presença produz jank que só aparece em servidor grande
 * — invisível em desenvolvimento, exatamente como diz o briefing.
 */

const GERAL = "01JQ0000000000000000000010";
const LINKS = "01JQ0000000000000000000011";

/**
 * A fila de rAF NÃO é zerada entre testes — e isso é a correção, não o
 * descuido.
 *
 * O `flushHandle` do adapter é module-level e sobrevive ao teste que o
 * agendou. Trocar a fila por uma nova no `beforeEach` dessincroniza os dois:
 * o adapter continua achando que tem um frame pendente, `agendarFlush` vira
 * `??=` sobre um valor definido, e nenhuma publicação seguinte é agendada —
 * o teste seguinte mede um sistema que parou de publicar e conclui que o
 * código está errado.
 *
 * Foi exatamente o que aconteceu ao escrever isto. É a mesma família do erro
 * de linha de base do prepend: quando o instrumento guarda estado, resetar
 * metade dele é pior que não resetar nada.
 */
const pendentes: FrameRequestCallback[] = [];

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    pendentes.push(cb);
    return pendentes.length;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function virarFrame() {
  const fila = pendentes.splice(0, pendentes.length);
  for (const cb of fila) cb(0);
}

/** Assinar é o que faz o snapshot existir — o store não guarda o que ninguém vê. */
function assinar(
  store: { subscriber(id: string): (l: () => void) => () => void },
  id: string,
) {
  const notificado = vi.fn();
  store.subscriber(id)(notificado);
  return notificado;
}

let contador = 0;

function falar(channelId: string, conteudo = "oi") {
  const id = `01JQ000000000000000009${String(contador++).padStart(4, "0")}`;
  client.messages.getOrCreate(
    id,
    { _id: id, channel: channelId, author: "01JQ0000000000000001000005", content: conteudo },
    true,
  );
  return id;
}

describe("não-lidas", () => {
  beforeEach(async () => {
    await seed(4);
    // Zera o que corridas anteriores dentro do mesmo arquivo deixaram.
    for (const id of [CHANNEL_ID, GERAL, LINKS]) marcarCanalLido(id);
  });

  it("canal ABERTO nunca acumula", () => {
    assinar(channels, CHANNEL_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(CHANNEL_ID);
    falar(CHANNEL_ID);

    expect(channels.peek(CHANNEL_ID)?.naoLidas).toBe(0);
  });

  it("canal fechado acumula, e o servidor soma", () => {
    assinar(channels, GERAL);
    assinar(servers, SERVER_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL);
    falar(GERAL);

    expect(channels.peek(GERAL)?.naoLidas).toBe(2);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);
  });

  it("abrir o canal zera ele E baixa o total do servidor", () => {
    assinar(channels, GERAL);
    assinar(channels, LINKS);
    assinar(servers, SERVER_ID);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL);
    falar(LINKS);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(2);

    definirCanalAberto(GERAL);

    expect(channels.peek(GERAL)?.naoLidas).toBe(0);
    // O outro canal continua não lido — zerar o servidor inteiro ao abrir um
    // canal é o bug clássico deste rollup.
    expect(channels.peek(LINKS)?.naoLidas).toBe(1);
    expect(servers.peek(SERVER_ID)?.naoLidas).toBe(1);
  });

  it("menção conta separado, e só quando é a mim", () => {
    assinar(channels, GERAL);
    definirCanalAberto(CHANNEL_ID);

    falar(GERAL, "assunto qualquer");
    falar(GERAL, "<@01JQ0000000000000001000000> olha isso");

    expect(channels.peek(GERAL)?.naoLidas).toBe(2);
    expect(channels.peek(GERAL)?.mencoes).toBe(1);
  });
});

describe("member list e presença", () => {
  beforeEach(async () => {
    await seed(4);
    // Drena o que os testes de não-lida deixaram agendado, devolvendo o
    // `flushHandle` do adapter para `undefined`.
    virarFrame();
  });

  it("registro publica os dois baldes de uma vez, sem esperar frame", () => {
    // `registrarServidor` roda no setup do mundo, dentro do `seed`.
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const offline = membrosOffline.peek(SERVER_ID) ?? [];

    expect(online.length).toBeGreaterThan(0);
    expect(offline.length).toBeGreaterThan(0);
    expect(online.length + offline.length).toBe(40);
  });

  it("cada balde sai ordenado por nome", () => {
    const online = membrosOnline.peek(SERVER_ID) ?? [];
    const nomes = online.map((id) => client.users.get(id)?.username ?? "");
    const ordenados = [...nomes].sort((a, b) =>
      new Intl.Collator("pt-BR", { sensitivity: "base" }).compare(a, b),
    );
    expect(nomes).toEqual(ordenados);
  });

  it("presença que NÃO troca de balde não republica a lista", () => {
    const notificado = assinar(membrosOnline, SERVER_ID);
    const alguem = (membrosOnline.peek(SERVER_ID) ?? [])[0]!;
    const user = client.users.get(alguem)!;

    // online → idle → dnd: os três moram no mesmo balde. A member list não
    // tem motivo para reordenar, e é isso que a faz sobreviver ao firehose.
    for (const presenca of ["Idle", "Busy", "Online"] as const) {
      client.users.updateUnderlyingObject(alguem, {
        status: { presence: presenca },
      } as never);
      client.emit("userUpdate", user, {} as never);
    }
    virarFrame();

    expect(notificado).not.toHaveBeenCalled();
  });

  it("trocar de balde republica — uma vez por frame, não por evento", () => {
    const notificado = assinar(membrosOnline, SERVER_ID);
    const antes = (membrosOnline.peek(SERVER_ID) ?? []).length;

    const dois = (membrosOnline.peek(SERVER_ID) ?? []).slice(0, 2);
    for (const id of dois) {
      const user = client.users.get(id)!;
      client.users.updateUnderlyingObject(id, {
        status: { presence: "Invisible" },
      } as never);
      client.emit("userUpdate", user, {} as never);
    }

    // Ainda nada: a publicação espera o frame.
    expect(notificado).not.toHaveBeenCalled();

    virarFrame();

    // Duas saídas, UMA publicação.
    expect(notificado).toHaveBeenCalledTimes(1);
    expect((membrosOnline.peek(SERVER_ID) ?? []).length).toBe(antes - 2);
  });
});
