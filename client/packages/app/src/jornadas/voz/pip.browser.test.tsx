import "../../arnes/redeFalsa";

import {
  RAIZ,
  definirUsuarioLocal,
  canaisDeTexto,
  canaisDeVoz,
  channels,
  members,
  presence,
  secoesOnline,
  serverIds,
  servers,
  vozPorCanal,
} from "nucleo/sdk/adapter";
import { chaveDeMembro, SEM_CARGO, type ParticipanteDeVoz } from "nucleo/sdk/domain";
import { definirChamada, definirFalantes, limparChamada } from "nucleo/store/chamada";
import { definirJanelaDestacada, fecharJanelaDestacada, lerJanelaDestacada } from "nucleo/store/janelaDestacada";
import { irParaCasa } from "nucleo/store/navegacao";
import { fecharPalco } from "nucleo/store/palcoDeVoz";
import { lerCantoDaSala, limparPreferenciasDaSala } from "nucleo/store/preferenciasDaSala";
import { definirProntidao } from "nucleo/store/prontidao";
import { abrirServidor, limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { voz } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";
import { JanelaDestacada } from "./JanelaDestacada";
import { OverlayDaChamada } from "./OverlayDaChamada";
import { espelharEstilos } from "./espelharEstilos";

const ctl = vi.hoisted(() => ({ chamadas: [] as string[], assinaturas: [] as string[] }));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: () => true,
  podeNoServidor: () => true,
}));
vi.mock("nucleo/sdk/chamada", async (original) => {
  const registra = (nome: string) => () => {
    ctl.chamadas.push(nome);
    return Promise.resolve();
  };
  return {
    ...(await original<Record<string, unknown>>()),
    sairDaChamada: registra("sair"),
    alternarMudo: registra("mudo"),
    alternarSurdo: registra("surdo"),
    alternarCamera: registra("camera"),
    alternarTela: registra("tela"),
    assinarVideo: (userId: string, fonte: string, sim: boolean) => {
      ctl.assinaturas.push(`${sim ? "+" : "-"}${userId}:${fonte}`);
      return true;
    },
    definirQualidadeDeStream: (userId: string, fonte: string, q: string) => {
      ctl.assinaturas.push(`q:${userId}:${fonte}:${q}`);
    },
  };
});

const S = "S1";
const parcial = <T,>(v: object) => v as unknown as T;

const participante = (userId: string, extra: Partial<ParticipanteDeVoz> = {}): ParticipanteDeVoz => ({
  userId,
  estado: "voz",
  desde: 1,
  mudo: false,
  surdo: false,
  mudoPeloServidor: false,
  surdoPeloServidor: false,
  ...extra,
});

function canal(id: string, name: string, tipo: "texto" | "voz") {
  channels.set(id, parcial({ id, serverId: S, name, tipo, naoLidas: 0, mencoes: 0, silenciado: false }));
}

function semear(pessoas: ParticipanteDeVoz[]) {
  serverIds.set(RAIZ, [S]);
  servers.set(S, parcial({ id: S, name: "Grupo", sigla: "GR", naoLidas: 0, mencoes: 0, avatarUrl: undefined }));
  canaisDeTexto.set(S, ["T1", "T2"]);
  canaisDeVoz.set(S, ["V1"]);
  canal("T1", "geral", "texto");
  canal("T2", "avisos", "texto");
  canal("V1", "Jogatina", "voz");
  vozPorCanal.set("V1", pessoas);
  secoesOnline.set(S, [{ id: SEM_CARGO, rotulo: "online", cor: undefined, ids: ["U1", "U2", "U3"] }]);
  for (const [id, nome] of [
    ["U1", "Ana"],
    ["U2", "Caio"],
    ["U3", "Eva"],
    ["U4", "Davi"],
  ] as const) {
    members.set(chaveDeMembro(S, id), parcial({ id, displayName: nome, sigla: nome.slice(0, 2) }));
    presence.set(id, "online");
  }
}

const quatro = () => [
  participante("U1", { estado: "tela" }),
  participante("U2"),
  participante("U3", { mudo: true }),
  participante("U4"),
];
const semTransmissao = () => [participante("U1"), participante("U2"), participante("U3", { mudo: true }), participante("U4")];

