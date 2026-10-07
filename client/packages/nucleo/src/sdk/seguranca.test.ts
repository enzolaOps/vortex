import { encodeTime } from "ulid";
import { describe, expect, it } from "vitest";

import { motivoDoErro, tipoDoErro } from "./erros";

import { bitDaPermissao } from "./cargos";
import {
  aplicarEventoCru,
  BIT_GERENCIAR_PEDIDOS,
  emergenciaVigente,
  filas,
  idadeDaConta,
  mudancaParaProtocolo,
  pedidoDe,
  politicaDe,
  politicas,
  POLITICA_PADRAO,
  type PedidoDeEntrada,
} from "./seguranca";

/**
 * A política de acesso vem do fork do `api`, e a tradução é onde ela quebra em
 * silêncio: um enum trocado faria a página mostrar "Convite" para um servidor
 * FECHADO — a afirmação falsa sobre o servidor que o registro de pendências
 * existe para impedir.
 */
describe("política do servidor", () => {
  it("ausente é o comportamento do Stoat", () => {
    expect(politicaDe(undefined)).toEqual({
      modo: "convite",
      exigeEmailVerificado: false,
      nivel: "nenhum",
      dmEntreMembros: false,
      filtraConvitesEmDm: false,
      emergencia: undefined,
    });
  });

  it("traduz todos os campos", () => {
    const p = politicaDe({
      join_mode: "Approval",
      require_verified_email: true,
      verification_level: "High",
      allow_member_dms: true,
      filter_dm_invites: true,
      emergency: {
        until: "2026-09-14T12:00:00Z",
        pause_invites: true,
        silence_everyone: false,
        freeze_joins: true,
      },
    });
    expect(p).toEqual({
      modo: "aprovacao",
      exigeEmailVerificado: true,
      nivel: "alto",
      dmEntreMembros: true,
      filtraConvitesEmDm: true,
      emergencia: {
        ateMs: Date.parse("2026-09-14T12:00:00Z"),
        pausaConvites: true,
        silenciaTodos: false,
        congelaEntradas: true,
      },
    });
  });

  it.each([
    ["Invite", "convite"],
    ["Approval", "aprovacao"],
    ["Closed", "fechado"],
  ] as const)("modo %s → %s", (cru, dominio) => {
    expect(politicaDe({ join_mode: cru }).modo).toBe(dominio);
  });

  it.each([
    ["None", "nenhum"],
    ["Low", "baixo"],
    ["Medium", "medio"],
    ["High", "alto"],
  ] as const)("nível %s → %s", (cru, dominio) => {
    expect(politicaDe({ verification_level: cru }).nivel).toBe(dominio);
  });

  it("valor desconhecido cai no padrão, nunca numa política inventada", () => {
    const p = politicaDe({ join_mode: "Futuro", verification_level: 3 });
    expect(p.modo).toBe("convite");
    expect(p.nivel).toBe("nenhum");
  });

  it("booleano só vale quando é `true` de verdade", () => {
    expect(politicaDe({ require_verified_email: "true" }).exigeEmailVerificado).toBe(
      false,
    );
  });

  it("emergência sem prazo legível é ausente", () => {
    expect(politicaDe({ emergency: { until: "ontem" } }).emergencia).toBeUndefined();
  });

  it("a mudança vai ao protocolo só com as chaves que mudaram", () => {
    expect(mudancaParaProtocolo({ modo: "fechado" })).toEqual({ join_mode: "Closed" });
    expect(
      mudancaParaProtocolo({
        exigeEmailVerificado: false,
        nivel: "medio",
        dmEntreMembros: true,
        filtraConvitesEmDm: false,
      }),
    ).toEqual({
      require_verified_email: false,
      verification_level: "Medium",
      allow_member_dms: true,
      filter_dm_invites: false,
    });
  });

  it("ida e volta preservam a política", () => {
    const mudanca = { modo: "aprovacao", nivel: "baixo" } as const;
    const p = politicaDe(mudancaParaProtocolo(mudanca));
    expect(p.modo).toBe("aprovacao");
    expect(p.nivel).toBe("baixo");
  });
});

describe("emergência vigente", () => {
  const com = (ateMs: number) => ({
    ...POLITICA_PADRAO,
    emergencia: {
      ateMs,
      pausaConvites: true,
      silenciaTodos: true,
      congelaEntradas: true,
    },
  });

  it("vale antes do prazo", () => {
    expect(emergenciaVigente(com(2000), 1000)).toBeDefined();
  });

  it("no prazo exato já expirou — a mesma regra do servidor (`until > now`)", () => {
    expect(emergenciaVigente(com(1000), 1000)).toBeUndefined();
    expect(emergenciaVigente(com(1000), 5000)).toBeUndefined();
  });

  it("sem emergência não há o que valer", () => {
    expect(emergenciaVigente(POLITICA_PADRAO, 0)).toBeUndefined();
  });
});

