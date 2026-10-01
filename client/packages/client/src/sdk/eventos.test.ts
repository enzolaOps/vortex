import { beforeEach, describe, expect, it } from "vitest";

import { decidirLembreteDeEvento } from "../notificacao/decidir";
import { chaveDaMatriz, lerNotificacoes } from "../store/notificacoes";
import {
  anotarEventoDeServidor,
  corpoDoEvento,
  estadoDoEvento,
  eventosDaAba,
  gradeDoMes,
  grupoDoEvento,
  intervaloDoFormulario,
  lembretesDevidos,
  lerData,
  lerEvento,
  lerHora,
  limparEventos,
  ocorrenciaAtual,
  traduzirEvento,
  type EventoDoServidor,
} from "./eventos";

const HORA = 3_600_000;
const DIA = 24 * HORA;
const MIN = 60_000;

/* Quarta, 16/09/2026, 15:00 no fuso local. */
const AGORA = new Date(2026, 8, 16, 15, 0).getTime();

const BRUTO = {
  _id: "E1",
  server: "S1",
  creator: "U1",
  name: "Design crit",
  description: "Revisão do tri-state",
  starts_at: "2026-09-17T18:00:00.000Z",
  ends_at: "2026-09-17T19:00:00.000Z",
  location: { type: "Channel", channel: "C1" },
  recurrence: "weekly",
  remind: true,
  interested: ["U1", "EU"],
};

const ev = (e: Partial<EventoDoServidor> = {}): EventoDoServidor => ({
  id: "E",
  serverId: "S1",
  criadorId: "U1",
  nome: "Evento",
  descricao: undefined,
  inicioEm: AGORA + 2 * HORA,
  fimEm: undefined,
  local: { tipo: "canal", channelId: "C1" },
  capaUrl: undefined,
  repeticao: undefined,
  lembrar: true,
  interessados: [],
  ...e,
});

describe("traduzirEvento", () => {
  it("lê o evento do fio", () => {
    const e = traduzirEvento(BRUTO);
    expect(e?.nome).toBe("Design crit");
    expect(e?.inicioEm).toBe(Date.parse(BRUTO.starts_at));
    expect(e?.fimEm).toBe(Date.parse(BRUTO.ends_at));
    expect(e?.local).toEqual({ tipo: "canal", channelId: "C1" });
    expect(e?.repeticao).toBe("semanal");
    expect(e?.lembrar).toBe(true);
    expect(e?.interessados).toEqual(["U1", "EU"]);
  });

  it("link externo e campos ausentes", () => {
    const e = traduzirEvento({
      ...BRUTO,
      location: { type: "External", url: "https://meet.x/y" },
      description: "",
      ends_at: undefined,
      recurrence: undefined,
      remind: undefined,
      interested: undefined,
    });
    expect(e?.local).toEqual({ tipo: "externo", url: "https://meet.x/y" });
    expect(e?.descricao).toBeUndefined();
    expect(e?.fimEm).toBeUndefined();
    expect(e?.repeticao).toBeUndefined();
    expect(e?.lembrar).toBe(false);
    expect(e?.interessados).toEqual([]);
  });

  it("forma inválida vira ausência", () => {
    expect(traduzirEvento(undefined)).toBeUndefined();
    expect(traduzirEvento({ ...BRUTO, starts_at: "ontem" })).toBeUndefined();
    expect(traduzirEvento({ ...BRUTO, location: { type: "Channel" } })).toBeUndefined();
    expect(traduzirEvento({ ...BRUTO, name: 3 })).toBeUndefined();
  });
});