beforeEach(() => {
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparUltimoLugar();
  limparPreferenciasDaSala();
  // `limparChamada` esquece o último valor sem avisar o store efêmero; zera por ele antes.
  definirFalantes(["_"]);
  definirFalantes([]);
  limparChamada();
  fecharPalco();
  irParaCasa();
  ctl.chamadas = [];
  ctl.assinaturas = [];
  definirProntidao(false);
  definirUsuarioLocal("U4");
});
afterEach(() => {
  fecharJanelaDestacada();
  desmontar();
  definirProntidao(false);
  delete (window as { vortexPopout?: unknown }).vortexPopout;
  vi.restoreAllMocks();
  for (const f of document.querySelectorAll("iframe[data-teste]")) f.remove();
});

async function abrir(pessoas: ParticipanteDeVoz[]) {
  semear(pessoas);
  await page.viewport(1600, 900);
  definirProntidao(true);
  abrirServidor(S);
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
      <JanelaDestacada />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

function entrar(extra: Parameters<typeof definirChamada>[0] = {}) {
  definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now(), ...extra });
}

const widget = () => pegar("section[aria-label='" + voz.chamada + "']");
const videoDoPip = () => pegar("[data-testid='video-do-pip']");

/** Uma janela "destacada" de mentira: o documento de um iframe, com o próprio `window`. */
function janelaDeMentira(): Window & typeof globalThis {
  const iframe = document.createElement("iframe");
  iframe.dataset.teste = "1";
  iframe.style.cssText = "position:fixed;inset-inline-start:0;inset-block-start:0;inline-size:300px;block-size:400px";
  document.body.append(iframe);
  return iframe.contentWindow as Window & typeof globalThis;
}

describe("PiP dentro do app", () => {
  it("mostra a transmissão em foco, com a camada média, e devolve a faixa ao sumir", async () => {
    await abrir(quatro());
    entrar();
    await expect.poll(videoDoPip).not.toBeNull();
    expect(videoDoPip()!.dataset).toMatchObject({ pessoa: "U1", fonte: "tela" });
    await expect.poll(() => ctl.assinaturas).toContain("+U1:tela");
    // A camada BAIXA: o PiP nunca paga pela alta.
    expect(ctl.assinaturas).toContain("q:U1:tela:baixa");
    expect(ctl.assinaturas).not.toContain("q:U1:tela:alta");

    vozPorCanal.set("V1", semTransmissao());
    await expect.poll(() => ctl.assinaturas).toContain("-U1:tela");
    expect(videoDoPip()).toBeNull();
  });

  it("sem transmissão não há PiP: os controles ficam no painel da coluna de salas", async () => {
    await abrir(semTransmissao());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.painelDaChamada })).toBeVisible();
    expect(widget()).toBeNull();
    expect(videoDoPip()).toBeNull();
    // Quem fala não faz a janelinha aparecer: ela é da transmissão.
    definirFalantes(["U2"]);
    await expect
      .poll(() => pegar("section[aria-label='" + voz.painelDaChamada + "']")!.textContent)
      .toContain(voz.falando("Caio"));
    expect(widget()).toBeNull();
    expect(ctl.assinaturas.filter((a) => a.startsWith("+"))).toEqual([]);
  });

  it("a janelinha aparece quando alguém começa a transmitir e some quando para", async () => {
    await abrir(semTransmissao());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.painelDaChamada })).toBeVisible();
    expect(widget()).toBeNull();

    vozPorCanal.set("V1", quatro());
    await expect.poll(widget).not.toBeNull();
    await expect.poll(videoDoPip).not.toBeNull();

    vozPorCanal.set("V1", semTransmissao());
    await expect.poll(widget).toBeNull();
  });

  it("transmitir você mesmo também mostra a janelinha, com a sua tela", async () => {
    await abrir(semTransmissao());
    entrar({ tela: true });
    await expect.poll(widget).not.toBeNull();
    expect(widget()!.textContent).toContain(voz.palco.suaTela);
  });

  it("a janelinha não repete os controles: microfone, fone e sair só existem no painel", async () => {
    await abrir(quatro());
    entrar();
    await expect.poll(widget).not.toBeNull();
    for (const nome of [voz.microfone, voz.audioRecebido, voz.sairDaChamada]) {
      expect(widget()!.querySelector(`button[aria-label='${nome}']`)).toBeNull();
      expect(document.querySelectorAll(`button[aria-label='${nome}']`).length).toBe(1);
    }
  });
});

