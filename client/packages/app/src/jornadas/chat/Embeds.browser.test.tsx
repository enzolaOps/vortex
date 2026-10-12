import "../../arnes/redeFalsa";

import { CHANNEL_ID, SERVER_ID, seed } from "nucleo/arnes/firehose";
import { messages } from "nucleo/sdk/adapter";
import type { EmbedSnapshot } from "nucleo/sdk/domain";
import { definirAparencia, restaurarAparencia } from "nucleo/store/aparencia";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { AreaPrincipal } from "../../shell";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { ListaDeMensagens } from "./ListaDeMensagens";

/**
 * As prévias de link na lista real: o cartão, a caixa reservada antes da imagem,
 * o player que só carrega ao clique, o limite de três — e, o que mais importa, a
 * chegada TARDIA do embed sem a lista pular.
 */

afterEach(() => {
  desmontar();
  restaurarAparencia();
});

beforeAll(async () => {
  await seed(200);
}, 60_000);

const log = () => pegar<HTMLElement>('[role="log"]')!;
const distanciaDoFim = () => log().scrollHeight - log().clientHeight - log().scrollTop;
const linhas = () => Array.from(document.querySelectorAll<HTMLElement>("[data-index]"));
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function montarLista() {
  document.documentElement.dataset.tema = "vidro";
  return montar(
    <div style={{ inlineSize: "900px", blockSize: "600px", display: "grid" }}>
      <AreaPrincipal>
        <ListaDeMensagens canalId={CHANNEL_ID} servidorId={SERVER_ID} />
      </AreaPrincipal>
    </div>,
  );
}

/** Uma imagem que nunca chega: a caixa reservada tem de existir mesmo assim. */
const SEM_REDE = "http://127.0.0.1:9/nunca.png";

function site(over: Partial<EmbedSnapshot> = {}): EmbedSnapshot {
  return {
    id: "https://exemplo.com/post",
    tipo: "site",
    url: "https://exemplo.com/post",
    origem: "Exemplo",
    titulo: "Um post sobre cartões",
    descricao: "O resumo do post, que o servidor leu da página.",
    blocos: undefined,
    imagem: undefined,
    imagemGrande: false,
    video: undefined,
    especial: undefined,
    cor: "#35c2cc",
    ...over,
  };
}

/** Troca os embeds de uma mensagem como o `MessageUpdate` faz: pelo store, uma entidade só. */
function chegar(id: string, embeds: readonly EmbedSnapshot[]) {
  const atual = messages.peek(id);
  if (!atual) throw new Error(`mensagem ${id} não resolvida`);
  messages.set(id, { ...atual, embeds });
}

/** A última linha de verdade na tela, pelo ID que ela mesma declara. */
const ultimaId = () => {
  const todas = Array.from(document.querySelectorAll<HTMLElement>("[data-menu-mensagem]"));
  return todas[todas.length - 1]!.getAttribute("data-menu-mensagem")!;
};
/** Só os cartões que ESTE teste pôs: o firehose também gera embeds em outras linhas. */
const cartoes = () => Array.from(document.querySelectorAll<HTMLElement>("[data-embed]")).filter((c) => c.textContent?.includes(MARCA) || c.querySelector(`[href^="${MARCA_URL}"]`));
const MARCA = "Um post sobre cartões";
const MARCA_URL = "https://exemplo.com/";

async function prontaNoFim() {
  montarLista();
  await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
}

describe("prévia de link", () => {
  it("cartão de site: origem, título como link, descrição e barra de cor", async () => {
    await prontaNoFim();
    chegar(ultimaId(), [site()]);
    await expect.poll(() => cartoes().length).toBe(1);
    const c = cartoes()[0]!;
    expect(c.textContent).toContain("Exemplo");
    expect(c.textContent).toContain("O resumo do post");
    const titulo = c.querySelector<HTMLAnchorElement>("a")!;
    expect(titulo.textContent).toBe("Um post sobre cartões");
    expect(titulo.getAttribute("href")).toBe("https://exemplo.com/post");
    expect(titulo.rel).toContain("noopener");
    expect(titulo.target).toBe("_blank");
    expect(c.style.getPropertyValue("--cor-do-embed")).toBe("#35c2cc");
  });

  it("imagem grande reserva a caixa pelo width/height ANTES de carregar", async () => {
    await prontaNoFim();
    chegar(ultimaId(), [
      site({ imagemGrande: true, imagem: { url: SEM_REDE, largura: 800, altura: 400 } }),
    ]);
    await expect.poll(() => cartoes().length).toBe(1);
    const moldura = cartoes()[0]!.querySelector<HTMLElement>("[data-embed-midia='imagem']")!;
    const img = moldura.querySelector("img")!;
    // Sem um byte da imagem, a caixa já tem a proporção 2:1 na largura máxima.
    expect(img.complete && img.naturalWidth > 0).toBe(false);
    expect(Math.round(moldura.offsetWidth)).toBe(400);
    expect(Math.round(moldura.offsetHeight)).toBe(200);
  });

  it("sem imagem (servidor sem proxy) o cartão é só de texto", async () => {
    await prontaNoFim();
    chegar(ultimaId(), [site()]);
    await expect.poll(() => cartoes().length).toBe(1);
    expect(cartoes()[0]!.querySelector("img")).toBeNull();
  });

  it("special: miniatura com play, e o iframe SÓ existe depois do clique", async () => {
    await prontaNoFim();
    chegar(ultimaId(), [
      site({
        titulo: "Um vídeo",
        imagem: { url: SEM_REDE, largura: 1280, altura: 720 },
        especial: {
          servico: "YouTube",
          playerUrl: "https://www.youtube-nocookie.com/embed/abc?modestbranding=1",
          audio: false,
        },
      }),
    ]);
    await expect.poll(() => cartoes().length).toBe(1);
    const player = cartoes()[0]!.querySelector<HTMLElement>("[data-player='YouTube']")!;
    expect(document.querySelector("iframe")).toBeNull();
    expect(Math.round(player.offsetHeight)).toBe(225);

    cartoes()[0]!.querySelector<HTMLButtonElement>("button[aria-label='Reproduzir YouTube']")!.click();
    await expect.poll(() => document.querySelector("iframe")).not.toBeNull();
    const frame = document.querySelector("iframe")!;
    expect(frame.src).toContain("https://www.youtube-nocookie.com/embed/abc");
    expect(frame.getAttribute("sandbox")).toContain("allow-scripts");
    // Tocar não pula: a caixa do player é a mesma da miniatura.
    expect(Math.round(player.offsetHeight)).toBe(225);
  });

  it("mostra no máximo três e diz quantos faltam", async () => {
    await prontaNoFim();
    chegar(
      ultimaId(),
      Array.from({ length: 5 }, (_, i) => site({ id: `https://exemplo.com/${String(i)}`, titulo: `Link ${String(i)}` })),
    );
    await expect.poll(() => cartoes().length).toBe(3);
    expect(cartoes()[0]!.closest("[data-embeds]")!.textContent).toContain("e mais 2");
  });

  it("desligar a prévia nas configurações esconde os cartões", async () => {
    await prontaNoFim();
    chegar(ultimaId(), [site()]);
    await expect.poll(() => cartoes().length).toBe(1);
    definirAparencia({ previasDeLink: false });
    await expect.poll(() => cartoes().length).toBe(0);
    definirAparencia({ previasDeLink: true });
    await expect.poll(() => cartoes().length).toBe(1);
  });
});