describe("tempo", () => {
  it("sem fim dura uma hora: ao vivo dentro dela, passado depois", () => {
    const e = ev({ inicioEm: AGORA - 30 * MIN });
    expect(estadoDoEvento(e, AGORA)).toBe("aoVivo");
    expect(estadoDoEvento(e, AGORA + 30 * MIN)).toBe("passado");
    expect(estadoDoEvento(ev(), AGORA)).toBe("proximo");
  });

  it("semanal passado anda para a próxima ocorrência", () => {
    const e = ev({ inicioEm: AGORA - 20 * DIA, repeticao: "semanal" });
    const { inicio } = ocorrenciaAtual(e, AGORA);
    expect(inicio).toBe(AGORA - 20 * DIA + 21 * DIA);
    expect(estadoDoEvento(e, AGORA)).toBe("proximo");
  });

  it("semanal em andamento fica na ocorrência atual", () => {
    const e = ev({ inicioEm: AGORA - 7 * DIA - 10 * MIN, repeticao: "semanal" });
    expect(ocorrenciaAtual(e, AGORA).inicio).toBe(AGORA - 10 * MIN);
    expect(estadoDoEvento(e, AGORA)).toBe("aoVivo");
  });

  it("mensal preserva o dia e cai no último quando o mês é curto", () => {
    const e = ev({
      inicioEm: new Date(2026, 0, 31, 10).getTime(),
      repeticao: "mensal",
    });
    const d = new Date(ocorrenciaAtual(e, new Date(2026, 1, 2).getTime()).inicio);
    expect([d.getMonth(), d.getDate()]).toEqual([1, 28]);
  });

  it("mensal criado meses atrás anda mês a mês até a próxima", () => {
    const e = ev({ inicioEm: new Date(2026, 2, 10, 10).getTime(), repeticao: "mensal" });
    const d = new Date(ocorrenciaAtual(e, AGORA).inicio);
    expect([d.getMonth(), d.getDate()]).toEqual([9, 10]);
  });

  it("agrupa por dia de calendário", () => {
    expect(grupoDoEvento(ev(), AGORA)).toBe("Hoje");
    expect(grupoDoEvento(ev({ inicioEm: AGORA + DIA }), AGORA)).toBe("Amanhã");
    expect(grupoDoEvento(ev({ inicioEm: AGORA + 3 * DIA }), AGORA)).toBe("Esta semana");
    expect(grupoDoEvento(ev({ inicioEm: AGORA + 9 * DIA }), AGORA)).toBe("Próxima semana");
    expect(grupoDoEvento(ev({ inicioEm: AGORA + 20 * DIA }), AGORA)).toBe("Mais tarde");
    expect(grupoDoEvento(ev({ inicioEm: AGORA - 3 * DIA }), AGORA)).toBe("Passados");
  });
});

describe("eventosDaAba", () => {
  const cedo = ev({ id: "cedo", inicioEm: AGORA + HORA });
  const tarde = ev({ id: "tarde", inicioEm: AGORA + 5 * HORA, interessados: ["EU"] });
  const velho = ev({ id: "velho", inicioEm: AGORA - 10 * DIA });
  const antigo = ev({ id: "antigo", inicioEm: AGORA - 40 * DIA });
  const recente = ev({ id: "recente", inicioEm: AGORA - 2 * DIA });
  const todos = [tarde, velho, cedo, antigo, recente];

  it("próximos por início, sem passados", () => {
    expect(eventosDaAba(todos, "proximos", "EU", AGORA).map((e) => e.id)).toEqual([
      "cedo",
      "tarde",
    ]);
  });

  it("interesses só os meus", () => {
    expect(eventosDaAba(todos, "interesses", "EU", AGORA).map((e) => e.id)).toEqual(["tarde"]);
    expect(eventosDaAba(todos, "interesses", undefined, AGORA)).toEqual([]);
  });

  it("passados do mais recente para trás, só 30 dias", () => {
    expect(eventosDaAba(todos, "passados", "EU", AGORA).map((e) => e.id)).toEqual([
      "recente",
      "velho",
    ]);
  });
});

