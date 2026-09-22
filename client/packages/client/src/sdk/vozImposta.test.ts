import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispensarToast, lerToasts } from "../components/ui/toastStore";
import {
  JANELA_MS,
  avisarMudoDoServidor,
  avisarSurdoDoServidor,
  definirEntradaDeVoz,
  lerAutorImposto,
  lerMovimentoImposto,
  limparVozImposta,
  registrarAutorImposto,
  registrarMovimentoImposto,
  registrarRemocaoImposta,
} from "./vozImposta";

const entradas: string[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  limparVozImposta();
  for (const t of lerToasts()) dispensarToast(t.id);
  entradas.length = 0;
  definirEntradaDeVoz((id) => entradas.push(id));
});

afterEach(() => {
  vi.useRealTimers();
});

const MOVIMENTO = {
  de: "01SALA",
  para: "01FOCO",
  nomeDe: "Sala do time",
  nomePara: "Foco",
} as const;

const REMOCAO = { canal: "01SALA", nome: "Sala do time" } as const;

describe("lerMovimentoImposto", () => {
  it("lê from/to do evento cru, que o SDK descarta", () => {
    expect(
      lerMovimentoImposto({
        type: "UserMoveVoiceChannel",
        node: "br",
        token: "t",
        from: "01A",
        to: "01B",
      }),
    ).toEqual({ de: "01A", para: "01B" });
  });

  it("ignora outro evento e payload incompleto", () => {
    expect(lerMovimentoImposto({ type: "VoiceChannelJoin" })).toBeUndefined();
    /* O tipo do SDK declara só `node` e `token`: um servidor que mandasse o
       evento sem `from`/`to` não pode virar um aviso sobre canal nenhum. */
    expect(
      lerMovimentoImposto({ type: "UserMoveVoiceChannel", node: "br", token: "t" }),
    ).toBeUndefined();
    expect(
      lerMovimentoImposto({ type: "UserMoveVoiceChannel", from: "01A", to: "01A" }),
    ).toBeUndefined();
  });
});

describe("a corrida entre o LiveKit e o socket", () => {
  it("remoção sozinha, depois da janela, é desconexão por moderação", () => {
    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()).toHaveLength(0);

    vi.advanceTimersByTime(JANELA_MS);

    const [t] = lerToasts();
    expect(t?.titulo).toBe("Você foi desconectada da voz.");
    expect(t?.tipo).toBe("erro");
    expect(t?.acao?.rotulo).toBe("Reconectar");
    /* Desconexão NÃO reconecta sozinha: quem foi tirado da sala não volta sem
       pedir. Só o movimento entra automaticamente. */
    expect(entradas).toEqual([]);

    t?.acao?.aoAtivar();
    expect(entradas).toEqual(["01SALA"]);
  });

  it("remoção primeiro e movimento depois vira UM aviso de movimento", () => {
    registrarRemocaoImposta(REMOCAO);
    registrarMovimentoImposto(MOVIMENTO);

    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.titulo).toBe("Você foi movida para Foco.");
    expect(entradas).toEqual(["01FOCO"]);

    /* A janela pendente não pode disparar um segundo aviso depois. */
    vi.advanceTimersByTime(JANELA_MS * 4);
    expect(lerToasts()).toHaveLength(1);
  });

  it("movimento primeiro e remoção depois dá o mesmo resultado", () => {
    registrarMovimentoImposto(MOVIMENTO);
    expect(lerToasts()).toHaveLength(0);

    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.titulo).toBe("Você foi movida para Foco.");
    expect(entradas).toEqual(["01FOCO"]);

    vi.advanceTimersByTime(JANELA_MS * 4);
    expect(lerToasts()).toHaveLength(1);
  });

  it("movimento sem remoção nenhuma ainda resolve, pela janela", () => {
    registrarMovimentoImposto(MOVIMENTO);
    vi.advanceTimersByTime(JANELA_MS);

    expect(lerToasts()[0]?.titulo).toBe("Você foi movida para Foco.");
    expect(entradas).toEqual(["01FOCO"]);
  });

  it("voltar é entrada normal na sala de origem", () => {
    registrarMovimentoImposto(MOVIMENTO);
    registrarRemocaoImposta(REMOCAO);

    const [t] = lerToasts();
    expect(t?.acao?.rotulo).toBe("Voltar para Sala do time");
    t?.acao?.aoAtivar();
    expect(entradas).toEqual(["01FOCO", "01SALA"]);
  });

  it("dois ciclos seguidos não vazam estado de um para o outro", () => {
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    for (const t of lerToasts()) dispensarToast(t.id);

    registrarMovimentoImposto(MOVIMENTO);
    vi.advanceTimersByTime(JANELA_MS);

    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.titulo).toBe("Você foi movida para Foco.");
  });
});

