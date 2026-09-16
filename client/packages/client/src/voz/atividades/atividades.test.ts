import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../sdk/client", () => ({ client: { events: { on: vi.fn() }, api: {} } }));

const { lerMensagemDoHost } = await import("./protocolo");
const {
  assinarOperacoes,
  assinarSessao,
  definirSessao,
  lerRegistro,
  lerSessao,
  limparAtividades,
  TETO_DO_REGISTRO,
} = await import("../../store/atividades");
const { aplicarEventoDeAtividade, operacaoCabe } = await import("../../sdk/atividades");

const SESSAO = {
  _id: "S1",
  channel_id: "C",
  kind: "quadro",
  host: "U",
  started_at: 1,
  ops: [],
};

function op(texto: string, extra: Record<string, unknown> = {}) {
  return {
    type: "ActivityOp",
    channel_id: "C",
    activity_id: "S1",
    op: { user: "U", at: 2, op: texto, ...extra },
  };
}

beforeEach(() => limparAtividades());

describe("host do quadro", () => {
  /*
    A CSP do host só deixa rodar o script pelo HASH. Mudar o script sem
    atualizar o hash não dá erro nenhum no build — o quadro simplesmente abre
    em branco e inerte. Este teste é o que faz a divergência reprovar.

    CRLF é normalizado antes: o analisador de HTML converte quebra de linha
    antes de o navegador calcular o hash, então um checkout no Windows não
    pode mudar a resposta.
  */
  it("o hash da CSP é o do script que está no arquivo", () => {
    const html = readFileSync(
      resolve(__dirname, "../../../public/atividades/quadro.html"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "";
    const hash = createHash("sha256").update(script, "utf8").digest("base64");
    expect(html).toContain(`script-src 'sha256-${hash}'`);
    // E nada de rede: o host não fala com servidor nenhum.
    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/connect-src|<script src=/);
  });
});

describe("mensagens do host", () => {
  it("aceita só as duas formas, com a versão do contrato", () => {
    expect(lerMensagemDoHost({ vortex: 1, tipo: "pronto" })).toEqual({ tipo: "pronto" });
    expect(lerMensagemDoHost({ vortex: 1, tipo: "op", op: "{}", snapshot: true })).toEqual({
      tipo: "op",
      op: "{}",
      snapshot: true,
    });
    expect(lerMensagemDoHost({ tipo: "pronto" })).toBeUndefined();
    expect(lerMensagemDoHost({ vortex: 1, tipo: "enviarMensagem", texto: "oi" })).toBeUndefined();
    expect(lerMensagemDoHost({ vortex: 1, tipo: "op", op: 42 })).toBeUndefined();
    expect(lerMensagemDoHost("op")).toBeUndefined();
  });

  it("recusa operação acima do teto do servidor, em BYTES", () => {
    expect(lerMensagemDoHost({ vortex: 1, tipo: "op", op: "a".repeat(4096) })).toBeDefined();
    // 2 bytes por caractere: 2049 × 2 passa de 4096 com menos de 4096 caracteres.
    expect(lerMensagemDoHost({ vortex: 1, tipo: "op", op: "é".repeat(2049) })).toBeUndefined();
    expect(operacaoCabe("é".repeat(2049))).toBe(false);
  });
});

describe("store de atividades", () => {
  it("ActivityUpdate abre e fecha a sessão do canal", () => {
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: SESSAO });
    expect(lerSessao("C")).toMatchObject({ id: "S1", tipo: "quadro", anfitriao: "U" });
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: null });
    expect(lerSessao("C")).toBeUndefined();
  });

  it("a MESMA sessão chegando de novo não zera o registro nem acorda ninguém", () => {
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: SESSAO });
    aplicarEventoDeAtividade(op("a"));
    const acordou = vi.fn();
    assinarSessao("C")(acordou);
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: SESSAO });
    expect(acordou).not.toHaveBeenCalled();
    expect(lerRegistro("C").map((o) => o.op)).toEqual(["a"]);
  });

  it("operação vai para o fluxo SEM republicar a sessão", () => {
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: SESSAO });
    const sessao = vi.fn();
    const fluxo = vi.fn();
    assinarSessao("C")(sessao);
    assinarOperacoes("C", fluxo);
    aplicarEventoDeAtividade(op("traço"));
    expect(fluxo).toHaveBeenCalledTimes(1);
    expect(sessao).not.toHaveBeenCalled();
  });

  it("operação de sessão encerrada não cai na seguinte", () => {
    definirSessao("C", { id: "S2", channelId: "C", tipo: "quadro", anfitriao: "U", iniciadaEm: 1 });
    aplicarEventoDeAtividade(op("atrasada"));
    expect(lerRegistro("C")).toEqual([]);
  });

  it("snapshot substitui o registro, e o registro tem teto", () => {
    aplicarEventoDeAtividade({ type: "ActivityUpdate", channel_id: "C", activity: SESSAO });
    for (let i = 0; i < TETO_DO_REGISTRO + 10; i++) aplicarEventoDeAtividade(op(String(i)));
    expect(lerRegistro("C")).toHaveLength(TETO_DO_REGISTRO);
    expect(lerRegistro("C")[0]!.op).toBe("10");
    aplicarEventoDeAtividade(op("limpo", { snapshot: true }));
    expect(lerRegistro("C").map((o) => o.op)).toEqual(["limpo"]);
  });
});
