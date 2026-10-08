import "../../arnes/redeFalsa";

import { CHANNEL_ID, SERVER_ID, seed, startFirehose } from "nucleo/arnes/firehose";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { AreaPrincipal } from "../../shell";
import { desmontar, montar, pegar } from "../../ui/ds/montar";
import { AreaDeChat } from "./AreaDeChat";
import { ListaDeMensagens } from "./ListaDeMensagens";

afterEach(desmontar);

let ids: readonly string[] = [];
beforeAll(async () => {
  ids = await seed(3000);
}, 60_000);

const log = () => pegar<HTMLElement>('[role="log"]')!;
const distanciaDoFim = () => log().scrollHeight - log().clientHeight - log().scrollTop;
const linhas = () => Array.from(document.querySelectorAll<HTMLElement>("[data-index]"));
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

function montarLista(largura = 900) {
  document.documentElement.dataset.tema = "vidro";
  return montar(
    <div style={{ inlineSize: `${largura}px`, blockSize: "600px", display: "grid" }}>
      <AreaPrincipal>
        <ListaDeMensagens canalId={CHANNEL_ID} servidorId={SERVER_ID} />
      </AreaPrincipal>
    </div>,
  );
}

describe("ListaDeMensagens", () => {
  it("virtualiza: monta só a janela visível de milhares de mensagens", async () => {
    montarLista();
    await expect.poll(() => linhas().length).toBeGreaterThan(0);
    expect(ids.length).toBe(3000);
    expect(linhas().length).toBeLessThan(80);
    // O container de rolagem tem teto: se não tivesse, as 3000 linhas montariam.
    expect(log().clientHeight).toBeLessThanOrEqual(600);
  });

  it("nasce ancorada no fim e nenhuma linha mede 0px", async () => {
    montarLista();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    for (const l of linhas()) expect(l.offsetHeight).toBeGreaterThan(0);
  });

  it("segue o fim sob firehose (followOnAppend vivo)", async () => {
    montarLista();
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    const antes = log().scrollHeight;
    const parar = startFirehose(500, ids);
    await esperar(3000);
    parar();
    await esperar(300);
    expect(log().scrollHeight).toBeGreaterThan(antes);
    expect(distanciaDoFim()).toBeLessThanOrEqual(80);
  }, 20_000);

  it("remede ao mudar a largura: todas as linhas na janela batem com a altura do DOM", async () => {
    const alvo = montarLista(900);
    await expect.poll(distanciaDoFim, { timeout: 5000 }).toBeLessThanOrEqual(80);
    (alvo.firstElementChild as HTMLElement).style.inlineSize = "420px";
    await esperar(400);
    const virtuais = linhas();
    expect(virtuais.length).toBeGreaterThan(0);
    // Sem remedição, as linhas ficariam posicionadas pela estimativa e se sobreporiam.
    for (let i = 1; i < virtuais.length; i++) {
      const anterior = virtuais[i - 1]!.getBoundingClientRect();
      const atual = virtuais[i]!.getBoundingClientRect();
      expect(atual.top).toBeGreaterThanOrEqual(anterior.bottom - 1);
    }
    expect(distanciaDoFim()).toBeLessThanOrEqual(80);
  });

  it("a coluna ocupa a largura toda, alinhada ao início, sem centralizar em tela larga", async () => {
    montarLista(2000);
    await expect.poll(() => linhas().length).toBeGreaterThan(0);
    const coluna = linhas()[0]!.parentElement!.parentElement!.getBoundingClientRect();
    const area = log().getBoundingClientRect();
    // Sem teto: a coluna só cede a calha da barra de rolagem.
    expect(coluna.left).toBeCloseTo(area.left, 0);
    expect(coluna.width).toBeGreaterThan(area.width - 24);
    expect(coluna.width).toBeGreaterThan(56 * 16);
  });

  it("o composer fica sob a coluna: mesmo início, mesmo recuo lateral", async () => {
    document.documentElement.dataset.tema = "vidro";
    montar(
      <div style={{ inlineSize: "2000px", blockSize: "600px", display: "grid" }}>
        <AreaPrincipal>
          <AreaDeChat canalId={CHANNEL_ID} servidorId={SERVER_ID} />
        </AreaPrincipal>
      </div>,
    );
    await expect.poll(() => linhas().length).toBeGreaterThan(0);
    const area = log().getBoundingClientRect();
    const composer = pegar<HTMLElement>("textarea")!;
    await expect.poll(() => composer.getBoundingClientRect().width).toBeGreaterThan(56 * 16);
    const campo = composer.getBoundingClientRect();
    // O campo preenche a largura (menos o recuo e os botões da caixa), e não uma coluna centrada.
    expect(campo.left - area.left).toBeLessThanOrEqual(80);
    expect(area.right - campo.right).toBeLessThanOrEqual(120);
  });
});
