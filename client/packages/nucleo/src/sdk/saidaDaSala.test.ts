import { afterEach, describe, expect, it, vi } from "vitest";

const postarCru = vi.fn<(caminho: string, corpo: unknown) => Promise<unknown>>();
vi.mock("./requisicaoCrua", () => ({
  postarCru: (c: string, b: unknown) => postarCru(c, b),
}));

const { avisarSaidaDaSala } = await import("./saidaDaSala");

afterEach(() => {
  postarCru.mockReset();
  vi.useRealTimers();
});

describe("avisarSaidaDaSala", () => {
  it("chama a rota de saída do canal", async () => {
    postarCru.mockResolvedValue(null);
    await avisarSaidaDaSala("01CANAL");
    expect(postarCru).toHaveBeenCalledWith("/channels/01CANAL/leave_call", undefined);
  });

  it("falha da rota não lança — a desconexão segue", async () => {
    postarCru.mockRejectedValue("boom");
    await expect(avisarSaidaDaSala("01CANAL")).resolves.toBeUndefined();
  });

  it("servidor pendurado não prende a saída", async () => {
    vi.useFakeTimers();
    postarCru.mockReturnValue(new Promise(() => undefined));
    const p = avisarSaidaDaSala("01CANAL", 500);
    await vi.advanceTimersByTimeAsync(500);
    await expect(p).resolves.toBeUndefined();
  });

  it("sem canal não chama nada", async () => {
    await avisarSaidaDaSala("");
    expect(postarCru).not.toHaveBeenCalled();
  });
});