describe("arrastar o widget", () => {
  const evento = (tipo: string, x: number, y: number) =>
    new PointerEvent(tipo, { pointerId: 7, pointerType: "mouse", button: 0, clientX: x, clientY: y, bubbles: true });

  function arrastar(deOnde: Element, ate: { x: number; y: number }) {
    const r = deOnde.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    deOnde.dispatchEvent(evento("pointerdown", x, y));
    deOnde.dispatchEvent(evento("pointermove", x + 10, y + 10));
    deOnde.dispatchEvent(evento("pointermove", ate.x, ate.y));
    return { x, y };
  }

  it("solto no quadrante de cima, à esquerda, prende no canto superior esquerdo e salva", async () => {
    await abrir(quatro());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.chamada })).toBeVisible();
    expect(lerCantoDaSala()).toBe("br");

    const w = widget()!;
    const palco = w.firstElementChild!;
    const inicio = w.getBoundingClientRect();
    arrastar(palco, { x: 400, y: 150 });
    expect(w.dataset.arrastando).toBe("true");
    // Durante o arrasto o widget acompanha o ponteiro e o canto ainda não mudou.
    expect(w.getBoundingClientRect().left).toBeLessThan(inicio.left - 100);
    expect(lerCantoDaSala()).toBe("br");

    palco.dispatchEvent(evento("pointerup", 400, 150));
    expect(lerCantoDaSala()).toBe("tl");
    expect(w.dataset.arrastando).toBeUndefined();
    expect(w.style.translate).toBe("");
    await expect.poll(() => widget()!.getBoundingClientRect().top).toBeLessThan(200);
    expect(JSON.parse(localStorage.getItem("vortex:preferencias-da-sala")!)).toMatchObject({ canto: "tl" });
  });

  it("fica acima da reserva do composer em qualquer canto de baixo", async () => {
    await abrir(quatro());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.chamada })).toBeVisible();
    const camada = widget()!.parentElement!.getBoundingClientRect();
    // A camada termina antes do composer: o widget preso embaixo nunca passa dela.
    expect(widget()!.getBoundingClientRect().bottom).toBeLessThanOrEqual(camada.bottom);
    expect(camada.bottom).toBeLessThan(window.innerHeight);
  });

  it("um clique sem mover não muda o canto, e começar em um botão não arrasta", async () => {
    await abrir(quatro());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.chamada })).toBeVisible();
    const palco = widget()!.firstElementChild!;
    const r = palco.getBoundingClientRect();
    palco.dispatchEvent(evento("pointerdown", r.left + 5, r.top + 5));
    palco.dispatchEvent(evento("pointermove", r.left + 7, r.top + 6));
    palco.dispatchEvent(evento("pointerup", r.left + 7, r.top + 6));
    expect(lerCantoDaSala()).toBe("br");

    const botao = document.querySelector<HTMLElement>(`button[aria-label='${voz.microfone}']`)!;
    botao.dispatchEvent(evento("pointerdown", 10, 10));
    botao.dispatchEvent(evento("pointermove", 400, 150));
    botao.dispatchEvent(evento("pointerup", 400, 150));
    expect(lerCantoDaSala()).toBe("br");
    expect(widget()!.dataset.arrastando).toBeUndefined();
  });

  it("cancelar o arrasto (pointercancel) devolve o widget sem mudar o canto", async () => {
    await abrir(quatro());
    entrar();
    await expect.element(page.getByRole("region", { name: voz.chamada })).toBeVisible();
    const palco = widget()!.firstElementChild!;
    arrastar(palco, { x: 400, y: 150 });
    palco.dispatchEvent(evento("pointercancel", 400, 150));
    expect(lerCantoDaSala()).toBe("br");
    expect(widget()!.style.translate).toBe("");
  });

  it("os quatro botões de canto continuam sendo o caminho do teclado", async () => {
    await abrir(quatro());
    entrar();
    await page.getByRole("region", { name: voz.chamada }).hover();
    await page.getByRole("button", { name: voz.fixarNoCanto.tr }).click();
    expect(lerCantoDaSala()).toBe("tr");
  });
});

