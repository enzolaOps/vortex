import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../sdk/client", () => ({ client: { events: { on: vi.fn() }, api: {} } }));

const {
  definirPolitica,
  lerPolitica,
  limparFiltroDeMidia,
  politicaDoProtocolo,
  politicaParaProtocolo,
  precisaVerificar,
  assinarPolitica,
} = await import("./filtroDeMidia");
const { aplicarEventoDeFiltro } = await import("../sdk/filtroDeMidia");

beforeEach(() => limparFiltroDeMidia());

describe("precisaVerificar", () => {
  it("desligado nunca vela", () => {
    expect(precisaVerificar("nao", [], false)).toBe(false);
  });

  it("sem cargo vela só quem não tem cargo", () => {
    expect(precisaVerificar("semCargo", [], false)).toBe(true);
    expect(precisaVerificar("semCargo", undefined, false)).toBe(true);
    expect(precisaVerificar("semCargo", ["mod"], false)).toBe(false);
  });

  it("todos vela inclusive quem tem cargo", () => {
    expect(precisaVerificar("todos", ["mod"], false)).toBe(true);
  });

  it("a própria mídia nunca chega velada", () => {
    expect(precisaVerificar("todos", [], true)).toBe(false);
  });
});

describe("tradução do protocolo", () => {
  it("ida e volta, e desconhecido é desligado", () => {
    for (const p of ["nao", "semCargo", "todos"] as const) {
      expect(politicaDoProtocolo(politicaParaProtocolo(p))).toBe(p);
    }
    expect(politicaDoProtocolo("QualquerCoisa")).toBe("nao");
    expect(politicaDoProtocolo(undefined)).toBe("nao");
  });
});

describe("eventos crus", () => {
  it("Ready semeia todos os servidores", () => {
    aplicarEventoDeFiltro({
      type: "Ready",
      servers: [
        { _id: "a", explicit_content_filter: "AllMembers" },
        { _id: "b" },
      ],
    });
    expect(lerPolitica("a")).toBe("todos");
    expect(lerPolitica("b")).toBe("nao");
  });

  it("ServerUpdate sem o campo NÃO zera o filtro", () => {
    definirPolitica("a", "semCargo");
    aplicarEventoDeFiltro({ type: "ServerUpdate", id: "a", data: { name: "novo" } });
    expect(lerPolitica("a")).toBe("semCargo");
    aplicarEventoDeFiltro({
      type: "ServerUpdate",
      id: "a",
      data: { explicit_content_filter: "Disabled" },
    });
    expect(lerPolitica("a")).toBe("nao");
  });

  it("acorda só quem assina o servidor que mudou", () => {
    const deA = vi.fn();
    const deB = vi.fn();
    assinarPolitica("a")(deA);
    assinarPolitica("b")(deB);
    definirPolitica("a", "todos");
    expect(deA).toHaveBeenCalledTimes(1);
    expect(deB).not.toHaveBeenCalled();
    // A mesma função de assinatura por chave — referência estável para o React.
    expect(assinarPolitica("a")).toBe(assinarPolitica("a"));
  });
});
