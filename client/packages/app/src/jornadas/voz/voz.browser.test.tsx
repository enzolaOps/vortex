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
import { definirFalhaDeVoz, limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";
import { irParaCasa } from "nucleo/store/navegacao";
import { definirPalco, fecharPalco, lerPalco } from "nucleo/store/palcoDeVoz";
import { limparPreferenciasDaSala } from "nucleo/store/preferenciasDaSala";
import { definirProntidao } from "nucleo/store/prontidao";
import {
  concluirEscolhaDeTela,
  lerSeletorDeTela,
  pedirEscolhaDeTela,
  responderEscolhaDeTela,
} from "nucleo/store/seletorDeTela";
import { abrirServidor, limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { voz } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";

const ctl = vi.hoisted(() => ({
  chamadas: [] as string[],
  assinaturas: [] as string[],
}));

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
    entrarNaChamada: (id: string) => {
      ctl.chamadas.push(`entrar:${id}`);
      return Promise.resolve(true);
    },
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

function canal(id: string, name: string, tipo: "texto" | "voz", extra: object = {}) {
  channels.set(
    id,
    parcial({ id, serverId: S, name, tipo, naoLidas: 0, mencoes: 0, silenciado: false, ...extra }),
  );
}

function semear(pessoas: ParticipanteDeVoz[]) {
  serverIds.set(RAIZ, [S]);
  servers.set(S, parcial({ id: S, name: "Grupo", sigla: "GR", naoLidas: 0, mencoes: 0, avatarUrl: undefined }));
  canaisDeTexto.set(S, ["T1", "T2"]);
  canaisDeVoz.set(S, ["V1"]);
  canal("T1", "geral", "texto", { naoLidas: 3 });
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

beforeEach(() => {
  document.documentElement.dataset.tema = "vidro";
  localStorage.clear();
  limparUltimoLugar();
  limparPreferenciasDaSala();
  limparChamada();
  limparFalhaDeVoz();
  fecharPalco();
  irParaCasa();
  ctl.chamadas = [];
  ctl.assinaturas = [];
  definirProntidao(false);
  definirUsuarioLocal("U4");
});
afterEach(() => {
  desmontar();
  definirProntidao(false);
  fecharPalco();
  limparFalhaDeVoz();
});

async function abrir(pessoas: ParticipanteDeVoz[]) {
  semear(pessoas);
  await page.viewport(1600, 900);
  definirProntidao(true);
  abrirServidor(S);
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

const quatro = () => [
  participante("U1", { estado: "tela" }),
  participante("U2"),
  participante("U3", { mudo: true }),
  participante("U4"),
];
/** Clique direto no elemento: o véu do diálogo e a animação de entrada atrapalham o clique por coordenada. */
async function clicar(alvo: { element(): Element }) {
  await expect.element(alvo as never).toBeVisible();
  (alvo.element() as HTMLElement).click();
}
const palco = () => pegar("[data-testid='palco']");
const ladrilhos = () => [...document.querySelectorAll<HTMLElement>("[data-testid='ladrilho-de-pessoa']")];

function entrarNoPalco(estado: "dentro" | "conectando" | "reconectando" = "dentro") {
  definirChamada({ estado, channelId: "V1", desde: Date.now() });
  definirPalco({ tipo: "grade" });
}

describe("palco em tela cheia", () => {
  it("ocupa a área principal: sem coluna de membros, sem chat, com o cabeçalho e o botão do chat", async () => {
    await abrir(quatro());
    expect(pegar("[data-testid='lista-de-membros']")).not.toBeNull();
    entrarNoPalco();
    await expect.poll(palco).not.toBeNull();

    // A gaveta de membros colapsa e o chat não existe.
    expect(pegar("[data-testid='lista-de-membros']")?.offsetParent ?? null).toBeNull();
    expect(pegar("[data-testid='shell-grade']")!.dataset.gaveta).toBe("oculta");
    expect(document.querySelector("textarea, [aria-label*='Mensagem']")).toBeNull();

    const area = pegar("main")!.getBoundingClientRect();
    const p = palco()!.getBoundingClientRect();
    expect(p.width).toBeGreaterThan(area.width - 4);
    expect(p.height).toBeGreaterThan(area.height - 4);

    await expect.element(page.getByRole("heading", { name: "Jogatina", level: 2 })).toBeVisible();
    expect(palco()!.textContent).toContain("4 pessoas");
    expect(palco()!.textContent).toContain("Ana ao vivo");
    await expect.element(page.getByRole("button", { name: /Abrir o chat, geral, 3 novas/ })).toBeVisible();
  });

  it("transmissão em foco com a tira de pessoas; miniatura de outra transmissão troca o foco", async () => {
    await abrir([
      participante("U1", { estado: "tela" }),
      participante("U2", { estado: "tela" }),
      participante("U3"),
      participante("U4"),
    ]);
    entrarNoPalco();
    await expect.poll(() => pegar("[data-testid='foco-do-palco']")).not.toBeNull();

    // Foco na primeira transmissão de outra pessoa; sem faixa ainda, o aviso honesto.
    expect(pegar("[data-testid='foco-do-palco']")!.dataset.pessoa).toBe("U1");
    expect(pegar("[data-testid='foco-do-palco']")!.textContent).toContain(voz.palco.recebendoQuadro);
    expect(pegar("[data-testid='foco-do-palco']")!.textContent).toContain("AO VIVO");

    // A tira tem as pessoas que não são o foco e a miniatura da outra transmissão.
    const tira = pegar("[data-testid='tira-do-palco']")!;
    expect(tira.querySelectorAll("[data-testid='ladrilho-de-pessoa']").length).toBe(3);
    await page.getByRole("button", { name: voz.palco.assistir("Caio") }).click();
    expect(lerPalco()).toEqual({ tipo: "assistindo", userId: "U2" });
    await expect.poll(() => pegar("[data-testid='foco-do-palco']")!.dataset.pessoa).toBe("U2");
  });

  it("ver em grade tira o foco; sem transmissão o palco mostra só as pessoas, sem buraco", async () => {
    await abrir(quatro());
    entrarNoPalco();
    await expect.poll(() => pegar("[data-testid='foco-do-palco']")).not.toBeNull();
    await page.getByRole("button", { name: voz.palco.verEmGrade }).click();
    await expect.poll(() => pegar("[data-testid='grade-do-palco']")).not.toBeNull();
    expect(pegar("[data-testid='foco-do-palco']")).toBeNull();

    // Sem ninguém transmitindo.
    fecharPalco();
    vozPorCanal.set("V1", [participante("U1"), participante("U2")]);
    definirPalco({ tipo: "grade" });
    await expect.poll(() => ladrilhos().length).toBe(2);
    expect(pegar("[data-testid='grade-do-palco']")).not.toBeNull();
  });

  it("o anel de fala vem do store efêmero e acende só o ladrilho de quem fala", async () => {
    await abrir(quatro());
    entrarNoPalco();
    await expect.poll(() => ladrilhos().length).toBeGreaterThan(0);
    const de = (id: string) => ladrilhos().find((l) => l.dataset.pessoa === id)!;
    // O foco é a tela de Ana: as outras três pessoas e ela mesma estão na tira ou fora dela.
    definirFalantes(["U2"]);
    await expect.poll(() => de("U2").dataset.falando).toBe("true");
    expect(de("U3").dataset.falando).toBe("false");
    expect(de("U2").getAttribute("aria-label")).toContain("falando");
    definirFalantes([]);
    await expect.poll(() => de("U2").dataset.falando).toBe("false");
  });

  it("assina o vídeo só enquanto o ladrilho está no palco e devolve ao sair dele", async () => {
    await abrir(quatro());
    entrarNoPalco();
    await expect.poll(() => ctl.assinaturas).toContain("+U1:tela");
    // O foco pede a camada alta.
    expect(ctl.assinaturas).toContain("q:U1:tela:alta");

    // Ler outro canal fecha o palco: o ladrilho desmonta e a faixa é devolvida.
    await page.getByRole("button", { name: /avisos/ }).click();
    await expect.poll(() => ctl.assinaturas).toContain("-U1:tela");
    expect(palco()).toBeNull();
  });

  it("a tira do palco pede a camada baixa e a grade a média", async () => {
    await abrir(quatro());
    entrarNoPalco();
    definirChamada({ comCamera: ["U2"] });
    // Na tira (há foco): miniatura, a camada mais barata.
    await expect.poll(() => ctl.assinaturas).toContain("q:U2:camera:baixa");
    expect(ctl.assinaturas).not.toContain("q:U2:camera:media");

    // Na grade o ladrilho pode ocupar boa parte da tela: camada média.
    await page.getByRole("button", { name: voz.palco.verEmGrade }).click();
    await expect.poll(() => ctl.assinaturas).toContain("q:U2:camera:media");
  });

  it("a cápsula tem os cinco controles, com o recurso no nome e o estado em aria-pressed", async () => {
    await abrir(quatro());
    entrarNoPalco();
    await expect.element(page.getByRole("button", { name: voz.microfone })).toBeVisible();
    for (const nome of [voz.microfone, voz.audioRecebido, voz.camera, voz.compartilharTela]) {
      expect(document.querySelector(`button[aria-label='${nome}'][aria-pressed]`)).not.toBeNull();
    }
    expect(document.querySelector(`button[aria-label='${voz.sairDaChamada}']`)).not.toBeNull();

    await page.getByRole("button", { name: voz.microfone }).click();
    await page.getByRole("button", { name: voz.audioRecebido }).click();
    await page.getByRole("button", { name: voz.camera }).click();
    await page.getByRole("button", { name: voz.compartilharTela }).click();
    expect(ctl.chamadas).toEqual(["mudo", "surdo", "camera", "tela"]);

    await page.getByRole("button", { name: voz.sairDaChamada }).click();
    expect(ctl.chamadas.at(-1)).toBe("sair");
  });

  it("clicar num canal de texto com a chamada de pé abre o canal com a chamada no widget", async () => {
    await abrir(quatro());
    entrarNoPalco();
    await expect.poll(palco).not.toBeNull();

    await page.getByRole("button", { name: /avisos/ }).click();
    await expect.poll(palco).toBeNull();
    await expect.element(page.getByRole("region", { name: voz.chamada })).toBeVisible();
    // A gaveta volta e o canal é o clicado.
    expect(pegar("[data-testid='lista-de-membros']")).not.toBeNull();
    expect(document.querySelector("aside [aria-current]")?.textContent).toContain("avisos");

    // E "Voltar ao palco" devolve a tela.
    [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === voz.voltarAoPalco)?.click();
    await expect.poll(palco).not.toBeNull();
  });
});

describe("estados de conexão", () => {
  it("conectando: o palco já está aberto, com as pessoas conhecidas e sem afirmar qualidade", async () => {
    await abrir(quatro());
    entrarNoPalco("conectando");
    await expect.element(page.getByRole("status").filter({ hasText: voz.conexao.conectandoASala })).toBeVisible();
    expect(palco()!.dataset.estado).toBe("conectando");
    expect(ladrilhos().length).toBe(4);
    expect(palco()!.textContent).not.toMatch(/p\d\d|fps/);
    // A cápsula diz que está conectando.
    expect(palco()!.textContent).toContain(voz.conexao.conectandoASala);
    // Sem o motor, câmera e tela ainda não agem sobre uma sala que não existe.
    expect(document.querySelector(`button[aria-label='${voz.camera}']`)).toBeNull();
  });

  it("falha: painel com o motivo e 'Tentar de novo', sem a pessoa aparecer como dentro", async () => {
    await abrir(quatro());
    definirPalco({ tipo: "grade" });
    definirFalhaDeVoz({ channelId: "V1", motivo: "O servidor de voz não respondeu." });

    const painel = page.getByRole("alertdialog");
    await expect.element(painel).toBeVisible();
    expect(pegar("[role='alertdialog']")!.textContent).toContain(voz.conexao.falhouTitulo("Jogatina"));
    expect(pegar("[role='alertdialog']")!.textContent).toContain("O servidor de voz não respondeu.");
    expect(palco()!.dataset.estado).toBe("falhou");
    // Sem cápsula: a pessoa não está na sala.
    expect(document.querySelector(`button[aria-label='${voz.sairDaChamada}']`)).toBeNull();

    await page.getByRole("button", { name: voz.conexao.tentarDeNovo }).click();
    expect(ctl.chamadas).toContain("entrar:V1");
  });

  it("falha: 'Voltar' dispensa o aviso e fecha o palco", async () => {
    await abrir(quatro());
    definirPalco({ tipo: "grade" });
    definirFalhaDeVoz({ channelId: "V1", motivo: "x" });
    await page.getByRole("button", { name: voz.conexao.voltar }).click();
    await expect.poll(palco).toBeNull();
    expect(lerPalco().tipo).toBe("fechado");
  });

  it("reconectando: faixa de aviso e conteúdo congelado, sem tirar a pessoa da sala", async () => {
    await abrir(quatro());
    entrarNoPalco("reconectando");
    await expect
      .element(page.getByRole("status").filter({ hasText: voz.conexao.reconectandoDetalhe }))
      .toBeVisible();
    expect(pegar("[data-testid='palco'] [data-congelado='true']")).not.toBeNull();
    // A cápsula continua: sair ainda é possível.
    expect(document.querySelector(`button[aria-label='${voz.sairDaChamada}']`)).not.toBeNull();
  });

  it("fora da sala: oferece entrar de novo e o palco abre na hora", async () => {
    await abrir(quatro());
    definirPalco({ tipo: "grade" });
    await expect.element(page.getByRole("heading", { name: voz.conexao.foraTitulo("Jogatina") })).toBeVisible();
    await page.getByRole("button", { name: voz.conexao.entrarNaSala }).click();
    expect(ctl.chamadas).toContain("entrar:V1");
  });
});

describe("escolher o que transmitir", () => {
  const dialogo = () => pegar("[role='dialog']");

  afterEach(() => {
    responderEscolhaDeTela(undefined);
    concluirEscolhaDeTela();
    delete (window as { vortexTela?: unknown }).vortexTela;
  });

  it("na web: qualidade e som, sem lista de fontes (quem lista é o sistema), e devolve a escolha", async () => {
    await abrir(quatro());
    entrarNoPalco();
    const escolha = pedirEscolhaDeTela("sistema");
    await expect.element(page.getByRole("dialog", { name: voz.transmitir.titulo })).toBeVisible();
    expect(dialogo()!.textContent).toContain(voz.transmitir.seletorDoSistema);
    expect(dialogo()!.querySelector("[role='radiogroup'][aria-label]")).toBeNull();

    // Padrão: 1080p, 30 quadros.
    const marcados = [
      ...dialogo()!.querySelectorAll("[role='radiogroup'][aria-labelledby] [role='radio'][aria-checked='true']"),
    ].map((e) => e.textContent);
    expect(marcados).toEqual(["1080p", "30"]);

    await clicar(page.getByRole("radio", { name: "1440p" }));
    await clicar(page.getByRole("radio", { name: "60" }));
    await expect.element(page.getByRole("note")).toBeVisible();
    expect(pegar("[role='note']")!.textContent).toContain("1440p a 60 quadros");

    await clicar(page.getByRole("button", { name: voz.transmitir.transmitir }));
    expect(await escolha).toMatchObject({ fonteId: undefined, resolucao: "1440p", taxa: 60 });
    // Não fecha no clique: fica iniciando até o motor concluir.
    await expect.element(page.getByRole("button", { name: voz.transmitir.iniciando })).toBeVisible();
    expect(lerSeletorDeTela().fase).toBe("iniciando");
    concluirEscolhaDeTela();
    await expect.poll(dialogo).toBeNull();
  });

  it("cancelar (e Esc) resolve com nada e fecha", async () => {
    await abrir(quatro());
    const escolha = pedirEscolhaDeTela("sistema");
    await clicar(page.getByRole("button", { name: voz.transmitir.cancelar }));
    expect(await escolha).toBeUndefined();
    await expect.poll(dialogo).toBeNull();

    const outra = pedirEscolhaDeTela("sistema");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await clicar(page.getByRole("dialog"));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(await outra).toBeUndefined();
  });

  it("o som aparece desabilitado, com o motivo, onde o navegador não captura áudio", async () => {
    await abrir(quatro());
    const original = navigator.mediaDevices.getSupportedConstraints.bind(navigator.mediaDevices);
    navigator.mediaDevices.getSupportedConstraints = () => ({});
    try {
      void pedirEscolhaDeTela("sistema");
      await expect.element(page.getByRole("dialog")).toBeVisible();
      const interruptor = dialogo()!.querySelector("[role='switch']")!;
      expect(interruptor.getAttribute("aria-disabled")).toBe("true");
      expect(interruptor.getAttribute("aria-checked")).toBe("false");
      expect(dialogo()!.textContent).toContain(voz.transmitir.somIndisponivel);
    } finally {
      navigator.mediaDevices.getSupportedConstraints = original;
    }
  });

  it("na casca: lista telas e janelas pela ponte (ponto de extensão do Electron) e devolve a fonte", async () => {
    const fonte = (id: string, nome: string, tipo: "tela" | "janela") => ({
      id,
      nome,
      tipo,
      meta: tipo === "tela" ? "2560×1440" : undefined,
      miniatura: "",
      icone: undefined,
    });
    (window as { vortexTela?: unknown }).vortexTela = {
      seletorProprio: () => Promise.resolve(true),
      fontes: () => Promise.resolve([fonte("screen:1", "Tela 1", "tela"), fonte("window:9", "Deadlock", "janela")]),
      escolher: () => Promise.resolve(true),
      cancelar: () => Promise.resolve(),
      permissao: () => Promise.resolve("concedida"),
      abrirAjustes: () => Promise.resolve(),
    };
    await abrir(quatro());
    const escolha = pedirEscolhaDeTela("casca");
    await expect.element(page.getByRole("radio", { name: /Tela 1, 2560×1440, escolhida/ })).toBeVisible();
    await clicar(page.getByRole("tab", { name: voz.transmitir.janelas }));
    await expect.element(page.getByRole("radio", { name: /Deadlock, escolhida/ })).toBeVisible();
    await clicar(page.getByRole("button", { name: voz.transmitir.transmitir }));
    expect(await escolha).toMatchObject({ fonteId: "window:9", audio: true });
  });
});
