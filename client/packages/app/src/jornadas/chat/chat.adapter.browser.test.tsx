import "../../arnes/redeFalsa";

import { CHANNEL_ID, SERVER_ID, seed } from "nucleo/arnes/firehose";
import {
  configurarSimulacaoDeEnvio,
  definirCanalAberto,
  primeiraNaoLida,
  usuarioLocalId,
} from "nucleo/sdk/adapter";
import { limparConexao } from "nucleo/store/conexao";
import { limparEdicaoDeMensagem } from "nucleo/store/edicaoDeMensagem";
import { limparFila } from "nucleo/store/fila";
import { limparRascunho } from "nucleo/store/rascunhos";
import { userEvent, page } from "vitest/browser";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { chat } from "../../textos";
import { AreaPrincipal } from "../../shell";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { AreaDeChat } from "./AreaDeChat";

/**
 * O chat contra o ADAPTER de verdade (sem dublês), com o envio simulado do arnês no
 * lugar do POST. É o que prova que a interface está ligada ao núcleo certo: o envio
 * otimista, a falha com reenvio, reagir, editar e fixar mexem nos objetos reais do SDK
 * e as linhas acordam por onde acordariam em produção.
 */

beforeAll(async () => {
  await seed(60);
}, 60_000);

beforeEach(() => {
  document.documentElement.dataset.tema = "vidro";
  limparConexao();
  limparFila();
  limparEdicaoDeMensagem();
  limparRascunho(CHANNEL_ID);
  configurarSimulacaoDeEnvio({ ativa: true, latenciaMs: 40 });
  definirCanalAberto(CHANNEL_ID);
});
afterEach(() => {
  desmontar();
  configurarSimulacaoDeEnvio({});
  definirCanalAberto(undefined);
});

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
const campo = () => pegar<HTMLTextAreaElement>("textarea")!;
const linhas = () => Array.from(document.querySelectorAll<HTMLElement>("[data-menu-mensagem]"));
const daUltima = (texto: string) => linhas().filter((l) => l.textContent?.includes(texto)).at(-1);
const menu = () => document.querySelector<HTMLElement>('[role="menu"]');

function abrir() {
  return montar(
    <div style={{ inlineSize: "960px", blockSize: "640px", display: "grid" }}>
      <AreaPrincipal>
        <AreaDeChat key={CHANNEL_ID} canalId={CHANNEL_ID} servidorId={SERVER_ID} />
      </AreaPrincipal>
    </div>,
  );
}

async function enviar(texto: string) {
  campo().focus();
  await userEvent.fill(campo(), texto);
  await userEvent.keyboard("{Enter}");
}

function clicarDireito(alvo: Element) {
  const r = alvo.getBoundingClientRect();
  alvo.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX: Math.round(r.left + 20),
      clientY: Math.round(r.top + 10),
    }),
  );
}

