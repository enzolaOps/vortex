import "../../arnes/redeFalsa";

import {
  RAIZ,
  definirUsuarioLocal,
  canaisDeTexto,
  canaisDeVoz,
  channels,
  members,
  membrosOffline,
  membrosOnline,
  presence,
  secoesOnline,
  serverIds,
  servers,
  vozPorCanal,
} from "nucleo/sdk/adapter";
import { chaveDeMembro, SEM_CARGO, type ParticipanteDeVoz } from "nucleo/sdk/domain";
import { definirChamada, limparChamada } from "nucleo/store/chamada";
import { limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";
import { irParaCasa } from "nucleo/store/navegacao";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
import { limparPreferenciasDaSala } from "nucleo/store/preferenciasDaSala";
import { definirProntidao } from "nucleo/store/prontidao";
import { concluirEscolhaDeTela, pedirEscolhaDeTela, responderEscolhaDeTela } from "nucleo/store/seletorDeTela";
import { abrirServidor, lembrarTexto, limparUltimoLugar } from "nucleo/store/ultimoLugar";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { voz } from "../../textos";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ShellDasSalas } from "../salas/ShellDasSalas";

const ctl = vi.hoisted(() => ({ negadas: new Set<string>() }));

vi.mock("nucleo/sdk/permissoes", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  pode: (_canal: string, acao: string) => !ctl.negadas.has(acao),
  podeNoServidor: (_servidor: string, acao: string) => !ctl.negadas.has(acao),
}));

const S = "S1";
const parcial = <T,>(v: object) => v as unknown as T;

/** PNG de 1x1: carrega de verdade, sem rede. */
const FOTO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

function semear() {
  serverIds.set(RAIZ, [S]);
  servers.set(S, parcial({ id: S, name: "Grupo", sigla: "GR", naoLidas: 0, mencoes: 0, avatarUrl: FOTO }));
  canaisDeTexto.set(S, ["T1"]);
  canaisDeVoz.set(S, ["V1"]);
  channels.set("T1", parcial({ id: "T1", serverId: S, name: "geral", tipo: "texto", naoLidas: 0, mencoes: 0, silenciado: false }));
  channels.set("V1", parcial({ id: "V1", serverId: S, name: "Jogatina", tipo: "voz", naoLidas: 0, mencoes: 0, silenciado: false }));
  vozPorCanal.set("V1", [participante("U1"), participante("U2"), participante("U4")]);
  const dados: readonly (readonly [string, string, string | undefined, string | undefined])[] = [
    ["U1", "Ana", FOTO, "focada, volto mais tarde"],
    ["U2", "Caio", "imagem-que-nao-existe.png", undefined],
    ["U3", "Eva", undefined, undefined],
    ["U4", "Davi", undefined, undefined],
  ];
  for (const [id, nome, avatarUrl, statusTexto] of dados) {
    members.set(
      chaveDeMembro(S, id),
      parcial({ id, displayName: nome, sigla: nome.slice(0, 2), avatarUrl, statusTexto, cargosIds: [] }),
    );
    presence.set(id, "online");
  }
  membrosOnline.set(S, ["U1", "U2", "U3", "U4"]);
  membrosOffline.set(S, []);
  secoesOnline.set(S, [{ id: SEM_CARGO, rotulo: "online", cor: undefined, ids: ["U1", "U2", "U3", "U4"] }]);
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
  ctl.negadas = new Set();
  definirProntidao(false);
  definirUsuarioLocal("U4");
});
afterEach(() => {
  responderEscolhaDeTela(undefined);
  concluirEscolhaDeTela();
  desmontar();
  definirProntidao(false);
  fecharPalco();
  limparFalhaDeVoz();
});

async function abrir() {
  semear();
  await page.viewport(1600, 900);
  definirProntidao(true);
  abrirServidor(S);
  lembrarTexto(S, "T1");
  montar(
    <div style={{ inlineSize: "1600px", blockSize: "860px" }}>
      <ShellDasSalas />
    </div>,
  );
  await expect.element(page.getByRole("heading", { name: "Grupo", level: 2 })).toBeVisible();
}

const nomes = (raiz: ParentNode): string[] =>
  [...raiz.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent);
const controles = () => pegar(`[role="group"][aria-label="${voz.controles}"]`);

