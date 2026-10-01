import { beforeEach, describe, expect, it, vi } from "vitest";

import { dispensarToast, lerToasts } from "../components/ui/toastStore";
import type { MensagemRecebida } from "./decidir";
import { avisarFalhaDeEnvio, textoDaFalhaDeEnvio } from "./falhaDeEnvio";
import { avisarNoToast } from "./notificador";

beforeEach(() => {
  for (const t of lerToasts()) dispensarToast(t.id);
});

function mensagem(parcial: Partial<MensagemRecebida> = {}): MensagemRecebida {
  return {
    mensagemId: "01M",
    channelId: "01C",
    serverId: "01S",
    tipoDoCanal: "servidor",
    autorNome: "Marina",
    canalNome: "produto",
    servidorNome: undefined,
    texto: "oi",
    minha: false,
    mencionaVoce: false,
    mencionaTodos: false,
    mencionaCargo: false,
    ...parcial,
  };
}

const SEM_PREVIA = { titulo: "Marina em #produto", corpo: "Nova mensagem" };

describe("toast agregado com prévia desligada (D-NOTIF-23)", () => {
  it("a primeira mensagem sai com o autor e o Abrir", () => {
    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });

    const [t] = lerToasts();
    expect(lerToasts()).toHaveLength(1);
    expect(t?.titulo).toBe("Marina em #produto");
    expect(t?.acao?.rotulo).toBe("Abrir");
  });

  it("a partir da segunda, AGREGA num toast só, sem Abrir", () => {
    for (let i = 0; i < 3; i += 1) {
      avisarNoToast(
        mensagem({ autorNome: `pessoa ${i}` }),
        { titulo: `pessoa ${i} em #produto`, corpo: "Nova mensagem" },
        { previa: false, evento: "mensagem" },
      );
    }

    expect(lerToasts()).toHaveLength(1);
    const [t] = lerToasts();
    expect(t?.titulo).toBe("3 novas mensagens");
    expect(t?.descricao).toBe("Prévia de conteúdo desligada");
    expect(t?.icone).toBe("mensagens");
    expect(t?.acao).toBeUndefined();
  });

  it("id novo a cada agregação — é o que reinicia o relógio do toast", () => {
    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });
    const primeiro = lerToasts()[0]?.id;
    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });
    expect(lerToasts()[0]?.id).not.toBe(primeiro);
  });

  it("dispensado o agregado, a contagem recomeça", () => {
    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });
    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });
    for (const t of lerToasts()) dispensarToast(t.id);

    avisarNoToast(mensagem(), SEM_PREVIA, { previa: false, evento: "mensagem" });
    expect(lerToasts()[0]?.titulo).toBe("Marina em #produto");
  });

  it("com prévia ligada NÃO agrega — cada toast tem conteúdo próprio", () => {
    avisarNoToast(mensagem(), { titulo: "A", corpo: "um" }, { previa: true, evento: "mensagem" });
    avisarNoToast(mensagem(), { titulo: "B", corpo: "dois" }, { previa: true, evento: "mensagem" });
    expect(lerToasts().map((t) => t.titulo)).toEqual(["A", "B"]);
  });
});

describe("Responder… no toast de menção (D-NOTIF-20)", () => {
  const texto = { titulo: "Marina em #produto", corpo: "@ana pode ver?" };

  it("menção com prévia ganha o campo, e ele envia pelo que o adapter deu", () => {
    const enviar = vi.fn();
    avisarNoToast(mensagem({ mencionaVoce: true }), texto, {
      previa: true,
      evento: "mencaoDireta",
      responder: () => enviar,
    });

    const resposta = lerToasts()[0]?.resposta;
    expect(resposta?.rotulo).toBe("Responder…");
    resposta?.aoEnviar("já vejo");
    expect(enviar).toHaveBeenCalledWith("já vejo");
  });

  it("menção de cargo também", () => {
    avisarNoToast(mensagem(), texto, {
      previa: true,
      evento: "mencaoDeCargo",
      responder: () => () => undefined,
    });
    expect(lerToasts()[0]?.resposta).toBeDefined();
  });

  it("mensagem comum não tem campo, e nem PERGUNTA pela permissão", () => {
    const responder = vi.fn(() => () => undefined);
    avisarNoToast(mensagem(), texto, { previa: true, evento: "mensagem", responder });
    expect(lerToasts()[0]?.resposta).toBeUndefined();
    expect(responder).not.toHaveBeenCalled();
  });

  it("sem permissão de escrever, sem campo", () => {
    avisarNoToast(mensagem(), texto, {
      previa: true,
      evento: "mencaoDireta",
      responder: () => undefined,
    });
    expect(lerToasts()[0]?.resposta).toBeUndefined();
  });

  it("com prévia desligada, sem campo — responder no escuro não", () => {
    avisarNoToast(mensagem(), SEM_PREVIA, {
      previa: false,
      evento: "mencaoDireta",
      responder: () => () => undefined,
    });
    expect(lerToasts()[0]?.resposta).toBeUndefined();
  });
});

describe("toast de falha de envio (D-NOTIF-24)", () => {
  it("diz onde e por quê, como o design", () => {
    expect(textoDaFalhaDeEnvio("#produto", false)).toEqual({
      titulo: "Falha ao enviar mensagem",
      descricao: "#produto · sem conexão",
    });
  });

  it("é erro que EXPIRA, com △ e a ação Tentar", () => {
    const tentar = vi.fn();
    avisarFalhaDeEnvio("#produto", false, tentar);

    const t = lerToasts()[0];
    expect(t?.tipo).toBe("erro");
    expect(t?.expira).toBe(true);
    expect(t?.icone).toBe("alerta");
    expect(t?.acao?.rotulo).toBe("Tentar");
    t?.acao?.aoAtivar();
    expect(tentar).toHaveBeenCalledOnce();
  });

  it("falhas seguidas no mesmo canal contam em vez de empilhar", () => {
    avisarFalhaDeEnvio("#produto", false, () => undefined);
    avisarFalhaDeEnvio("#produto", false, () => undefined);
    avisarFalhaDeEnvio("#produto", false, () => undefined);

    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.repeticoes).toBe(3);
  });
});
