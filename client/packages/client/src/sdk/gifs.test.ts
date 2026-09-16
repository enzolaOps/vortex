import { afterEach, describe, expect, it, vi } from "vitest";

import { dublarProvedorDeGif, fonteDeGifs } from "./fonteDeGifs";
import {
  criarProvedorGifbox,
  provedorDaFonte,
  traduzirPagina,
  type ProvedorDeGif,
} from "./gifs";

/* O que o seletor faz ao montar. */
const provedorDeGif = () => provedorDaFonte(fonteDeGifs());

const semProxy = (u: string) => u;

function item(over: Record<string, unknown> = {}) {
  return {
    id: "g1",
    url: "https://tenor.com/view/oi-g1",
    media_formats: {
      webm: { url: "https://media.tenor.com/g1.webm", dimensions: [498, 280] },
      tinywebm: { url: "https://media.tenor.com/g1-tiny.webm", dimensions: [220, 124] },
    },
    ...over,
  };
}

describe("traduzirPagina", () => {
  it("usa a prévia pequena e as dimensões dela", () => {
    const p = traduzirPagina({ results: [item()], next: "30" }, semProxy);
    expect(p.gifs).toEqual([
      {
        id: "g1",
        url: "https://tenor.com/view/oi-g1",
        previa: "https://media.tenor.com/g1-tiny.webm",
        largura: 220,
        altura: 124,
      },
    ]);
    expect(p.proxima).toBe("30");
  });

  it("cai no webm quando não há o pequeno", () => {
    const p = traduzirPagina(
      {
        results: [
          item({
            media_formats: {
              webm: { url: "https://media.tenor.com/g1.webm", dimensions: [498, 280] },
            },
          }),
        ],
      },
      semProxy,
    );
    expect(p.gifs[0]?.previa).toBe("https://media.tenor.com/g1.webm");
    expect(p.gifs[0]?.largura).toBe(498);
  });

  it("descarta o item incompleto sem derrubar os outros", () => {
    const p = traduzirPagina(
      {
        results: [
          item({ id: "sem-formato", media_formats: {} }),
          item({
            id: "sem-dimensao",
            media_formats: { tinywebm: { url: "x", dimensions: [] } },
          }),
          item({
            id: "dimensao-zero",
            media_formats: { tinywebm: { url: "x", dimensions: [0, 10] } },
          }),
          item({ id: 7 }),
          item({ id: "bom" }),
        ],
      },
      semProxy,
    );
    expect(p.gifs.map((g) => g.id)).toEqual(["bom"]);
  });

  it("cursor vazio é fim, não uma página a mais", () => {
    expect(traduzirPagina({ results: [], next: "" }, semProxy).proxima).toBeUndefined();
    expect(traduzirPagina(null, semProxy)).toEqual({ gifs: [], proxima: undefined });
  });
});

describe("criarProvedorGifbox", () => {
  function resposta(corpo: unknown, ok = true) {
    return { ok, status: ok ? 200 : 500, json: () => Promise.resolve(corpo) } as Response;
  }

  it("em alta vai a /trending com locale, limite e o token de sessão", async () => {
    const rede = vi.fn(() => Promise.resolve(resposta({ results: [item()] })));
    const p = criarProvedorGifbox({
      base: "https://gif.exemplo",
      proxy: undefined,
      cabecalho: () => ["X-Session-Token", "tok"],
      buscarNaRede: rede,
    });
    await p.buscar({ tipo: "emAlta" }, undefined);
    const [url, init] = rede.mock.calls[0] as unknown as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://gif.exemplo/trending");
    expect(u.searchParams.get("locale")).toBe("pt_BR");
    expect(u.searchParams.get("limit")).toBe("30");
    expect(u.searchParams.has("query")).toBe(false);
    expect(u.searchParams.has("position")).toBe(false);
    expect(init.headers).toEqual({ "X-Session-Token": "tok" });
  });

  it("busca vai a /search com o termo e o cursor", async () => {
    const rede = vi.fn(() => Promise.resolve(resposta({ results: [] })));
    const p = criarProvedorGifbox({
      base: "https://gif.exemplo",
      proxy: undefined,
      cabecalho: () => undefined,
      buscarNaRede: rede,
    });
    await p.buscar({ tipo: "busca", termo: "deu ruim" }, "60");
    const u = new URL((rede.mock.calls[0] as unknown as [string])[0]);
    expect(u.pathname).toBe("/search");
    expect(u.searchParams.get("query")).toBe("deu ruim");
    expect(u.searchParams.get("position")).toBe("60");
  });

  it("a prévia passa pelo january quando a instância o anuncia", async () => {
    const p = criarProvedorGifbox({
      base: "https://gif.exemplo",
      proxy: "https://vortex.exemplo/january",
      cabecalho: () => undefined,
      buscarNaRede: () => Promise.resolve(resposta({ results: [item()] })),
    });
    const pg = await p.buscar({ tipo: "emAlta" }, undefined);
    expect(pg.gifs[0]?.previa).toBe(
      "https://vortex.exemplo/january/proxy?url=" +
        encodeURIComponent("https://media.tenor.com/g1-tiny.webm"),
    );
    // O que vai na mensagem continua sendo o link público, nunca o proxy.
    expect(pg.gifs[0]?.url).toBe("https://tenor.com/view/oi-g1");
  });

  it("resposta de erro lança — o seletor mostra o estado de falha", async () => {
    const p = criarProvedorGifbox({
      base: "https://gif.exemplo",
      proxy: undefined,
      cabecalho: () => undefined,
      buscarNaRede: () => Promise.resolve(resposta({}, false)),
    });
    await expect(p.buscar({ tipo: "emAlta" }, undefined)).rejects.toThrow("500");
  });
});

describe("provedorDeGif", () => {
  afterEach(() => {
    dublarProvedorDeGif(undefined);
    vi.unstubAllEnvs();
  });

  it("sem endereço não há provedor — e nenhuma chamada sai", () => {
    vi.stubEnv("VITE_GIFBOX_URL", "");
    const rede = vi.spyOn(globalThis, "fetch");
    rede.mockClear();
    expect(provedorDeGif()).toBeUndefined();
    expect(rede).not.toHaveBeenCalled();
    rede.mockRestore();
  });

  it("com endereço no build, há provedor", () => {
    vi.stubEnv("VITE_GIFBOX_URL", "https://gif.exemplo/");
    expect(provedorDeGif()).toBeDefined();
  });

  it("o dublê do arnês ganha de tudo", () => {
    vi.stubEnv("VITE_GIFBOX_URL", "");
    const d: ProvedorDeGif = { buscar: () => Promise.resolve({ gifs: [], proxima: undefined }) };
    dublarProvedorDeGif(d);
    expect(provedorDeGif()).toBe(d);
  });
});
