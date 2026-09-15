import { describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({ client: { api: {} } }));
vi.mock("./config", () => ({ API_URL: "http://api.local" }));

const { descreverExportacao, traduzirExportacao } = await import("./exportacao");

const HORA = 60 * 60 * 1000;

function corpo(extra: Record<string, unknown>) {
  return traduzirExportacao({
    state: "Ready",
    messages: 1234,
    next_request_at: 24 * HORA,
    expires_at: 48 * HORA,
    size: 3_200_000,
    download: "t".repeat(48),
    emailed: false,
    ...extra,
  } as never);
}

describe("traduzirExportacao", () => {
  it("monta o link com o nome do arquivo no fim", () => {
    expect(corpo({}).link).toBe(
      `http://api.local/auth/export/download/${"t".repeat(48)}/vortex-dados.zip`,
    );
  });

  it("sem Ready não há link, mesmo que o token venha", () => {
    expect(corpo({ state: "Running" }).link).toBeUndefined();
    expect(corpo({ state: "Running" }).fase).toBe("gerando");
  });
});

describe("descreverExportacao", () => {
  it("nunca pediu: solicitar", () => {
    expect(descreverExportacao(null, 0).acao).toBe("solicitar");
  });

  it("na fila e gerando: botão ocupado, com a contagem", () => {
    expect(descreverExportacao(corpo({ state: "Queued" }), 0).acao).toBe("gerando");
    const g = descreverExportacao(corpo({ state: "Running" }), 0);
    expect(g.acao).toBe("gerando");
    expect(g.detalhe).toContain("1.234");
  });

  it("pronta e dentro da validade: baixar, com o peso", () => {
    const d = descreverExportacao(corpo({ emailed: true }), HORA);
    expect(d.acao).toBe("baixar");
    expect(d.detalhe).toContain("3,2 MB");
    expect(d.detalhe).toContain("enviado por e-mail");
  });

  it("link vencido e pedido novo ainda travado: aguardar", () => {
    const e = corpo({ expires_at: 2 * HORA, next_request_at: 10 * HORA });
    expect(descreverExportacao(e, 5 * HORA).acao).toBe("aguardar");
  });

  it("link vencido e intervalo cumprido: solicitar de novo", () => {
    const e = corpo({ expires_at: 2 * HORA, next_request_at: 3 * HORA });
    expect(descreverExportacao(e, 5 * HORA).acao).toBe("solicitar");
  });

  it("falhou: solicitar de novo na hora", () => {
    expect(descreverExportacao(corpo({ state: "Failed" }), 0).acao).toBe("solicitar");
  });
});
