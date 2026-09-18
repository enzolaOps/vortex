import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  alvoDoArraste,
  arrastandoAlguem,
  assinarArrasteDeVoz,
  comecarArrasteDeVoz,
  entrarNoAlvo,
  lerArrasteDeVoz,
  limparArrasteDeVoz,
  sairDoAlvo,
  terminarArrasteDeVoz,
  vereditoDeSoltura,
  vereditoDoAlvo,
} from "./arrasteDeVoz";

const TEO = {
  userId: "01TEO",
  serverId: "01SRV",
  nome: "Téo",
  deCanal: "01SALA",
} as const;

beforeEach(() => {
  limparArrasteDeVoz();
});

describe("o ciclo do arraste", () => {
  it("começa vazio e volta a vazio", () => {
    expect(arrastandoAlguem()).toBe(false);
    comecarArrasteDeVoz(TEO);
    expect(arrastandoAlguem()).toBe(true);
    expect(lerArrasteDeVoz()?.nome).toBe("Téo");
    terminarArrasteDeVoz();
    expect(arrastandoAlguem()).toBe(false);
    expect(alvoDoArraste()).toBe("");
  });

  it("não marca alvo sem arraste em curso", () => {
    entrarNoAlvo("01FOCO", "valido");
    expect(alvoDoArraste()).toBe("");
  });

  it("entrar no MESMO alvo com o mesmo veredito não avisa", () => {
    const ouvinte = vi.fn();
    comecarArrasteDeVoz(TEO);
    assinarArrasteDeVoz(ouvinte);

    entrarNoAlvo("01FOCO", "valido");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    entrarNoAlvo("01FOCO", "valido");
    expect(ouvinte).toHaveBeenCalledTimes(1);
    entrarNoAlvo("01FOCO", "cheio");
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(vereditoDoAlvo()).toBe("cheio");
  });

  it("terminar volta o veredito ao padrão — senão o próximo arraste herda a recusa", () => {
    comecarArrasteDeVoz(TEO);
    entrarNoAlvo("01FOCO", "cheio");
    terminarArrasteDeVoz();
    expect(vereditoDoAlvo()).toBe("valido");
  });

  it("o dragleave atrasado do canal anterior não apaga o novo alvo", () => {
    comecarArrasteDeVoz(TEO);
    entrarNoAlvo("01A", "valido");
    entrarNoAlvo("01B", "valido");
    /* A ordem real do navegador: `dragenter` de B chega antes de `dragleave`
       de A. Sem a guarda, isto apagaria B e o anel piscaria. */
    sairDoAlvo("01A");
    expect(alvoDoArraste()).toBe("01B");

    sairDoAlvo("01B");
    expect(alvoDoArraste()).toBe("");
  });
});

describe("vereditoDeSoltura", () => {
  const base = {
    ocupados: 0,
    limite: undefined,
    podeConectar: true,
    podeMover: true,
  };

  it("sem teto e com as duas permissões, aceita", () => {
    expect(vereditoDeSoltura(base)).toBe("valido");
    expect(vereditoDeSoltura({ ...base, ocupados: 99 })).toBe("valido");
  });

  it("teto zero é 'sem limite' no protocolo, não teto de zero vagas", () => {
    expect(vereditoDeSoltura({ ...base, limite: 0, ocupados: 40 })).toBe("valido");
  });

  it("sala cheia recusa, e a última vaga aceita", () => {
    expect(vereditoDeSoltura({ ...base, limite: 4, ocupados: 3 })).toBe("valido");
    expect(vereditoDeSoltura({ ...base, limite: 4, ocupados: 4 })).toBe("cheio");
    expect(vereditoDeSoltura({ ...base, limite: 4, ocupados: 5 })).toBe("cheio");
  });

  it("permissão ganha de lotação — o motivo mais forte é o que aparece", () => {
    expect(
      vereditoDeSoltura({ ...base, limite: 4, ocupados: 9, podeConectar: false }),
    ).toBe("semPermissao");
    expect(vereditoDeSoltura({ ...base, podeMover: false })).toBe("semPermissao");
  });
});
