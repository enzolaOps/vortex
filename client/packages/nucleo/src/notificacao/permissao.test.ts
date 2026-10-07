import { afterEach, describe, expect, it, vi } from "vitest";

import { conviteVisivel, dispensarConvite, lerPermissao, pedirPermissao } from "./permissao";

function fingirNotification(permission: NotificationPermission, aoPedir?: () => NotificationPermission) {
  vi.stubGlobal("Notification", {
    permission,
    requestPermission: vi.fn(() => {
      const nova = aoPedir?.() ?? permission;
      (Notification as unknown as { permission: string }).permission = nova;
      return Promise.resolve(nova);
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("permissão de avisos", () => {
  it("sem Notification no ambiente, é indisponível e nada é oferecido", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(lerPermissao()).toBe("indisponivel");
    expect(conviteVisivel()).toBe(false);
    expect(await pedirPermissao()).toBe("indisponivel");
  });

  it("traduz o estado do navegador", () => {
    fingirNotification("default");
    expect(lerPermissao()).toBe("pergunta");
    fingirNotification("granted");
    expect(lerPermissao()).toBe("concedida");
    fingirNotification("denied");
    expect(lerPermissao()).toBe("negada");
  });

  it("só convida enquanto a pergunta está aberta e a pessoa não dispensou", () => {
    const mem = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => mem.set(k, v),
    });
    fingirNotification("default");
    expect(conviteVisivel()).toBe(true);
    dispensarConvite();
    expect(conviteVisivel()).toBe(false);
    mem.clear();
    fingirNotification("granted");
    expect(conviteVisivel()).toBe(false);
  });

  it("pedir devolve o que o navegador respondeu", async () => {
    fingirNotification("default", () => "granted");
    expect(await pedirPermissao()).toBe("concedida");
    fingirNotification("default", () => "denied");
    expect(await pedirPermissao()).toBe("negada");
  });
});
