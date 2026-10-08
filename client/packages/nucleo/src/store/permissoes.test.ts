import { describe, expect, it, vi } from "vitest";

import { assinarPermissoes, notificarMudancaDePermissoes } from "./permissoes";

describe("permissões como sinal", () => {
  it("avisa quem assina e para de avisar quem saiu", () => {
    const a = vi.fn();
    const b = vi.fn();
    const sairA = assinarPermissoes(a);
    const sairB = assinarPermissoes(b);
    notificarMudancaDePermissoes();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 1]);
    sairA();
    notificarMudancaDePermissoes();
    expect([a.mock.calls.length, b.mock.calls.length]).toEqual([1, 2]);
    sairB();
  });

  it("sair durante o aviso não derruba os outros ouvintes", () => {
    const b = vi.fn();
    const sairA = assinarPermissoes(() => sairA());
    const sairB = assinarPermissoes(b);
    expect(() => notificarMudancaDePermissoes()).not.toThrow();
    expect(b).toHaveBeenCalledTimes(1);
    sairB();
  });
});