describe("chegada tardia do embed", () => {
  it("no fim: a lista continua colada ao fim depois que o cartão cresce a linha", async () => {
    await prontaNoFim();
    const antes = log().scrollHeight;
    chegar(ultimaId(), [site({ imagemGrande: true, imagem: { url: SEM_REDE, largura: 800, altura: 400 } })]);
    await expect.poll(() => log().scrollHeight, { timeout: 4000 }).toBeGreaterThan(antes + 100);
    await expect.poll(distanciaDoFim, { timeout: 4000 }).toBeLessThanOrEqual(80);
  });

  async function lerNoMeio() {
    await prontaNoFim();
    // Sobe até o meio, com gesto de verdade para a lista soltar o fim. Repete: sob carga
    // (suíte em paralelo) a lista ainda está assentando a âncora e pode puxar de volta.
    await expect
      .poll(
        () => {
          log().dispatchEvent(new WheelEvent("wheel", { deltaY: -400, bubbles: true }));
          log().scrollTop = Math.max(0, log().scrollTop - 4000);
          return distanciaDoFim();
        },
        { timeout: 5000, interval: 100 },
      )
      .toBeGreaterThan(800);
    await esperar(400);
    expect(distanciaDoFim()).toBeGreaterThan(800);
  }
  const idDaLinha = (l: HTMLElement) => l.querySelector("[data-menu-mensagem]")!.getAttribute("data-menu-mensagem")!;
  const topo = (l: HTMLElement) => l.getBoundingClientRect().top;

  it("lendo no meio: cartão numa linha ACIMA da tela não move o que se lê", async () => {
    await lerNoMeio();
    const caixa = log().getBoundingClientRect();
    const inteiras = linhas().filter((l) => topo(l) >= caixa.top && l.getBoundingClientRect().bottom <= caixa.bottom);
    expect(inteiras.length).toBeGreaterThan(1);
    const ancora = inteiras[0]!;
    // Uma linha montada (overscan) que está INTEIRA acima da borda de cima.
    const acima = linhas().filter((l) => l.getBoundingClientRect().bottom <= caixa.top);
    expect(acima.length).toBeGreaterThan(0);
    const topoAntes = topo(ancora);

    chegar(idDaLinha(acima[acima.length - 1]!), [
      site({ imagemGrande: true, imagem: { url: SEM_REDE, largura: 800, altura: 400 } }),
    ]);
    await expect.poll(() => cartoes().length, { timeout: 4000 }).toBeGreaterThan(0);
    await esperar(300);

    const depois = linhas().find((l) => l.dataset.index === ancora.dataset.index)!;
    expect(Math.abs(topo(depois) - topoAntes)).toBeLessThanOrEqual(2);
  });

  it("lendo no meio: cartão numa linha mais ABAIXO na tela não move as linhas de cima", async () => {
    await lerNoMeio();
    const caixa = log().getBoundingClientRect();
    const inteiras = linhas().filter((l) => topo(l) >= caixa.top && l.getBoundingClientRect().bottom <= caixa.bottom);
    expect(inteiras.length).toBeGreaterThan(1);
    const ancora = inteiras[0]!;
    const topoAntes = topo(ancora);

    chegar(idDaLinha(inteiras[inteiras.length - 1]!), [site()]);
    await expect.poll(() => cartoes().length, { timeout: 4000 }).toBeGreaterThan(0);
    await esperar(300);

    const depois = linhas().find((l) => l.dataset.index === ancora.dataset.index)!;
    expect(Math.abs(topo(depois) - topoAntes)).toBeLessThanOrEqual(2);
  });
});
