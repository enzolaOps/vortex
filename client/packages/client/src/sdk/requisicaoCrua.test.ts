import { afterEach, describe, expect, it, vi } from "vitest";

/*
  O motivo de o arquivo existir é o CORPO chegar ao servidor — o `stoat-api`
  manda `{}` em rota que ele não conhece. Então o teste olha o `fetch` de
  verdade, e não um dublê de `client.api`.
*/
vi.mock("./client", () => ({
  client: {
    api: {
      config: { baseURL: "http://api.local", headers: { "X-Session-Token": "tok" } },
    },
  },
}));

const { postarCru } = await import("./requisicaoCrua");

afterEach(() => {
  vi.unstubAllGlobals();
});

function dublarFetch(status: number, corpo: string) {
  const f = vi.fn(() => Promise.resolve(new Response(corpo || null, { status })));
  vi.stubGlobal("fetch", f);
  return f;
}

describe("postarCru", () => {
  it("manda o corpo em JSON, com a sessão e na base da API", async () => {
    const f = dublarFetch(200, JSON.stringify({ ok: 1 }));
    expect(await postarCru("/auth/qr/abc/exchange", { secret: "s" })).toEqual({ ok: 1 });

    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://api.local/auth/qr/abc/exchange");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ secret: "s" }));
    expect(init.headers).toMatchObject({
      "X-Session-Token": "tok",
      "Content-Type": "application/json",
    });
  });

  it("erro lança o TEXTO, como o stoat-api — é o que erros.ts lê", async () => {
    dublarFetch(404, JSON.stringify({ type: "NotFound" }));
    await expect(postarCru("/x", {})).rejects.toBe(JSON.stringify({ type: "NotFound" }));
  });

  it("204 devolve null", async () => {
    dublarFetch(204, "");
    expect(await postarCru("/x", {})).toBeNull();
  });
});
