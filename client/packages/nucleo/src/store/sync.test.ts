import { afterEach, describe, expect, it } from "vitest";

import { aplicarRemoto, avisarSync, decisao, ligarEnvio } from "./sync";

afterEach(() => ligarEnvio(() => {}));

describe("decisao", () => {
  it("servidor mais novo aplica, mais velho reenvia, igual ignora", () => {
    expect(decisao(2, 1)).toBe("aplicar");
    expect(decisao(1, 2)).toBe("enviar");
    expect(decisao(1, 1)).toBe("ignorar");
  });
});

describe("eco", () => {
  it("aplicarRemoto não dispara envio", () => {
    const vistos: string[] = [];
    ligarEnvio((chave) => vistos.push(chave));
    aplicarRemoto(() => avisarSync("vortex:densidade", "compacto"));
    expect(vistos).toEqual([]);
    avisarSync("vortex:densidade", "compacto");
    expect(vistos).toEqual(["vortex:densidade"]);
  });
});