describe("formulário", () => {
  it("lê data e hora, e recusa o que não existe", () => {
    expect(lerData("03/09/2026")).toEqual({ dia: 3, mes: 8, ano: 2026 });
    expect(lerData("31/02/2026")).toBeUndefined();
    expect(lerData("2026-09-03")).toBeUndefined();
    expect(lerHora("15:00")).toBe(900);
    expect(lerHora("24:00")).toBeUndefined();
    expect(lerHora("9:60")).toBeUndefined();
  });

  it("fim antes do início é o dia seguinte; igual é erro", () => {
    const r = intervaloDoFormulario("16/09/2026", "22:00", "01:00", "local", false);
    expect(r.ok && r.fimEm! - r.inicioEm).toBe(3 * HORA);
    expect(intervaloDoFormulario("16/09/2026", "22:00", "22:00", "local", false).ok).toBe(false);
  });

  it("link externo exige fim; canal não", () => {
    expect(intervaloDoFormulario("16/09/2026", "15:00", "", "local", true).ok).toBe(false);
    const r = intervaloDoFormulario("16/09/2026", "15:00", "", "local", false);
    expect(r.ok && r.fimEm).toBeUndefined();
  });

  it("UTC e local são instantes diferentes", () => {
    const r = intervaloDoFormulario("16/09/2026", "15:00", "", "utc", false);
    expect(r.ok && r.inicioEm).toBe(Date.UTC(2026, 8, 16, 15));
  });

  it("criar não manda remove; editar remove o que esvaziou", () => {
    const d = {
      nome: " Crit ",
      descricao: "  ",
      inicioEm: AGORA,
      fimEm: undefined,
      local: { tipo: "externo", url: " https://x.y " } as const,
      repeticao: undefined,
      lembrar: false,
      capaId: "CAPA",
    };
    const criar = corpoDoEvento(d, false);
    expect(criar["name"]).toBe("Crit");
    expect(criar["location"]).toEqual({ type: "External", url: "https://x.y" });
    expect(criar["image"]).toBe("CAPA");
    expect(criar).not.toHaveProperty("description");
    expect(criar).not.toHaveProperty("remove");
    expect(corpoDoEvento(d, true)["remove"]).toEqual(["Description", "EndsAt", "Recurrence"]);
    expect(corpoDoEvento({ ...d, repeticao: "quinzenal" }, false)["recurrence"]).toBe("biweekly");
  });
});

describe("gradeDoMes", () => {
  it("começa no domingo e expande a repetição dentro do mês", () => {
    const semanal = ev({
      id: "S",
      inicioEm: new Date(2026, 8, 3, 15).getTime(),
      repeticao: "semanal",
    });
    const dias = gradeDoMes(2026, 8, [semanal], AGORA);
    expect(dias.length % 7).toBe(0);
    expect(new Date(dias[0]!.data).getDay()).toBe(0);
    const comEvento = dias.filter((d) => d.doMes && d.eventos.length > 0).map((d) => d.numero);
    expect(comEvento).toEqual([3, 10, 17, 24]);
    expect(dias.find((d) => d.hoje)?.numero).toBe(16);
  });
});