async function itemDoMenu(linha: HTMLElement, rotulo: string) {
  clicarDireito(linha.querySelector("article")!);
  await expect.poll(menu).not.toBeNull();
  const item = Array.from(menu()!.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((i) =>
    i.textContent?.includes(rotulo),
  );
  expect(item, `item "${rotulo}" do menu`).toBeDefined();
  return item!;
}

describe("chat contra o adapter real", () => {
  it("envio otimista: a linha nasce na hora, markdown renderizado, e a pessoa é a autora", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    expect(usuarioLocalId()).toBeDefined();
    await enviar("olá **mundo** real");
    await expect.poll(() => daUltima("olá")?.querySelector("strong")?.textContent).toBe("mundo");
    // Depois da latência simulada a confirmação chega: nada de "Enviando…" sobrando.
    await expect.poll(() => daUltima("olá")?.textContent?.includes(chat.enviando)).toBe(false);
    await expect.poll(() => campo().value).toBe("");
  });

  it("a própria mensagem nunca aparece como nova", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("minha, não é novidade");
    await expect.poll(() => daUltima("minha, não é novidade")).toBeDefined();
    await esperar(300);
    expect(primeiraNaoLida(CHANNEL_ID)).toBeUndefined();
    expect(document.querySelector("[data-novas]")).toBeNull();
  });

  it("falha de envio mostra Reenviar; com a rede de volta, reenviar confirma a mesma linha", async () => {
    configurarSimulacaoDeEnvio({ ativa: true, falhar: true, latenciaMs: 40 });
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("falha e volta");
    await expect.poll(() => daUltima("falha e volta")?.textContent).toContain(chat.naoEnviada);
    const linha = daUltima("falha e volta")!;
    expect(linha.textContent).toContain(chat.reenviar);
    expect(linha.textContent).toContain(chat.descartar);
    const quantas = linhas().filter((l) => l.textContent?.includes("falha e volta")).length;

    configurarSimulacaoDeEnvio({ ativa: true, latenciaMs: 40 });
    await page.getByRole("button", { name: chat.reenviar }).click();
    // Confirmada de verdade: nem "Não foi enviada" nem "Enviando…" sobrando.
    await expect
      .poll(() => {
        const t = daUltima("falha e volta")?.textContent ?? "";
        return t.includes(chat.naoEnviada) || t.includes(chat.enviando);
      })
      .toBe(false);
    // Mesma linha: reenviar não duplica a mensagem.
    expect(linhas().filter((l) => l.textContent?.includes("falha e volta"))).toHaveLength(quantas);
  });

  it("descartar a falhada tira a linha de verdade", async () => {
    configurarSimulacaoDeEnvio({ ativa: true, falhar: true, latenciaMs: 40 });
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("para descartar");
    await expect.poll(() => daUltima("para descartar")?.textContent).toContain(chat.naoEnviada);
    await page.getByRole("button", { name: chat.descartar }).click();
    await expect.poll(() => daUltima("para descartar")).toBeUndefined();
  });

  it("reagir na própria mensagem acende o chip, e clicar de novo apaga", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("para reagir");
    await expect.poll(() => daUltima("para reagir")?.textContent?.includes(chat.enviando)).toBe(false);
    const item = await itemDoMenu(daUltima("para reagir")!, "");
    expect(item).toBeDefined();
    menu()!.querySelector<HTMLElement>(`[aria-label="${chat.reagirComEmoji("😂")}"]`)!.click();
    await expect
      .poll(() => daUltima("para reagir")?.querySelector<HTMLButtonElement>("button[aria-pressed='true']")?.textContent)
      .toBe("😂1");
    daUltima("para reagir")!.querySelector<HTMLButtonElement>("button[aria-pressed]")!.click();
    await expect.poll(() => daUltima("para reagir")?.querySelector("button[aria-pressed]")).toBeNull();
  });

  it("editar in-line atualiza o texto e marca como editada", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("texto original");
    await expect.poll(() => daUltima("texto original")?.textContent?.includes(chat.enviando)).toBe(false);
    (await itemDoMenu(daUltima("texto original")!, chat.editar)).click();
    const area = await vi.waitUntil(() => daUltima("texto original")?.querySelector<HTMLTextAreaElement>("textarea"));
    area.focus();
    await userEvent.fill(area, "texto corrigido");
    await userEvent.keyboard("{Enter}");
    await expect.poll(() => daUltima("texto corrigido")?.textContent).toContain(`(${chat.editada})`);
  });

  it("fixar marca a linha como fixada, e o menu passa a oferecer desafixar", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("importante");
    await expect.poll(() => daUltima("importante")?.textContent?.includes(chat.enviando)).toBe(false);
    (await itemDoMenu(daUltima("importante")!, chat.fixar)).click();
    await expect.poll(() => daUltima("importante")?.textContent).toContain(chat.fixada);
    await expect.poll(menu).toBeNull();
    const item = await itemDoMenu(daUltima("importante")!, chat.desafixar);
    expect(item.textContent).toContain(chat.desafixar);
  });

  it("apagar não é otimista: sem o servidor aceitar, a linha continua", async () => {
    abrir();
    await expect.poll(() => linhas().length).toBeGreaterThan(5);
    await enviar("não apague já");
    await expect.poll(() => daUltima("não apague já")?.textContent?.includes(chat.enviando)).toBe(false);
    (await itemDoMenu(daUltima("não apague já")!, chat.apagar)).click();
    await vi.waitUntil(() => document.querySelector('[role="dialog"]'));
    await page.getByRole("button", { name: chat.apagar }).click();
    await expect.poll(() => document.querySelector('[role="dialog"]')).toBeNull();
    // Sem socket a chamada falha: a mensagem fica, em vez de sumir como se tivesse dado certo.
    expect(daUltima("não apague já")).toBeDefined();
  });
});