describe("botão de destacar", () => {
  const botao = () => document.querySelector(`button[aria-label='${voz.destacar.destacar}']`);

  async function noWidget() {
    await expect.element(page.getByRole("region", { name: voz.painelDaChamada })).toBeVisible();
  }

  it("some onde não há como destacar (sem casca e sem Document PiP)", async () => {
    Object.defineProperty(window, "documentPictureInPicture", { value: undefined, configurable: true });
    try {
      await abrir(semTransmissao());
      entrar();
      await noWidget();
      expect(botao()).toBeNull();
      expect(document.querySelector(`button[aria-label='${voz.destacar.trazerDeVolta}']`)).toBeNull();
    } finally {
      delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture;
    }
  });

  it("na casca: abre pelo nome combinado, liga topo e proteção de conteúdo, e o botão vira 'trazer de volta'", async () => {
    const definirTopo = vi.fn().mockResolvedValue(undefined);
    const protegerConteudo = vi.fn().mockResolvedValue(undefined);
    (window as { vortexPopout?: unknown }).vortexPopout = { definirTopo, protegerConteudo };
    const filha = janelaDeMentira();
    const abrirJanela = vi.spyOn(window, "open").mockReturnValue(filha);

    await abrir(semTransmissao());
    entrar();
    await noWidget();
    await expect.poll(botao).not.toBeNull();
    (botao() as HTMLElement).click();

    await expect.poll(lerJanelaDestacada).toBe(filha);
    expect(abrirJanela).toHaveBeenCalledWith("", "vortex-popout-de-voz");
    await expect.poll(() => definirTopo.mock.calls).toEqual([[true]]);
    expect(protegerConteudo.mock.calls).toEqual([[true]]);
    // Casca: a janela é transparente (o jogo aparece atrás).
    expect(filha.document.body.style.background).toContain("transparent");

    // O botão agora traz de volta.
    await expect.poll(() => document.querySelector(`button[aria-label='${voz.destacar.trazerDeVolta}']`)).not.toBeNull();
  });

  it("no navegador: pede o Document PiP (sem proteção de conteúdo, que é da casca)", async () => {
    const filha = janelaDeMentira();
    const requestWindow = vi.fn().mockResolvedValue(filha);
    Object.defineProperty(window, "documentPictureInPicture", { value: { requestWindow }, configurable: true });
    try {
      await abrir(semTransmissao());
      entrar();
      await noWidget();
        await expect.poll(botao).not.toBeNull();
      (botao() as HTMLElement).click();
      await expect.poll(lerJanelaDestacada).toBe(filha);
      expect(requestWindow).toHaveBeenCalledOnce();
      expect(filha.document.body.style.background).not.toContain("transparent");
    } finally {
      delete (window as { documentPictureInPicture?: unknown }).documentPictureInPicture;
    }
  });

  it("recusado pela casca (window.open devolveu null): nada abre e o painel segue", async () => {
    (window as { vortexPopout?: unknown }).vortexPopout = {
      definirTopo: vi.fn(),
      protegerConteudo: vi.fn(),
    };
    vi.spyOn(window, "open").mockReturnValue(null);
    await abrir(semTransmissao());
    entrar();
    await noWidget();
    await expect.poll(botao).not.toBeNull();
    (botao() as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 50));
    expect(lerJanelaDestacada()).toBeUndefined();
    expect(pegar("section[aria-label='" + voz.painelDaChamada + "']")).not.toBeNull();
  });
});

