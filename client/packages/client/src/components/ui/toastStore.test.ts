import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarToasts,
  dispensarToast,
  lerToasts,
  toast,
} from "./toastStore";

/**
 * Store module-level tem estado entre testes. Zerar é responsabilidade do
 * teste, não do store — um `reset()` exportado só para teste seria API que a
 * app pode chamar por engano.
 */
beforeEach(() => {
  for (const t of lerToasts()) dispensarToast(t.id);
});

describe("store de toast", () => {
  it("devolve a mesma referência enquanto nada muda", () => {
    expect(Object.is(lerToasts(), lerToasts())).toBe(true);

    toast({ titulo: "Falha ao enviar", tipo: "erro" });
    expect(Object.is(lerToasts(), lerToasts())).toBe(true);
  });

  it("troca de referência ao disparar", () => {
    const antes = lerToasts();
    toast({ titulo: "Reconectado", tipo: "info" });

    expect(Object.is(antes, lerToasts())).toBe(false);
    expect(lerToasts()).toHaveLength(1);
  });

  it("não acorda ninguém ao dispensar id inexistente", () => {
    const ouvinte = vi.fn();
    assinarToasts(ouvinte);

    dispensarToast("nao-existe");

    // Avisar à toa é re-render à toa, e num app aberto 8h isso acumula.
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("volta à referência constante quando esvazia", () => {
    const vazioInicial = lerToasts();
    const id = toast({ titulo: "Algo", tipo: "info" });
    dispensarToast(id);

    // Sem isto, esvaziar alocaria um array novo a cada vez e o loop de render
    // voltaria por uma porta lateral.
    expect(Object.is(vazioInicial, lerToasts())).toBe(true);
  });

  it("preserva a ordem de chegada", () => {
    toast({ titulo: "primeiro", tipo: "info" });
    toast({ titulo: "segundo", tipo: "info" });

    expect(lerToasts().map((t) => t.titulo)).toEqual(["primeiro", "segundo"]);
  });
});
