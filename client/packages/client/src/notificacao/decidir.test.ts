import { describe, expect, it } from "vitest";

import { lerNotificacoes } from "../store/notificacoes";
import {
  decidirEntrega,
  decidirEntregaDeChamada,
  emSilencioNoturno,
  type ContextoDeChamada,
  textoDaNotificacao,
  type Contexto,
  type MensagemRecebida,
} from "./decidir";

const prefs = { ...lerNotificacoes(), silencioNoturno: false };

/* Uma quarta às 15:00 — fora de qualquer silêncio. */
const QUARTA_15H = new Date(2026, 8, 16, 15, 0);

const msg = (m: Partial<MensagemRecebida> = {}): MensagemRecebida => ({
  mensagemId: "m",
  channelId: "c",
  serverId: "s",
  tipoDoCanal: "servidor",
  autorNome: "zola",
  canalNome: "geral",
  servidorNome: "go drinking",
  texto: "oi",
  minha: false,
  mencionaVoce: false,
  mencionaCargo: false,
  ...m,
});

const ctx = (c: Partial<Contexto> = {}): Contexto => ({
  prefs,
  nivel: undefined,
  silenciado: false,
  naoPerturbe: false,
  agora: QUARTA_15H,
  janelaEmFoco: false,
  vendoCanal: false,
  ...c,
});

const canais = (m: MensagemRecebida, c: Contexto) =>
  [...(decidirEntrega(m, c)?.canais ?? [])].sort();

describe("quem notifica", () => {
  it("menção direta com a janela atrás: som e notificação do sistema", () => {
    expect(canais(msg({ mencionaVoce: true }), ctx())).toEqual(["push", "som"]);
  });

  it("DM com a janela à frente: toast e som, sem notificação do sistema", () => {
    expect(canais(msg({ tipoDoCanal: "dm", serverId: undefined }), ctx({ janelaEmFoco: true }))).toEqual([
      "som",
      "toast",
    ]);
  });

  /* O padrão de canal de servidor é só menções. */
  it("mensagem comum em canal sem nível: nada", () => {
    expect(decidirEntrega(msg(), ctx({ janelaEmFoco: true }))).toBeUndefined();
  });

  it("mensagem comum em canal 'todas': toast", () => {
    expect(canais(msg(), ctx({ janelaEmFoco: true, nivel: "todas" }))).toEqual(["toast"]);
  });

  it("a própria mensagem nunca notifica", () => {
    expect(decidirEntrega(msg({ minha: true, mencionaVoce: true }), ctx())).toBeUndefined();
  });

  it("vendo o canal com a janela à frente: nada", () => {
    expect(
      decidirEntrega(msg({ mencionaVoce: true }), ctx({ janelaEmFoco: true, vendoCanal: true })),
    ).toBeUndefined();
  });

  /* O canal aberto numa janela minimizada ainda precisa avisar. */
  it("canal aberto mas janela atrás: notifica", () => {
    expect(canais(msg({ mencionaVoce: true }), ctx({ vendoCanal: true }))).toEqual(["push", "som"]);
  });

  it("não perturbe, canal silenciado e nível 'nada' calam tudo", () => {
    const m = msg({ mencionaVoce: true });
    expect(decidirEntrega(m, ctx({ naoPerturbe: true }))).toBeUndefined();
    expect(decidirEntrega(m, ctx({ silenciado: true }))).toBeUndefined();
    expect(decidirEntrega(m, ctx({ nivel: "nada" }))).toBeUndefined();
  });

  it("notificações no desktop desligadas: sem notificação do sistema", () => {
    expect(canais(msg({ mencionaVoce: true }), ctx({ prefs: { ...prefs, desktop: false } }))).toEqual(["som"]);
  });
});

describe("horário de silêncio", () => {
  const noturno = { ...prefs, silencioNoturno: true, silencioDas: "22:00", silencioAte: "08:00", silencioDias: [1, 2, 3, 4, 5] };

  it("segunda às 23:00 está em silêncio", () => {
    expect(emSilencioNoturno(noturno, new Date(2026, 8, 14, 23, 0))).toBe(true);
  });

  /* A madrugada pertence ao dia em que o silêncio começou. */
  it("sábado às 02:00 conta como sexta à noite — silêncio", () => {
    expect(emSilencioNoturno(noturno, new Date(2026, 8, 19, 2, 0))).toBe(true);
  });

  it("segunda às 02:00 conta como domingo à noite — livre", () => {
    expect(emSilencioNoturno(noturno, new Date(2026, 8, 14, 2, 0))).toBe(false);
  });

  it("quarta às 15:00 está livre", () => {
    expect(emSilencioNoturno(noturno, QUARTA_15H)).toBe(false);
  });
});

describe("texto", () => {
  it("diz quem e onde, e limpa menções cruas", () => {
    const t = textoDaNotificacao(msg({ texto: "oi <@01ARZ3NDEKTSV4RRFFQ69G5FAV>, olha" }), true);
    expect(t.titulo).toBe("zola em #geral · go drinking");
    expect(t.corpo).toBe("oi @menção, olha");
  });

  it("sem prévia, não mostra o conteúdo", () => {
    expect(textoDaNotificacao(msg({ texto: "segredo" }), false).corpo).toBe("Nova mensagem");
  });
});

describe("chamada recebida", () => {
  const noturno = { ...prefs, silencioNoturno: true, silencioDas: "22:00", silencioAte: "08:00", silencioDias: [1, 2, 3, 4, 5] };
  /* Segunda às 23:00 — dentro do horário de silêncio. */
  const SEGUNDA_23H = new Date(2026, 8, 14, 23, 0);

  const chamada = (c: Partial<ContextoDeChamada> = {}): ContextoDeChamada => ({
    prefs,
    naoPerturbe: false,
    agora: QUARTA_15H,
    janelaEmFoco: false,
    silenciado: false,
    amigo: false,
    ...c,
  });
  const por = (c: ContextoDeChamada) => [...(decidirEntregaDeChamada(c)?.canais ?? [])].sort();

  it("janela atrás: toast, som e push", () => {
    expect(por(chamada())).toEqual(["push", "som", "toast"]);
  });

  /* O toast da chamada fica mesmo com a janela à frente — e ao contrário do
     da mensagem, com ela ATRÁS também: ele é a única forma de atender. */
  it("janela à frente: toast e som, sem push", () => {
    expect(por(chamada({ janelaEmFoco: true }))).toEqual(["som", "toast"]);
  });

  it("não perturbe cala tudo, inclusive o aviso", () => {
    expect(decidirEntregaDeChamada(chamada({ naoPerturbe: true }))).toBeUndefined();
  });

  it("conversa silenciada: só o toast", () => {
    expect(por(chamada({ silenciado: true }))).toEqual(["toast"]);
  });

  it("horário de silêncio: só o toast — menos para amigo", () => {
    expect(por(chamada({ prefs: noturno, agora: SEGUNDA_23H }))).toEqual(["toast"]);
    expect(por(chamada({ prefs: noturno, agora: SEGUNDA_23H, amigo: true }))).toEqual(["push", "som", "toast"]);
  });

  it("obedece a matriz: sem a coluna, sem o canal", () => {
    const soSom = { ...prefs, matriz: new Set(["chamada:som"]) };
    expect(por(chamada({ prefs: soSom }))).toEqual(["som"]);
    expect(decidirEntregaDeChamada(chamada({ prefs: { ...prefs, matriz: new Set() } }))).toBeUndefined();
  });
});