describe("janela destacada", () => {
  async function comJanela(pessoas = semTransmissao()) {
    const filha = janelaDeMentira();
    await abrir(pessoas);
    entrar();
    definirJanelaDestacada(filha);
    return filha;
  }
  const dela = (filha: Window) => <T extends Element = HTMLElement>(sel: string) => filha.document.querySelector<T>(sel);

  it("desenha o overlay mínimo na janela: quem está na sala, o anel de quem fala e o mudo", async () => {
    const filha = await comJanela();
    const q = dela(filha);
    await expect.poll(() => q("[role='group'][aria-label*='Jogatina']")).not.toBeNull();
    const linhas = [...filha.document.querySelectorAll("li[data-pessoa]")];
    expect(linhas.map((l) => l.getAttribute("data-pessoa"))).toEqual(["U1", "U2", "U3", "U4"]);
    for (const [linha, nome] of linhas.map((l, i) => [l, ["Ana", "Caio", "Eva", "Davi"][i]!] as const)) {
      expect(linha.textContent).toContain(nome);
    }
    // Eva está sem áudio.
    expect(q("li[data-pessoa='U3'] [aria-label='" + voz.estado.mudo + "']")).not.toBeNull();
    expect(q("li[data-pessoa='U2'] [aria-label='" + voz.estado.mudo + "']")).toBeNull();

    definirFalantes(["U2"]);
    await expect.poll(() => q("li[data-pessoa='U2']")!.dataset.falando).toBe("true");
    expect(q("li[data-pessoa='U1']")!.dataset.falando).toBe("false");
  });

  it("em repouso não há controles nem vidro; com o ponteiro em cima eles aparecem", async () => {
    const filha = await comJanela();
    const q = dela(filha);
    await expect.poll(() => q("ul")).not.toBeNull();
    expect(q(`button[aria-label='${voz.microfone}']`)).toBeNull();
    expect(q(`button`)).toBeNull();

    const raiz = q("[role='group'][aria-label*='Jogatina']")!;
    raiz.dispatchEvent(
      new filha.PointerEvent("pointerover", { pointerType: "mouse", bubbles: true, composed: true }),
    );
    await expect.poll(() => q(`button[aria-label='${voz.microfone}']`)).not.toBeNull();
    expect(q(`button[aria-label='${voz.audioRecebido}']`)).not.toBeNull();
    expect(q(`button[aria-label='${voz.sairDaChamada}']`)).not.toBeNull();
    expect(q("button")!.parentElement).not.toBeNull();

    q<HTMLElement>(`button[aria-label='${voz.microfone}']`)!.click();
    q<HTMLElement>(`button[aria-label='${voz.audioRecebido}']`)!.click();
    q<HTMLElement>(`button[aria-label='${voz.sairDaChamada}']`)!.click();
    expect(ctl.chamadas).toEqual(["mudo", "surdo", "sair"]);

    // Soltar o ponteiro recolhe de novo.
    q("[role='group']")!.dispatchEvent(
      new filha.PointerEvent("pointerout", { pointerType: "mouse", bubbles: true, relatedTarget: null }),
    );
    await expect.poll(() => q(`button[aria-label='${voz.microfone}']`)).toBeNull();
  });

  it("mudo e surdo refletem o estado da chamada em aria-pressed", async () => {
    const filha = await comJanela();
    const q = dela(filha);
    definirChamada({ mudo: true });
    await expect.poll(() => q("ul")).not.toBeNull();
    q("[role='group']")!.dispatchEvent(new filha.PointerEvent("pointerover", { pointerType: "mouse", bubbles: true }));
    await expect.poll(() => q(`button[aria-label='${voz.microfone}']`)).not.toBeNull();
    expect(q(`button[aria-label='${voz.microfone}']`)!.getAttribute("aria-pressed")).toBe("false");
    expect(q(`button[aria-label='${voz.audioRecebido}']`)!.getAttribute("aria-pressed")).toBe("true");
  });

  it("a transmissão abre ao lado, com o vídeo assinado só enquanto a JANELA está visível", async () => {
    const filha = await comJanela(quatro());
    const q = dela(filha);
    await expect.poll(() => q("[role='region'][aria-label*='Ana']")).not.toBeNull();
    expect(q("[data-testid='video-do-pip']")!.dataset).toMatchObject({ pessoa: "U1", fonte: "tela" });
    await expect.poll(() => ctl.assinaturas).toContain("+U1:tela");

    // A janela destacada oculta (ex.: minimizada): a faixa é devolvida mesmo com a principal visível.
    Object.defineProperty(filha.document, "visibilityState", { value: "hidden", configurable: true });
    filha.document.dispatchEvent(new Event("visibilitychange"));
    await expect.poll(() => ctl.assinaturas).toContain("-U1:tela");

    Object.defineProperty(filha.document, "visibilityState", { value: "visible", configurable: true });
    filha.document.dispatchEvent(new Event("visibilitychange"));
    await expect.poll(() => ctl.assinaturas.filter((a) => a === "+U1:tela").length).toBe(2);
  });

  it("o estilo e o tema da principal chegam à janela", async () => {
    const filha = await comJanela();
    await expect.poll(() => filha.document.documentElement.dataset.tema).toBe("vidro");
    expect(filha.document.head.querySelectorAll("style, link[rel='stylesheet']").length).toBeGreaterThan(0);
  });

  it("sair da chamada fecha a janela destacada", async () => {
    const filha = await comJanela();
    await expect.poll(() => dela(filha)("ul")).not.toBeNull();
    definirChamada({ estado: "fora", channelId: "" });
    await expect.poll(lerJanelaDestacada).toBeUndefined();
  });

  it("fechar a janela pelo sistema (pagehide) esquece dela, e o widget volta a oferecer destacar", async () => {
    const filha = await comJanela();
    await expect.poll(() => dela(filha)("ul")).not.toBeNull();
    filha.dispatchEvent(new Event("pagehide"));
    await expect.poll(lerJanelaDestacada).toBeUndefined();
  });

  it("'Abrir Vortex' foca a principal, pela casca quando há", async () => {
    const focar = vi.fn();
    (window as { vortexNotificacoes?: unknown }).vortexNotificacoes = {
      contador: vi.fn(),
      chamarAtencao: vi.fn(),
      focar,
    };
    const foco = vi.spyOn(window, "focus");
    try {
      const filha = await comJanela();
      const q = dela(filha);
      await expect.poll(() => q("ul")).not.toBeNull();
      q("[role='group']")!.dispatchEvent(new filha.PointerEvent("pointerover", { pointerType: "mouse", bubbles: true }));
      await expect.poll(() => q("button:not([aria-label])")).not.toBeNull();
      q<HTMLElement>("button:not([aria-label])")!.click();
      expect(focar).toHaveBeenCalledOnce();
      expect(foco).toHaveBeenCalled();
    } finally {
      delete (window as { vortexNotificacoes?: unknown }).vortexNotificacoes;
    }
  });

  it("muita gente: resume o resto em vez de crescer a janela", async () => {
    const gente = Array.from({ length: 12 }, (_, i) => participante(`P${String(i)}`));
    const filha = await comJanela(gente);
    await expect.poll(() => filha.document.querySelectorAll("li[data-pessoa]").length).toBe(8);
    expect(filha.document.body.textContent).toContain("+4");
  });
});

