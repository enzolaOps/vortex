import { describe, expect, it } from "vitest";

import {
  destinoDaConversa,
  sinalDeSuspeita,
  type Decisao,
  type EntradaDeConversa,
} from "./solicitacoes";

const INICIO = 1_000_000;

/** Um desconhecido que escreveu depois de o filtro existir — o caso da fila. */
const DESCONHECIDO: EntradaDeConversa = {
  tipo: "dm",
  relacao: "nenhuma",
  criadaEm: INICIO + 1,
  ultimaMensagemId: "M1",
};

function destino(
  e: Partial<EntradaDeConversa> = {},
  ctx: { filtrar?: boolean; decisao?: Decisao; restrita?: boolean } = {},
) {
  return destinoDaConversa(
    { ...DESCONHECIDO, ...e },
    {
      filtrar: ctx.filtrar ?? true,
      inicio: INICIO,
      decisao: ctx.decisao,
      restritaPorPrivacidade:
        ctx.restrita === undefined ? undefined : () => ctx.restrita ?? false,
    },
  );
}

describe("destino da conversa", () => {
  it("desconhecido que escreveu depois do início vai para a fila", () => {
    expect(destino()).toBe("solicitacao");
    // Pedido de amizade RECEBIDO também: a pessoa ainda não é amiga.
    expect(destino({ relacao: "recebido" })).toBe("solicitacao");
  });

  it("amigo, e quem você procurou, nunca entram na fila", () => {
    expect(destino({ relacao: "amigo" })).toBe("conversa");
    expect(destino({ relacao: "enviado" })).toBe("conversa");
  });

  it("grupo e notas não têm desconhecido do outro lado", () => {
    expect(destino({ tipo: "grupo" })).toBe("conversa");
    expect(destino({ tipo: "notas" })).toBe("conversa");
  });

  /*
    ⚠ O caso que faria da feature um defeito: ligar o filtro sobre uma conta
    antiga não pode esconder conversa que já existia.
  */
  it("DM criada antes do início fica onde sempre esteve", () => {
    expect(destino({ criadaEm: INICIO - 1 })).toBe("conversa");
  });

  it("filtro desligado não filtra", () => {
    expect(destino({}, { filtrar: false })).toBe("conversa");
  });

  it("sem mensagem não há o que ler antes de decidir", () => {
    expect(destino({ ultimaMensagemId: undefined })).toBe("conversa");
  });

  it("aceita vira conversa", () => {
    expect(destino({}, { decisao: { estado: "aceita" } })).toBe("conversa");
  });

  it("recusada some até a pessoa escrever de novo", () => {
    const decisao: Decisao = { estado: "recusada", ate: "M1" };
    expect(destino({}, { decisao })).toBe("oculta");
    expect(destino({ ultimaMensagemId: "M2" }, { decisao })).toBe("solicitacao");
  });

  it("bloqueado e recusado some de vez; bloqueado por fora continua na coluna", () => {
    const decisao: Decisao = { estado: "recusada", ate: "M1" };
    expect(destino({ relacao: "bloqueado", ultimaMensagemId: "M9" }, { decisao })).toBe(
      "oculta",
    );
    expect(destino({ relacao: "bloqueado" })).toBe("conversa");
  });
});

describe("sinal de suspeita", () => {
  it.each([
    ["entra aí: https://discord.gg/abc123", "link de convite detectado"],
    ["stt.gg/abc", "link de convite detectado"],
    ["https://vortex.exemplo/convite/xY_9", "link de convite detectado"],
    ["olha isso https://exemplo.com/a", "link detectado"],
  ])("%s → %s", (texto, esperado) => {
    expect(sinalDeSuspeita(texto)).toBe(esperado);
  });

  it.each([
    "oi! vi seu post sobre a matriz de permissões",
    "meu email é ana@exemplo.com",
    "",
  ])("%s não é suspeito", (texto) => {
    expect(sinalDeSuspeita(texto)).toBeUndefined();
  });
});

describe("privacidade por servidor", () => {
  it("restrita vai para a fila MESMO com o filtro global desligado", () => {
    expect(destino({}, { filtrar: false, restrita: true })).toBe("solicitacao");
    expect(destino({}, { filtrar: false, restrita: false })).toBe("conversa");
  });

  it("amigo, quem você procurou e conversa aceita nem perguntam", () => {
    let perguntou = false;
    const ctx = {
      filtrar: false,
      inicio: INICIO,
      decisao: undefined,
      restritaPorPrivacidade: () => {
        perguntou = true;
        return true;
      },
    };
    expect(destinoDaConversa({ ...DESCONHECIDO, relacao: "amigo" }, ctx)).toBe("conversa");
    expect(destinoDaConversa({ ...DESCONHECIDO, relacao: "enviado" }, ctx)).toBe("conversa");
    expect(
      destinoDaConversa(DESCONHECIDO, { ...ctx, decisao: { estado: "aceita" } }),
    ).toBe("conversa");
    expect(perguntou).toBe(false);
  });

  it("conversa antiga e sem mensagem ficam onde estão; recusada some", () => {
    expect(destino({ criadaEm: INICIO - 1 }, { filtrar: false, restrita: true })).toBe(
      "conversa",
    );
    expect(
      destino({ ultimaMensagemId: undefined }, { filtrar: false, restrita: true }),
    ).toBe("conversa");
    expect(
      destino({}, { filtrar: false, restrita: true, decisao: { estado: "recusada", ate: "M1" } }),
    ).toBe("oculta");
  });
});
