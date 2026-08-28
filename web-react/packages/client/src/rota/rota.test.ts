import { beforeEach, describe, expect, it } from "vitest";

import {
  irPara,
  irParaCasa,
  abrirConversa,
  lerCanalAtivo,
  lerLocal,
  lerServidorAtivo,
  limparNavegacao,
  selecionarCanal,
  type Local,
} from "../store/navegacao";
import {
  caminhoDaEntrada,
  caminhoDe,
  interpretar,
  interpretarEntrada,
} from "./rota";

beforeEach(() => {
  limparNavegacao();
});

const S = "01SERVIDOR0000000000000001";
const C = "01CANAL00000000000000000A";
const M = "01MENSAGEM000000000000001";

describe("caminho ↔ lugar", () => {
  const casos: readonly [string, Local][] = [
    ["/", { tipo: "casa" }],
    ["/servidor/" + S, { tipo: "servidor", serverId: S, channelId: undefined }],
    [`/servidor/${S}/canal/${C}`, { tipo: "servidor", serverId: S, channelId: C }],
    [`/dm/${C}`, { tipo: "dm", channelId: C }],
  ];

  it.each(casos)("%s vai e volta sem perder nada", (caminho, local) => {
    expect(caminhoDe(local)).toBe(caminho);
    expect(interpretar(caminho).local).toEqual(local);
  });
});

describe("permalink", () => {
  /*
    A mensagem sai SEPARADA do lugar. Guardá-la no `Local` faria a URL carregar
    para sempre uma posição que a pessoa abandona ao rolar.
  */
  it("a mensagem vem por fora do lugar", () => {
    const r = interpretar(`/servidor/${S}/canal/${C}/${M}`);
    expect(r.mensagemId).toBe(M);
    expect(r.local).toEqual({ tipo: "servidor", serverId: S, channelId: C });
  });

  it("o caminho de volta NÃO carrega a mensagem", () => {
    const { local } = interpretar(`/servidor/${S}/canal/${C}/${M}`);
    expect(caminhoDe(local)).toBe(`/servidor/${S}/canal/${C}`);
  });
});

describe("caminho que não existe", () => {
  /*
    Casa e não `undefined`: o app tem de abrir em algum lugar, e uma URL
    digitada errada não é motivo para tela em branco.
  */
  it.each(["/nada", "/servidor", "/servidor//canal/x", "/dm/", "/servidor/a/b/c/d"])(
    "%s cai na casa",
    (caminho) => {
      expect(interpretar(caminho).local).toEqual({ tipo: "casa" });
    },
  );
});

describe("a união marcada diz o que duas strings não diziam", () => {
  /*
    Era `servidorAtivo === ""` para dizer "casa", que é ausência de lugar e não
    um lugar. Com DM entrando, o par (servidor, canal) fica ambíguo: um canal
    sem servidor podia ser DM ou podia ser nada.
  */
  it("canal de DM e canal de servidor não se confundem", () => {
    abrirConversa(C);
    expect(lerLocal()).toEqual({ tipo: "dm", channelId: C });
    expect(lerServidorAtivo()).toBe("");
    expect(lerCanalAtivo()).toBe(C);
    expect(caminhoDe(lerLocal())).toBe(`/dm/${C}`);

    irPara(S, C);
    expect(lerCanalAtivo()).toBe(C);
    expect(caminhoDe(lerLocal())).toBe(`/servidor/${S}/canal/${C}`);
  });

  it("servidor sem canal é estado legítimo, não erro", () => {
    irPara(S, undefined);
    expect(lerCanalAtivo()).toBe("");
    expect(caminhoDe(lerLocal())).toBe(`/servidor/${S}`);
  });
});

describe("o snapshot é referência cacheada", () => {
  /*
    Antes eram duas strings e `assertStable` passava de graça. Agora é objeto, e
    a armadilha nº 1 do briefing volta a valer: montar no getter daria
    referência nova por chamada e loop de render.
  */
  it("duas leituras seguidas devolvem o MESMO objeto", () => {
    irPara(S, C);
    expect(lerLocal()).toBe(lerLocal());
  });

  it("ir para onde já se está não troca a referência", () => {
    irPara(S, C);
    const antes = lerLocal();
    irPara(S, C);
    expect(lerLocal()).toBe(antes);
  });
});

