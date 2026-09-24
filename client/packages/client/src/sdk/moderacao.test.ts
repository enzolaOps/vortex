import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Moderação: o que vai ao fio, com o `client` dublado.
 *
 * As três armadilhas são de FORMA e nenhuma dá erro: motivo com acento que o
 * `fetch` recusa ou o servidor lê quebrado, `delete_message_seconds` que some
 * do corpo, e um lote que para na primeira falha.
 */

type Chamada = { caminho: string; corpo: unknown; config: { headers: Record<string, string> } };

const chamadas: { metodo: string; c: Chamada }[] = [];
const falhar = new Set<string>();

function registrar(metodo: string) {
  return vi.fn((caminho: string, corpo: unknown, config: Chamada["config"]) => {
    chamadas.push({ metodo, c: { caminho, corpo, config } });
    if ([...falhar].some((u) => caminho.endsWith(`/${u}`))) {
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- o stoat-api lança o TEXTO
      return Promise.reject('{"type":"NotElevated"}');
    }
    return Promise.resolve(null);
  });
}

const client = {
  api: {
    delete: registrar("delete"),
    put: registrar("put"),
    patch: registrar("patch"),
    post: registrar("post"),
    get: vi.fn((caminho: string) => {
      const userId = caminho.split("/")[2] ?? "";
      if (falhar.has(userId)) {
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- o stoat-api lança o TEXTO
        return Promise.reject('{"type":"PrivacyRestricted"}');
      }
      return Promise.resolve({ _id: `dm-${userId}` });
    }),
  },
};

vi.mock("./client", () => ({ client, conectado: () => true }));

const {
  avisarPorDmEmLote,
  banirEmLote,
  cabecalhoDeMotivo,
  castigarEmLote,
  expulsarEmLote,
} = await import("./moderacao");

/** O que o servidor lê: os bytes do cabeçalho decodificados como UTF-8. */
function comoOServidorLe(byteString: string): string {
  const bytes = Uint8Array.from(byteString, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

beforeEach(() => {
  chamadas.length = 0;
  falhar.clear();
});

describe("cabeçalho de auditoria", () => {
  it("sem motivo não manda cabeçalho", () => {
    expect(cabecalhoDeMotivo(undefined)).toEqual({});
    expect(cabecalhoDeMotivo("   \n ")).toEqual({});
  });

  it("acento e emoji chegam ao servidor como o texto escrito", () => {
    const motivo = "Divulgação repetida — spam 🚫";
    const valor = cabecalhoDeMotivo(motivo)["X-Audit-Log-Reason"] ?? "";
    /* Byte-string: nenhum caractere acima de 0xFF, senão o `fetch` lança. */
    expect([...valor].every((c) => c.charCodeAt(0) <= 0xff)).toBe(true);
    expect(comoOServidorLe(valor)).toBe(motivo);
  });

  it("quebra de linha vira espaço", () => {
    const valor = cabecalhoDeMotivo("linha um\r\nlinha dois")["X-Audit-Log-Reason"] ?? "";
    expect(comoOServidorLe(valor)).toBe("linha um linha dois");
  });

  it("corta em 512 bytes sem partir caractere", () => {
    const valor = cabecalhoDeMotivo("ç".repeat(400))["X-Audit-Log-Reason"] ?? "";
    expect(valor.length).toBeLessThanOrEqual(512);
    /* `fatal: true` lança se o corte deixou um multibyte pela metade. */
    expect(comoOServidorLe(valor)).toBe("ç".repeat(256));
  });
});

describe("chamadas", () => {
  it("banir manda motivo no corpo e no cabeçalho, e a janela de exclusão", async () => {
    await banirEmLote("S", ["A"], { motivo: "spam", excluirMensagensDe: 86_400 });
    expect(chamadas).toHaveLength(1);
    const { metodo, c } = chamadas[0]!;
    expect(metodo).toBe("put");
    expect(c.caminho).toBe("/servers/S/bans/A");
    expect(c.corpo).toEqual({ reason: "spam", delete_message_seconds: 86_400 });
    expect(c.config.headers).toEqual({ "X-Audit-Log-Reason": "spam" });
  });

  it("banir sem motivo nem janela manda corpo vazio e nenhum cabeçalho", async () => {
    await banirEmLote("S", ["A"], { excluirMensagensDe: 0 });
    expect(chamadas[0]!.c.corpo).toEqual({});
    expect(chamadas[0]!.c.config.headers).toEqual({});
  });

  it("expulsar é DELETE no membro, com o motivo no cabeçalho", async () => {
    await expulsarEmLote("S", ["A"], { motivo: "regra 3" });
    const { metodo, c } = chamadas[0]!;
    expect(metodo).toBe("delete");
    expect(c.caminho).toBe("/servers/S/members/A");
    expect(c.config.headers).toEqual({ "X-Audit-Log-Reason": "regra 3" });
  });

  it("castigo é PATCH com o instante, e 0 minutos tira o castigo", async () => {
    const antes = Date.now();
    await castigarEmLote("S", ["A"], { minutos: 60, motivo: "calma" });
    const corpo = chamadas[0]!.c.corpo as { timeout: string };
    expect(chamadas[0]!.metodo).toBe("patch");
    expect(Date.parse(corpo.timeout) - antes).toBeGreaterThanOrEqual(60 * 60_000 - 1000);
    expect(chamadas[0]!.c.config.headers).toEqual({ "X-Audit-Log-Reason": "calma" });

    await castigarEmLote("S", ["A"], { minutos: 0 });
    expect(chamadas[1]!.c.corpo).toEqual({ remove: ["Timeout"] });
  });
});

describe("lote", () => {
  it("uma falha não derruba as outras, e as falhas saem na ordem da entrada", async () => {
    falhar.add("B");
    falhar.add("D");
    const progresso: number[] = [];
    const r = await expulsarEmLote("S", ["A", "B", "C", "D"], {}, (t) => {
      progresso.push(t);
    });
    expect(chamadas).toHaveLength(4);
    expect(r.feitos).toEqual(["A", "C"]);
    expect(r.falhas.map((f) => f.item)).toEqual(["B", "D"]);
    expect(r.falhas[0]!.motivo).not.toBe("");
    expect(progresso.at(-1)).toBe(4);
  });
});

describe("avisar por DM", () => {
  it("abre a conversa e manda o texto no canal DELA", async () => {
    const r = await avisarPorDmEmLote(["u1", "u2"], "Você está de castigo.");
    expect(r.falhas).toEqual([]);
    const posts = chamadas.filter((c) => c.metodo === "post").map((c) => c.c);
    expect(posts.map((p) => p.caminho).sort()).toEqual([
      "/channels/dm-u1/messages",
      "/channels/dm-u2/messages",
    ]);
    expect(posts[0]?.corpo).toEqual({ content: "Você está de castigo." });
  });

  it("quem não aceita DM falha sozinho, sem mensagem e sem derrubar os outros", async () => {
    falhar.add("u2");
    const r = await avisarPorDmEmLote(["u1", "u2", "u3"], "x");
    expect(r.falhas.map((f) => f.item)).toEqual(["u2"]);
    const destinos = chamadas.filter((c) => c.metodo === "post").map((c) => c.c.caminho);
    expect(destinos).not.toContain("/channels/dm-u2/messages");
    expect(destinos).toHaveLength(2);
  });
});
