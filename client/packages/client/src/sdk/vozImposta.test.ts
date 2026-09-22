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
  it("lê o `by` do movimento quando o servidor do Vortex o manda", () => {
    expect(
      lerMovimentoImposto({ type: "UserMoveVoiceChannel", from: "01A", to: "01B", by: "01ANA" }),
    ).toEqual({ de: "01A", para: "01B", por: "01ANA" });
  });

  it("movimento com autor diz quem moveu", () => {
    registrarMovimentoImposto({ ...MOVIMENTO, porNome: "Ana Ribeiro" });
    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()[0]?.descricao).toBe("Por Ana Ribeiro.");
  });

  it("movimento sem autor cai no texto de sempre", () => {
    registrarMovimentoImposto(MOVIMENTO);
    registrarRemocaoImposta(REMOCAO);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador mudou você de canal.");
  });

  it("desconexão com o autor do ServerMemberUpdate diz quem desconectou", () => {
    // O `delta` grava o membro antes de falar com o LiveKit: o autor chega primeiro.
    registrarAutorImposto("Ana Ribeiro");
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()[0]?.descricao).toBe("Por Ana Ribeiro, em Sala do time.");
  });

  it("autor velho não assina uma desconexão de muito depois", () => {
    registrarAutorImposto("Ana Ribeiro");
    vi.advanceTimersByTime(JANELA_MS * 10);
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");
  });

  it("o autor é consumido pela resolução, e não vaza para a próxima", () => {
    registrarAutorImposto("Ana Ribeiro");
    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    for (const t of lerToasts()) dispensarToast(t.id);

    registrarRemocaoImposta(REMOCAO);
    vi.advanceTimersByTime(JANELA_MS);
    expect(lerToasts()[0]?.descricao).toBe("Um moderador tirou você de Sala do time.");
  });

  it("lê o autor só de ServerMemberUpdate sobre mim, e nunca eu mesma", () => {
    const e = (user: string, by?: string) => ({
      type: "ServerMemberUpdate",
      id: { server: "S", user },
      data: {},
      ...(by === undefined ? {} : { by }),
    });
    expect(lerAutorImposto(e("EU", "ANA"), "EU")).toBe("ANA");
    expect(lerAutorImposto(e("OUTRO", "ANA"), "EU")).toBeUndefined();
    expect(lerAutorImposto(e("EU"), "EU")).toBeUndefined();
    expect(lerAutorImposto(e("EU", "EU"), "EU")).toBeUndefined();
    expect(lerAutorImposto(e("EU", "ANA"), undefined)).toBeUndefined();
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