describe("OverlayDaChamada fora de uma chamada", () => {
  it("não desenha nada", async () => {
    semear(semTransmissao());
    montar(<OverlayDaChamada documento={document} />);
    await new Promise((r) => setTimeout(r, 30));
    expect(document.querySelector("li[data-pessoa]")).toBeNull();
  });
});

describe("espelharEstilos", () => {
  function par() {
    const filha = janelaDeMentira();
    return { origem: document, destino: filha.document };
  }

  it("copia as folhas, acompanha folha nova e remove a que saiu", async () => {
    const { origem, destino } = par();
    const parar = espelharEstilos(origem, destino);
    const nova = origem.createElement("style");
    nova.textContent = ".espelho-teste{color:red}";
    origem.head.append(nova);
    await expect
      .poll(() => [...destino.head.querySelectorAll("style")].some((s) => s.textContent === ".espelho-teste{color:red}"))
      .toBe(true);

    nova.textContent = ".espelho-teste{color:blue}";
    await expect
      .poll(() => [...destino.head.querySelectorAll("style")].some((s) => s.textContent === ".espelho-teste{color:blue}"))
      .toBe(true);

    nova.remove();
    await expect
      .poll(() => [...destino.head.querySelectorAll("style")].some((s) => s.textContent?.includes("espelho-teste")))
      .toBe(false);
    parar();
  });

  it("os atributos de <html> vêm junto, inclusive os que mudam depois", async () => {
    const { origem, destino } = par();
    const parar = espelharEstilos(origem, destino);
    expect(destino.documentElement.dataset.tema).toBe(origem.documentElement.dataset.tema);
    origem.documentElement.dataset.espelhoTeste = "1";
    await expect.poll(() => destino.documentElement.dataset.espelhoTeste).toBe("1");
    delete origem.documentElement.dataset.espelhoTeste;
    await expect.poll(() => destino.documentElement.dataset.espelhoTeste).toBeUndefined();
    parar();
  });

  it("depois de parar, não acompanha mais", async () => {
    const { origem, destino } = par();
    const parar = espelharEstilos(origem, destino);
    parar();
    origem.documentElement.dataset.espelhoTeste = "2";
    await new Promise((r) => setTimeout(r, 30));
    expect(destino.documentElement.dataset.espelhoTeste).toBeUndefined();
    delete origem.documentElement.dataset.espelhoTeste;
  });
});