describe("lembrete", () => {
  it("só dentro dos 10 minutos, só de quem marcou interesse, uma vez por ocorrência", () => {
    const e = ev({ inicioEm: AGORA + 5 * MIN, interessados: ["EU"] });
    expect(lembretesDevidos([e], "EU", AGORA, new Set())).toHaveLength(1);
    expect(lembretesDevidos([e], "OUTRO", AGORA, new Set())).toHaveLength(0);
    expect(lembretesDevidos([{ ...e, lembrar: false }], "EU", AGORA, new Set())).toHaveLength(0);
    expect(lembretesDevidos([e], "EU", AGORA - 20 * MIN, new Set())).toHaveLength(0);
    expect(lembretesDevidos([e], "EU", AGORA + 6 * MIN, new Set())).toHaveLength(0);
    const chave = lembretesDevidos([e], "EU", AGORA, new Set())[0]!.chave;
    expect(lembretesDevidos([e], "EU", AGORA, new Set([chave]))).toHaveLength(0);
  });

  it("servidor com 'notificar eventos' desligado não lembra (D-NOTIF-12)", () => {
    const e = ev({ inicioEm: AGORA + 5 * MIN, interessados: ["EU"] });
    const calado = (serverId: string) => serverId !== e.serverId;
    expect(lembretesDevidos([e], "EU", AGORA, new Set(), calado)).toHaveLength(0);
    expect(lembretesDevidos([e], "EU", AGORA, new Set(), () => true)).toHaveLength(1);
  });

  it("semanal lembra de novo na semana seguinte", () => {
    const e = ev({ inicioEm: AGORA + 5 * MIN, interessados: ["EU"], repeticao: "semanal" });
    const [primeiro] = lembretesDevidos([e], "EU", AGORA, new Set());
    const [segundo] = lembretesDevidos([e], "EU", AGORA + 7 * DIA, new Set([primeiro!.chave]));
    expect(segundo?.chave).not.toBe(primeiro?.chave);
  });

  const QUARTA = new Date(2026, 8, 16, 15, 0);
  const base = { ...lerNotificacoes(), silencioNoturno: false };
  const soPush = { ...base, matriz: new Set([chaveDaMatriz("evento", "push")]) };

  it("push com a janela atrás", () => {
    const c = decidirLembreteDeEvento({
      prefs: { ...soPush, desktop: true },
      naoPerturbe: false,
      agora: QUARTA,
      janelaEmFoco: false,
    });
    expect([...c]).toEqual(["push"]);
  });

  it("push pedido com o app à frente vira toast", () => {
    const c = decidirLembreteDeEvento({
      prefs: soPush,
      naoPerturbe: false,
      agora: QUARTA,
      janelaEmFoco: true,
    });
    expect([...c]).toEqual(["toast"]);
  });

  it("não perturbe e matriz vazia calam", () => {
    expect(
      decidirLembreteDeEvento({ prefs: soPush, naoPerturbe: true, agora: QUARTA, janelaEmFoco: true })
        .size,
    ).toBe(0);
    expect(
      decidirLembreteDeEvento({
        prefs: { ...base, matriz: new Set<string>() },
        naoPerturbe: false,
        agora: QUARTA,
        janelaEmFoco: true,
      }).size,
    ).toBe(0);
  });
});

describe("socket", () => {
  beforeEach(() => limparEventos());

  it("cria, marca interesse, apaga", () => {
    expect(anotarEventoDeServidor({ type: "ServerEventCreate", event: BRUTO })).toBe(true);
    expect(lerEvento("E1")?.nome).toBe("Design crit");
    expect(
      anotarEventoDeServidor({
        type: "ServerEventInterest",
        id: "E1",
        user_id: "NOVO",
        interested: true,
      }),
    ).toBe(true);
    expect(lerEvento("E1")?.interessados).toContain("NOVO");
    /* O eco do próprio interesse otimista não muda nada. */
    expect(
      anotarEventoDeServidor({
        type: "ServerEventInterest",
        id: "E1",
        user_id: "NOVO",
        interested: true,
      }),
    ).toBe(false);
    expect(anotarEventoDeServidor({ type: "ServerEventDelete", id: "E1" })).toBe(true);
    expect(lerEvento("E1")).toBeUndefined();
  });

  it("Bulk e servidor apagado", () => {
    anotarEventoDeServidor({
      type: "Bulk",
      v: [
        { type: "ServerEventCreate", event: BRUTO },
        { type: "ServerEventCreate", event: { ...BRUTO, _id: "E2" } },
      ],
    });
    expect(lerEvento("E2")).toBeDefined();
    expect(anotarEventoDeServidor({ type: "ServerDelete", id: "S1" })).toBe(true);
    expect(lerEvento("E1")).toBeUndefined();
    expect(lerEvento("E2")).toBeUndefined();
  });
});