describe("controles da chamada conforme a permissão", () => {
  it("com tudo permitido, o widget mostra microfone, câmera e transmitir", async () => {
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    await expect.poll(controles).not.toBeNull();
    expect(nomes(controles()!)).toEqual(
      expect.arrayContaining([voz.microfone, voz.audioRecebido, voz.camera, voz.compartilharTela, voz.sairDaChamada]),
    );
  });

  it("sem 'falar' o microfone não existe (não fica cinza), o resto continua", async () => {
    ctl.negadas = new Set(["falarNaVoz"]);
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    await expect.poll(controles).not.toBeNull();
    const n = nomes(controles()!);
    expect(n).not.toContain(voz.microfone);
    expect(n).toEqual(expect.arrayContaining([voz.audioRecebido, voz.camera, voz.compartilharTela, voz.sairDaChamada]));
    expect(controles()!.querySelector("[disabled]")).toBeNull();
  });

  it("sem 'transmitir' somem a câmera e a tela, e o microfone fica", async () => {
    ctl.negadas = new Set(["transmitirVideo"]);
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    await expect.poll(controles).not.toBeNull();
    const n = nomes(controles()!);
    expect(n).not.toContain(voz.camera);
    expect(n).not.toContain(voz.compartilharTela);
    expect(n).toEqual(expect.arrayContaining([voz.microfone, voz.audioRecebido, voz.sairDaChamada]));
  });

  it("a cápsula do palco esconde o mesmo que o widget", async () => {
    ctl.negadas = new Set(["falarNaVoz", "transmitirVideo"]);
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    definirPalco({ tipo: "grade" });
    await expect.poll(() => pegar("[data-testid='palco']")).not.toBeNull();
    const grupo = pegar(`[role="group"][aria-label="${voz.controles}"]`)!;
    expect(nomes(grupo)).toEqual([voz.audioRecebido, voz.sairDaChamada]);
  });

  it("o diálogo de transmissão sem permissão diz o motivo e não oferece transmitir", async () => {
    ctl.negadas = new Set(["transmitirVideo"]);
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    void pedirEscolhaDeTela("sistema");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByText(voz.transmitir.semPermissao)).toBeVisible();
    expect(document.body.textContent).not.toContain(voz.transmitir.resolucao);
    expect(page.getByRole("button", { name: voz.transmitir.transmitir }).elements()).toHaveLength(0);
  });

  it("o diálogo de transmissão com permissão mostra o formulário", async () => {
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    void pedirEscolhaDeTela("sistema");
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByRole("button", { name: voz.transmitir.transmitir })).toBeVisible();
  });
});

describe("foto e recado visíveis para os outros", () => {
  it("a lista de membros desenha a foto por cima do gradiente e mostra o recado", async () => {
    await abrir();
    const lista = pegar("[data-testid='lista-de-membros']")!;
    await expect.poll(() => lista.querySelectorAll("img").length).toBeGreaterThan(0);
    const linhaDaAna = [...lista.querySelectorAll<HTMLElement>("[role='listitem']")].find((l) => l.textContent.includes("Ana"))!;
    const foto = linhaDaAna.querySelector("img")!;
    expect(foto.getAttribute("src")).toBe(FOTO);
    // O gradiente e as iniciais continuam por baixo: a imagem cobre, não substitui.
    expect(foto.parentElement!.textContent).toContain("A");
    expect(getComputedStyle(foto).position).toBe("absolute");
    expect(linhaDaAna.querySelector("[data-testid='recado-do-membro']")?.textContent).toBe("focada, volto mais tarde");
    // Quem não tem recado nem foto não ganha linha vazia nem imagem.
    const linhaDaEva = [...lista.querySelectorAll<HTMLElement>("[role='listitem']")].find((l) => l.textContent.includes("Eva"))!;
    expect(linhaDaEva.querySelector("img")).toBeNull();
    expect(linhaDaEva.querySelector("[data-testid='recado-do-membro']")).toBeNull();
  });

  it("foto que não carrega volta para as iniciais, sem imagem quebrada", async () => {
    await abrir();
    const lista = pegar("[data-testid='lista-de-membros']")!;
    const linhaDoCaio = [...lista.querySelectorAll<HTMLElement>("[role='listitem']")].find((l) => l.textContent.includes("Caio"))!;
    await expect.poll(() => linhaDoCaio.querySelector("img")).toBeNull();
    expect(linhaDoCaio.textContent).toContain("C");
  });

  it("o servidor aparece com o ícone na dock", async () => {
    await abrir();
    const dock = pegar("nav[aria-label]")!;
    await expect.poll(() => dock.querySelector("img")?.getAttribute("src")).toBe(FOTO);
  });

  it("o palco desenha a foto de quem está na sala", async () => {
    await abrir();
    definirChamada({ estado: "dentro", channelId: "V1", desde: Date.now() });
    definirPalco({ tipo: "grade" });
    await expect.poll(() => pegar("[data-testid='palco']")).not.toBeNull();
    const ladrilhoDaAna = [...document.querySelectorAll<HTMLElement>("[data-testid='ladrilho-de-pessoa']")].find(
      (l) => l.dataset.pessoa === "U1",
    )!;
    await expect.poll(() => ladrilhoDaAna.querySelector("img")?.getAttribute("src")).toBe(FOTO);
  });

  it("o widget da sala (antes de entrar) lista a pessoa com a foto", async () => {
    await abrir();
    await page.getByRole("button", { name: /Jogatina/ }).first().click();
    const widget = await vi.waitFor(() => {
      const w = pegar("section[aria-label='Jogatina']");
      if (!w) throw new Error("sem widget");
      return w;
    });
    await expect.poll(() => widget.querySelector("img")?.getAttribute("src")).toBe(FOTO);
  });
});