describe("por Fulano (D-LAC-24/25)", () => {
  it("lê o `by` do movimento, que já vem no evento privado", () => {
    expect(
      lerMovimentoImposto({ type: "UserMoveVoiceChannel", from: "01A", to: "01B", by: "01ANA" }),
    ).toEqual({ de: "01A", para: "01B", por: "01ANA" });
  });

  it("movimento com autor diz quem moveu; sem autor, o texto de sempre", () => {
    registrarMovimentoImposto({ ...MOVIMENTO, porNome: "Ana Ribeiro" });
    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()[0]?.descricao).toBe("Por Ana Ribeiro.");
    for (const t of lerToasts()) dispensarToast(t.id);

    registrarMovimentoImposto(MOVIMENTO);
    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador mudou você de canal.");
  });

  /* As três ordens do autor da DESCONEXÃO, que chega por evento privado
     enquanto a remoção chega pelo LiveKit. Um aviso só em todas. */
  it("privado antes da remoção: assina", () => {
    registrarAutorImposto("01SALA", "Ana Ribeiro");
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.descricao).toBe("Por Ana Ribeiro, em Sala do time.");
  });

  it("remoção antes do privado, dentro da janela: assina", () => {
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS / 2);
    registrarAutorImposto("01SALA", "Ana Ribeiro");
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.descricao).toBe("Por Ana Ribeiro, em Sala do time.");
  });

  it("privado ausente: o texto sem autor", () => {
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");
  });

  it("privado atrasado: o aviso já saiu sem autor, e não sai de novo", () => {
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    registrarAutorImposto("01SALA", "Ana Ribeiro");
    vi.advanceTimersByTime(JANELA_MS * 4);
    expect(lerToasts()).toHaveLength(1);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");

    /* E o autor atrasado não assina uma desconexão que venha muito depois. */
    for (const t of lerToasts()) dispensarToast(t.id);
    vi.advanceTimersByTime(JANELA_MS * 10);
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");
  });

  it("autor de OUTRA sala não assina a remoção desta", () => {
    registrarAutorImposto("01OUTRA", "Ana Ribeiro");
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");
  });

  it("lê só o evento privado do fork, e nunca o público de membro", () => {
    const privado = { type: "UserVoiceDisconnected", server: "S", channel: "01SALA", by: "ANA" };
    expect(lerAutorImposto(privado, "EU")).toEqual({ canal: "01SALA", server: "S", por: "ANA" });
    expect(lerAutorImposto({ ...privado, by: "EU" }, "EU")).toBeUndefined();
    expect(lerAutorImposto({ ...privado, channel: undefined }, "EU")).toBeUndefined();
    expect(
      lerAutorImposto(
        { type: "ServerMemberUpdate", id: { server: "S", user: "EU" }, data: {}, by: "ANA" },
        "EU",
      ),
    ).toBeUndefined();
  });
});

describe("mudo e surdo pelo servidor", () => {
  it("a restrição diz que só um moderador reverte, e não oferece ação", () => {
    avisarMudoDoServidor(false);
    const [t] = lerToasts();
    expect(t?.titulo).toBe("Você foi silenciada no servidor.");
    expect(t?.descricao).toBe("Só um moderador pode reverter.");
    expect(t?.acao).toBeUndefined();
  });

  it("a liberação também avisa — senão o microfone volta sozinho e sem explicação", () => {
    avisarMudoDoServidor(true);
    expect(lerToasts()[0]?.titulo).toBe("Você pode falar de novo neste servidor.");
  });

  it("ensurdecer tem os dois sentidos", () => {
    avisarSurdoDoServidor(false);
    expect(lerToasts()[0]?.titulo).toBe("Você foi ensurdecida no servidor.");
    for (const t of lerToasts()) dispensarToast(t.id);

    avisarSurdoDoServidor(true);
    expect(lerToasts()[0]?.titulo).toBe("Você voltou a ouvir neste servidor.");
  });
});
