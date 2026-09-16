import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { base64UrlParaBytes, bytesParaBase64Url } from "./push";

/**
 * O service worker de push, rodado DE VERDADE numa sandbox.
 *
 * Ele é JS cru em `public/` (a razão está no próprio arquivo), então não entra
 * no `tsc` nem no bundle — e sem este teste seria o único código do app que
 * ninguém executa antes de um celular receber a primeira notificação. Aqui o
 * arquivo servido é lido do disco e avaliado com um `self` falso: o teste mede
 * o artefato, não uma cópia da lógica.
 */

type Ouvinte = (evento: unknown) => void;

function carregarWorker() {
  const ouvintes = new Map<string, Ouvinte>();
  const mostradas: { titulo: string; opcoes: Record<string, unknown> }[] = [];
  const janelas: { postMessage: ReturnType<typeof vi.fn>; focus: ReturnType<typeof vi.fn> }[] = [];
  const openWindow = vi.fn(() => Promise.resolve());

  const self = {
    addEventListener: (tipo: string, fn: Ouvinte) => ouvintes.set(tipo, fn),
    skipWaiting: vi.fn(),
    registration: {
      showNotification: (titulo: string, opcoes: Record<string, unknown>) => {
        mostradas.push({ titulo, opcoes });
        return Promise.resolve();
      },
    },
    clients: {
      claim: () => Promise.resolve(),
      matchAll: () => Promise.resolve(janelas),
      openWindow,
    },
  };

  const codigo = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
  runInNewContext(codigo, { self, JSON });

  async function push(dados: unknown) {
    let espera: Promise<unknown> = Promise.resolve();
    ouvintes.get("push")!({
      data: { text: () => JSON.stringify(dados) },
      waitUntil: (p: Promise<unknown>) => (espera = p),
    });
    await espera;
    return mostradas.at(-1);
  }

  async function clicar(caminho: string) {
    let espera: Promise<unknown> = Promise.resolve();
    ouvintes.get("notificationclick")!({
      notification: { close: vi.fn(), data: { caminho } },
      waitUntil: (p: Promise<unknown>) => (espera = p),
    });
    await espera;
  }

  return { push, clicar, janelas, openWindow };
}

let w: ReturnType<typeof carregarWorker>;

beforeEach(() => {
  w = carregarWorker();
});

const S = "01JQ0000000000000000000001";
const C = "01JQ0000000000000000000010";
const M = "01JQ0000000000000000000099";

describe("push de mensagem", () => {
  it("canal de servidor: 'autor em #canal' e destino com a mensagem", async () => {
    const n = await w.push({
      author: "zola",
      body: "olha isso",
      tag: C,
      channel: { _id: C, channel_type: "TextChannel", name: "geral", server: S },
      message: { _id: M },
    });
    expect(n?.titulo).toBe("zola em #geral");
    expect(n?.opcoes.body).toBe("olha isso");
    expect(n?.opcoes.tag).toBe(C);
    /* A `url` do servidor é a rota do upstream — não pode ser usada. */
    expect(n?.opcoes.data).toEqual({ caminho: `/servidor/${S}/canal/${C}/${M}` });
  });

  it("DM: só o autor, e destino na conversa", async () => {
    const n = await w.push({
      author: "bea.t",
      body: "oi",
      url: "https://x/channel/abc/def",
      channel: { _id: C, channel_type: "DirectMessage" },
      message: { _id: M },
    });
    expect(n?.titulo).toBe("bea.t");
    expect(n?.opcoes.data).toEqual({ caminho: `/dm/${C}` });
  });

  it("grupo: 'autor em nome'", async () => {
    const n = await w.push({
      author: "téo",
      body: "bora",
      channel: { _id: C, channel_type: "Group", name: "time" },
    });
    expect(n?.titulo).toBe("téo em time");
  });
});

describe("push que não é mensagem", () => {
  it("pedido de amizade chega traduzido, com o texto do design", async () => {
    const n = await w.push({ body: "bea.t sent you a friend request" });
    expect(n?.titulo).toBe("bea.t");
    expect(n?.opcoes.body).toBe("enviou um pedido de amizade");
    expect(n?.opcoes.data).toEqual({ caminho: "/amigos/pedidos" });
  });

  it("aceite", async () => {
    const n = await w.push({ body: "bea.t accepted your friend request" });
    expect(n?.opcoes.body).toBe("aceitou seu pedido de amizade");
  });

  it("frase desconhecida passa como veio, em vez de sumir", async () => {
    const n = await w.push({ title: "Aviso", body: "algo novo" });
    expect(n).toMatchObject({ titulo: "Aviso", opcoes: { body: "algo novo" } });
  });
});

describe("clique", () => {
  it("com aba aberta, manda o caminho e foca — sem recarregar", async () => {
    const janela = { postMessage: vi.fn(), focus: vi.fn(() => Promise.resolve()) };
    w.janelas.push(janela);
    await w.clicar(`/dm/${C}`);
    expect(janela.postMessage).toHaveBeenCalledWith({ tipo: "vortex:abrir", caminho: `/dm/${C}` });
    expect(janela.focus).toHaveBeenCalled();
    expect(w.openWindow).not.toHaveBeenCalled();
  });

  it("sem aba, abre uma já no destino", async () => {
    await w.clicar("/amigos/pedidos");
    expect(w.openWindow).toHaveBeenCalledWith("/amigos/pedidos");
  });
});

describe("chaves em base64url", () => {
  it("ida e volta sem preenchimento nem + e /", () => {
    const bytes = new Uint8Array([251, 255, 0, 62, 63, 128, 7]);
    const texto = bytesParaBase64Url(bytes.buffer);
    expect(texto).not.toMatch(/[+/=]/);
    expect([...base64UrlParaBytes(texto)]).toEqual([...bytes]);
  });
});