describe("o laço entre store e URL", () => {
  /*
    O risco desta arquitetura é o pingue-pongue: store escreve URL, URL aplica
    no store, store escreve URL. O que fecha o laço é a comparação de caminho —
    aplicar o que já vale não muda nada, então não há o que escrever.
  */
  it("aplicar o caminho atual não muda o lugar", () => {
    irPara(S, C);
    const antes = lerLocal();
    const { local } = interpretar(caminhoDe(antes));
    irPara(
      local.tipo === "servidor" ? local.serverId : "",
      local.tipo === "servidor" ? local.channelId : undefined,
    );
    expect(lerLocal()).toBe(antes);
  });

  it("casa → servidor → casa volta ao caminho inicial", () => {
    expect(caminhoDe(lerLocal())).toBe("/");
    irPara(S, C);
    expect(caminhoDe(lerLocal())).toBe(`/servidor/${S}/canal/${C}`);
    irParaCasa();
    expect(caminhoDe(lerLocal())).toBe("/");
  });
});

describe("selecionarCanal preserva o tipo de lugar", () => {
  it("dentro de servidor, troca só o canal", () => {
    irPara(S, C);
    selecionarCanal("01OUTRO0000000000000000AB");
    expect(lerLocal()).toEqual({
      tipo: "servidor",
      serverId: S,
      channelId: "01OUTRO0000000000000000AB",
    });
  });

  it("fora de servidor, vira conversa", () => {
    irParaCasa();
    selecionarCanal(C);
    expect(lerLocal()).toEqual({ tipo: "dm", channelId: C });
  });
});

describe("caminhos de FORA — os que existem antes de haver sessão", () => {
  /*
    Dois destes não são conveniência: `verificar` e `redefinir` chegam por LINK
    DE E-MAIL, e link de e-mail é uma URL. Sem a rota, o clique abriria a tela
    de senha e o token se perderia — conta sem confirmar, senha sem redefinir,
    as duas em silêncio.
  */
  it.each([
    ["/entrar", "entrar"],
    ["/entrar/criar", "criar"],
    ["/entrar/recuperar", "recuperar"],
    ["/entrar/conferir", "conferirEmail"],
  ])("%s é a tela %s", (caminho, tipo) => {
    expect(interpretarEntrada(caminho)?.tipo).toBe(tipo);
  });

  it("o token do link de verificação chega inteiro", () => {
    const t = "aB3-_.~xyz";
    expect(interpretarEntrada(`/verificar/${t}`)).toEqual({
      tipo: "verificar",
      token: t,
    });
  });

  it("o token do link de redefinição chega inteiro", () => {
    expect(interpretarEntrada("/redefinir/abc123")).toEqual({
      tipo: "redefinir",
      token: "abc123",
    });
  });

  it.each(["/", "/servidor/01A", "/dm/01A", "/nada", "/verificar/"])(
    "%s NÃO é caminho de entrada",
    (caminho) => {
      expect(interpretarEntrada(caminho)).toBeUndefined();
    },
  );

  it("vai e volta sem perder o token", () => {
    for (const tela of [
      { tipo: "entrar" },
      { tipo: "criar" },
      { tipo: "recuperar" },
      { tipo: "conferirEmail", email: undefined },
      { tipo: "verificar", token: "t1" },
      { tipo: "redefinir", token: "t2" },
    ] as const) {
      expect(interpretarEntrada(caminhoDaEntrada(tela))).toEqual(tela);
    }
  });

  /*
    O endereço de e-mail NÃO entra na URL: barra de endereço fica em histórico,
    em log de proxy e em print de tela.
  */
  it("o e-mail não aparece no caminho", () => {
    const caminho = caminhoDaEntrada({
      tipo: "conferirEmail",
      email: "alguem@exemplo.com",
    });
    expect(caminho).not.toContain("@");
    expect(caminho).toBe("/entrar/conferir");
  });
});

describe("convite por link", () => {
  /*
    O caso comum de convite é o link mandado para quem ainda NÃO tem conta
    aqui. Sem esta rota o clique cairia no login e o código se perderia — a
    pessoa criaria a conta e não saberia mais para onde ia.
  */
  it("é caminho de FORA, e chega antes da sessão", () => {
    expect(interpretarEntrada("/convite/abc123")).toEqual({
      tipo: "convite",
      codigo: "abc123",
    });
  });

  it("vai e volta sem perder o código", () => {
    const tela = { tipo: "convite", codigo: "xY_9-z" } as const;
    expect(interpretarEntrada(caminhoDaEntrada(tela))).toEqual(tela);
  });

  it("sem código não é convite", () => {
    expect(interpretarEntrada("/convite/")).toBeUndefined();
  });
});
