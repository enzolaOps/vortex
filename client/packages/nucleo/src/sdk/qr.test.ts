import { beforeEach, describe, expect, it, vi } from "vitest";

/*
  O lado de protocolo do QR, com o `client` dublado.

  O que importa não é a forma da chamada — é o que cada resposta VIRA na tela:
  `Pending` continua perguntando, `NotFound` pede código novo (e não mostra
  erro), e `Success` conclui pelo MESMO caminho do login por senha, que é o
  único que chama `connect()`.
*/
const api = { post: vi.fn(), get: vi.fn(), delete: vi.fn() };
const concluir = vi.fn();
/* Rota do fork com corpo não passa por `client.api` — ver `requisicaoCrua.ts`. */
const cru = vi.fn();

vi.mock("./client", () => ({ client: { api } }));
vi.mock("./autenticacao", () => ({ concluirEntradaPorQr: concluir }));
vi.mock("./requisicaoCrua", () => ({ postarCru: cru }));

const { autorizarQr, pedirQr, recusarQr, trocarQr, verPedidoDeQr } = await import("./qr");

const PEDIDO = { id: "abc", segredo: "s3gr3do", codigo: "123456", expiraEm: 1 };
const NAO_EXISTE = JSON.stringify({ type: "NotFound", location: "x" });

beforeEach(() => {
  api.post.mockReset();
  api.get.mockReset();
  api.delete.mockReset();
  concluir.mockReset();
  cru.mockReset();
});

describe("pedirQr", () => {
  it("traduz a resposta e nunca manda o segredo de volta", async () => {
    cru.mockResolvedValue({ id: "abc", secret: "s", code: "654321", expires_at: 9 });
    expect(await pedirQr()).toEqual({ id: "abc", segredo: "s", codigo: "654321", expiraEm: 9 });
    expect(cru).toHaveBeenCalledWith("/auth/qr/create", {
      friendly_name: "Vortex (web · QR)",
    });
  });
});

describe("trocarQr", () => {
  it("manda o segredo no corpo, nunca na URL", async () => {
    cru.mockResolvedValue({ result: "Pending" });
    await trocarQr(PEDIDO);
    const [caminho, corpo] = cru.mock.calls[0] as unknown[];
    expect(caminho).toBe("/auth/qr/abc/exchange");
    expect(String(caminho)).not.toContain(PEDIDO.segredo);
    expect(corpo).toEqual({ secret: PEDIDO.segredo });
  });

  it("Pending continua perguntando e não conclui", async () => {
    cru.mockResolvedValue({ result: "Pending" });
    expect(await trocarQr(PEDIDO)).toBe("pendente");
    expect(concluir).not.toHaveBeenCalled();
  });

  it("Success conclui pelo caminho do login", async () => {
    const sessao = { result: "Success", _id: "s", token: "t", user_id: "u" };
    cru.mockResolvedValue(sessao);
    expect(await trocarQr(PEDIDO)).toBe("concluida");
    expect(concluir).toHaveBeenCalledWith(sessao);
  });

  it("NotFound vira expirado, e não erro", async () => {
    cru.mockRejectedValue(NAO_EXISTE);
    expect(await trocarQr(PEDIDO)).toBe("expirado");
  });

  it("falha de rede sobe — ela não é um código vencido", async () => {
    cru.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(trocarQr(PEDIDO)).rejects.toThrow();
  });
});

describe("lado de quem autoriza", () => {
  it("pedido vencido é ausência", async () => {
    api.get.mockRejectedValue(NAO_EXISTE);
    expect(await verPedidoDeQr("abc")).toBeUndefined();
  });

  it("traduz o pedido", async () => {
    api.get.mockResolvedValue({ name: "Vortex (web · QR)", code: "111222", expires_at: 5 });
    expect(await verPedidoDeQr("abc")).toEqual({
      nome: "Vortex (web · QR)",
      codigo: "111222",
      expiraEm: 5,
    });
  });

  it("autorizar e recusar batem nas rotas certas", async () => {
    api.post.mockResolvedValue(undefined);
    api.delete.mockResolvedValue(undefined);
    await autorizarQr("abc");
    await recusarQr("abc");
    expect(api.post).toHaveBeenCalledWith("/auth/qr/abc/approve");
    expect(api.delete).toHaveBeenCalledWith("/auth/qr/abc");
  });
});