describe("pedido de entrada", () => {
  const HORA = 60 * 60 * 1000;
  const DIA = 24 * HORA;

  it.each([
    [30 * 1000, "conta criada há 1 minuto"],
    [5 * 60 * 1000, "conta criada há 5 minutos"],
    [HORA, "conta criada há 1 hora"],
    [3 * HORA, "conta criada há 3 horas"],
    [DIA, "conta de 1 dia"],
    [40 * DIA, "conta de 1 mês"],
    [800 * DIA, "conta de 2 anos"],
  ])("%d ms → %s", (idade, texto) => {
    expect(idadeDaConta(0, idade)).toBe(texto);
  });

  it("conta de menos de um dia é RISCO; de um dia em diante, não", () => {
    /* O tempo da conta sai dos 10 primeiros caracteres do ID do usuário. */
    const criada = Date.parse("2026-01-01T00:00:00Z");
    const id = encodeTime(criada, 10) + "0".repeat(16);
    const cru = { user: id, created_at: "2026-01-01T00:00:00Z" };

    expect(pedidoDe(cru, { username: "novo" }, undefined, criada + HORA).risco).toBe(true);
    expect(pedidoDe(cru, { username: "velho" }, undefined, criada + DIA).risco).toBe(false);
  });

  it("nome de exibição ganha do nome de usuário, e o ID é o último recurso", () => {
    const cru = { user: "01KDWM1K000000000000000000", created_at: "2026-01-01T00:00:00Z" };
    expect(pedidoDe(cru, { username: "u", display_name: "Bea" }, undefined, 0).nome).toBe(
      "Bea",
    );
    expect(pedidoDe(cru, { username: "u" }, undefined, 0).nome).toBe("u");
    expect(pedidoDe(cru, undefined, undefined, 0).nome).toBe(cru.user);
  });

  it("ID que não é ULID não inventa idade nem risco", () => {
    const p = pedidoDe({ user: "x", created_at: "2026-01-01T00:00:00Z" }, undefined, undefined, 0);
    expect(p.detalhe).toBe("conta desconhecida");
    expect(p.risco).toBe(false);
  });
});

describe("eventos crus", () => {
  it("Ready semeia a política de cada servidor", () => {
    aplicarEventoCru({
      type: "Ready",
      servers: [{ _id: "S1", security: { join_mode: "Closed" } }, { _id: "S2" }],
    });
    expect(politicas.peek("S1")?.modo).toBe("fechado");
    expect(politicas.peek("S2")).toEqual(POLITICA_PADRAO);
  });

  it("ServerUpdate troca a política, e limpar `Security` volta ao padrão", () => {
    aplicarEventoCru({
      type: "ServerUpdate",
      id: "S3",
      data: { security: { verification_level: "Low" } },
    });
    expect(politicas.peek("S3")?.nivel).toBe("baixo");

    /* Uma edição de NOME não traz `security`, e não pode apagar a política. */
    aplicarEventoCru({ type: "ServerUpdate", id: "S3", data: {} });
    expect(politicas.peek("S3")?.nivel).toBe("baixo");

    aplicarEventoCru({ type: "ServerUpdate", id: "S3", data: {}, clear: ["Security"] });
    expect(politicas.peek("S3")).toBe(POLITICA_PADRAO);
  });

  it("ServerJoinRequestDelete tira só o pedido daquela pessoa", () => {
    const pedido = (userId: string): PedidoDeEntrada => ({
      userId,
      nome: userId,
      sigla: userId,
      avatarUrl: undefined,
      pedidoEmMs: 0,
      detalhe: "",
      risco: false,
    });
    filas.set("S4", [pedido("A"), pedido("B")]);
    aplicarEventoCru({ type: "ServerJoinRequestDelete", id: "S4", user: "A" });
    expect(filas.peek("S4")).toEqual([pedido("B")]);
  });

  it("apagar pedido de fila que ainda carrega não a transforma em lista", () => {
    filas.set("S5", "carregando");
    aplicarEventoCru({ type: "ServerJoinRequestDelete", id: "S5", user: "A" });
    expect(filas.peek("S5")).toBe("carregando");
  });
});

describe("recusas de política, em português", () => {
  it.each([
    ["Closed", "Este servidor está fechado para novas entradas."],
    ["InvitesPaused", "Os convites deste servidor estão pausados por emergência."],
    ["JoinsFrozen", "Entradas neste servidor estão congeladas por emergência."],
    ["EmailUnverified", "Este servidor exige e-mail verificado para entrar."],
  ])("JoinBlocked %s", (reason, frase) => {
    expect(motivoDoErro(JSON.stringify({ type: "JoinBlocked", reason }))).toBe(frase);
  });

  it("privacidade por servidor do destinatário", () => {
    expect(motivoDoErro({ type: "PrivacyRestricted" })).toBe(
      "Esta pessoa não aceita conversas nem pedidos de amizade vindos dos servidores em comum.",
    );
  });

  it("nível de verificação diz o que falta cumprir", () => {
    expect(motivoDoErro({ type: "VerificationRequired", level: "High" })).toBe(
      "Este servidor exige 10 minutos como membro antes de falar.",
    );
    expect(motivoDoErro({ type: "VerificationRequired", level: "?" })).toBe(
      "Este servidor exige verificação antes de falar.",
    );
  });

  it("o pedido pendente é reconhecível pelo TIPO, mesmo chegando em texto", () => {
    expect(tipoDoErro(JSON.stringify({ type: "JoinRequestPending" }))).toBe(
      "JoinRequestPending",
    );
    expect(tipoDoErro("<html>502</html>")).toBeUndefined();
  });
});

describe("bit de moderar pedidos", () => {
  /* O bit precisa ser o MESMO do `channel.rs` do fork (44), e o editor de
     cargos e a checagem da fila precisam concordar: bits 41 a 43 são de
     eventos e soundboard, e um bit trocado daria a permissão errada. */
  it("é o bit 44 nos dois lugares do cliente", () => {
    expect(BIT_GERENCIAR_PEDIDOS).toBe(1n << 44n);
    expect(bitDaPermissao("ManageJoinRequests")).toBe(BIT_GERENCIAR_PEDIDOS);
  });

  it("confere com o `channel.rs` do servidor", async () => {
    const { readFileSync } = await import("node:fs");
    const rs = readFileSync(
      new URL("../../../../../server/crates/core/permissions/src/models/channel.rs", import.meta.url),
      "utf-8",
    );
    const m = /ManageJoinRequests = 1 << (\d+)/.exec(rs);
    expect(m?.[1]).toBe("44");
  });
});
