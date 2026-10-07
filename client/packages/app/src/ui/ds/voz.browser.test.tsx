import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { salas, voz } from "../../textos";
import { CapsulaDeControle, WidgetDaChamada, WidgetDaSala } from "./index";
import { desmontar, montar, pegar, umSoAnel } from "./montar";

afterEach(desmontar);

const q = (id: string) => pegar(`[data-testid="${id}"]`)!;
const rotulo = (texto: string) => pegar(`[aria-label="${texto}"]`)!;
const visibilidade = (el: Element) => getComputedStyle(el).visibility;

/** Palco de teste: ancestral posicionado, como o consumidor real. */
function Palco({ children }: { children: React.ReactNode }) {
  return (
    <div data-testid="palco" style={{ position: "relative", width: 700, height: 420 }}>
      {children}
    </div>
  );
}

const pessoas = [
  { nome: "Ana", id: "1", estado: "falando" as const },
  { nome: "Bia", id: "2", estado: "transmitindo" as const },
  { nome: "Caio", id: "3", estado: "mudo" as const },
  { nome: "Davi", id: "4" },
];

describe("WidgetDaSala", () => {
  const pilula = () => pegar<HTMLButtonElement>("button[aria-expanded]")!;
  const cartao = () => pegar("section")!;

  it("repouso: só a pílula, com contagem; o cartão está fora do alcance", () => {
    montar(<WidgetDaSala nome="Geral" pessoas={pessoas} aoVivo semPosicao />);
    expect(pilula().getAttribute("aria-expanded")).toBe("false");
    expect(pilula().textContent).toContain("Geral");
    expect(pilula().textContent).toContain("4");
    expect(pilula().textContent).toContain("AO VIVO");
    expect(visibilidade(cartao())).toBe("hidden");
    expect(pilula().getAttribute("aria-controls")).toBe(cartao().id);
  });

  it("ponteiro: abre ao passar, mostra cada pessoa com estado em texto e fecha ao sair", async () => {
    montar(<WidgetDaSala nome="Geral" pessoas={pessoas} semPosicao />);
    await userEvent.hover(pilula());
    await expect.poll(() => pilula().getAttribute("aria-expanded")).toBe("true");
    await expect.poll(() => visibilidade(cartao())).toBe("visible");
    const texto = cartao().textContent;
    expect(texto).toContain(voz.estado.falando);
    expect(texto).toContain(voz.estado.transmitindo);
    expect(texto).toContain(voz.estado.mudo);
    expect(cartao().querySelectorAll("li").length).toBe(4);

    await userEvent.unhover(pilula());
    await expect.poll(() => pilula().getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => visibilidade(cartao())).toBe("hidden");
  });

  it("ponteiro atravessa o vão entre a pílula e o cartão sem fechar", async () => {
    montar(
      <Palco>
        <WidgetDaSala nome="Geral" pessoas={pessoas} />
      </Palco>,
    );
    await userEvent.hover(pilula());
    await expect.poll(() => visibilidade(cartao())).toBe("visible");
    await userEvent.hover(cartao());
    await new Promise((r) => setTimeout(r, 250));
    expect(pilula().getAttribute("aria-expanded")).toBe("true");
  });

  it("teclado: Tab abre, Esc fecha e devolve o foco à pílula sem reabrir, Enter reabre", async () => {
    montar(<WidgetDaSala nome="Geral" pessoas={pessoas} onEntrar={() => undefined} semPosicao />);
    await userEvent.tab();
    expect(document.activeElement).toBe(pilula());
    expect(umSoAnel(pilula())).toBe(true);
    expect(pilula().getAttribute("aria-expanded")).toBe("true");

    await userEvent.tab(); // entra no cartão aberto
    expect(cartao().contains(document.activeElement)).toBe(true);
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).toBe(pilula());
    expect(pilula().getAttribute("aria-expanded")).toBe("false");
    await expect.poll(() => visibilidade(cartao())).toBe("hidden");

    await userEvent.keyboard("{Enter}");
    expect(pilula().getAttribute("aria-expanded")).toBe("true");
  });

  it("perder o foco do teclado fecha", async () => {
    montar(
      <>
        <WidgetDaSala nome="Geral" semPosicao />
        <button data-testid="fora">fora</button>
      </>,
    );
    await userEvent.tab();
    expect(pilula().getAttribute("aria-expanded")).toBe("true");
    await userEvent.tab();
    expect(document.activeElement).toBe(q("fora"));
    expect(pilula().getAttribute("aria-expanded")).toBe("false");
  });

  it("controlado: o estado vem de fora e a mudança é avisada", async () => {
    const aoMudar = vi.fn();
    montar(<WidgetDaSala nome="Geral" aberto={false} onAbertoChange={aoMudar} semPosicao />);
    await userEvent.hover(pilula());
    expect(aoMudar).toHaveBeenCalledWith(true);
    expect(pilula().getAttribute("aria-expanded")).toBe("false");
  });

  it("abertoInicial abre sem interação", () => {
    montar(<WidgetDaSala nome="Geral" abertoInicial semPosicao />);
    expect(pilula().getAttribute("aria-expanded")).toBe("true");
    expect(visibilidade(cartao())).toBe("visible");
  });

  it("sala vazia diz que ninguém está lá e mostra contagem zero", () => {
    montar(<WidgetDaSala nome="Geral" abertoInicial semPosicao />);
    expect(cartao().textContent).toContain(salas.vazia);
    expect(pilula().textContent).toContain("0");
  });

  it("ações só existem com tratador e disparam", async () => {
    const aoEntrar = vi.fn();
    const aoVerPalco = vi.fn();
    montar(
      <Palco>
        <WidgetDaSala nome="Geral" abertoInicial onEntrar={aoEntrar} onVerPalco={aoVerPalco} />
      </Palco>,
    );
    await userEvent.click(pegar(`button:not([aria-expanded])`)!);
    expect(aoEntrar).toHaveBeenCalledOnce();
    await userEvent.click(Array.from(document.querySelectorAll("button")).find((b) => b.textContent === voz.verPalco)!);
    expect(aoVerPalco).toHaveBeenCalledOnce();
  });

  it("sem tratadores não há botões de ação nem de canto", () => {
    montar(<WidgetDaSala nome="Geral" abertoInicial semPosicao />);
    expect(cartao().querySelectorAll("button").length).toBe(0);
  });

  it("fixa nos quatro cantos do ancestral", () => {
    const caixa = () => q("palco").getBoundingClientRect();
    const pos = (canto: "tl" | "tr" | "bl" | "br") => {
      montar(
        <Palco>
          <WidgetDaSala nome="Geral" canto={canto} />
        </Palco>,
      );
      const p = pilula().parentElement!.getBoundingClientRect();
      const c = caixa();
      const r = { esq: p.left - c.left, dir: c.right - p.right, topo: p.top - c.top, base: c.bottom - p.bottom };
      desmontar();
      return r;
    };
    expect(pos("tl")).toMatchObject({ esq: 16, topo: 16 });
    expect(pos("tr")).toMatchObject({ dir: 16, topo: 16 });
    expect(pos("bl")).toMatchObject({ esq: 16, base: 16 });
    expect(pos("br")).toMatchObject({ dir: 16, base: 16 });
  });

  it("botões de canto avisam o canto e marcam o atual", async () => {
    const aoCanto = vi.fn();
    montar(
      <Palco>
        <WidgetDaSala nome="Geral" abertoInicial canto="br" onCanto={aoCanto} />
      </Palco>,
    );
    expect(rotulo(voz.fixarNoCanto.br).getAttribute("aria-pressed")).toBe("true");
    expect(rotulo(voz.fixarNoCanto.tl).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(rotulo(voz.fixarNoCanto.tl));
    expect(aoCanto).toHaveBeenCalledWith("tl");
  });

  it("movimento: só opacidade e transform, em no máximo 200ms", () => {
    montar(<WidgetDaSala nome="Geral" semPosicao />);
    const e = getComputedStyle(cartao());
    const props = e.transitionProperty.split(",").map((p) => p.trim());
    expect(props).toEqual(expect.arrayContaining(["opacity", "transform"]));
    for (const d of e.transitionDuration.split(",")) {
      expect(parseFloat(d) * 1000).toBeLessThanOrEqual(200);
    }
  });
});

describe("CapsulaDeControle", () => {
  const botoes = () => ({
    mic: rotulo(voz.microfone),
    audio: rotulo(voz.audioRecebido),
    camera: rotulo(voz.camera),
    tela: rotulo(voz.compartilharTela),
    sair: rotulo(voz.sairDaChamada),
  });
  const todos = {
    onMudo: () => undefined,
    onSurdo: () => undefined,
    onCamera: () => undefined,
    onTela: () => undefined,
    onSair: () => undefined,
  };

  it("sala, tempo e quatro toggles de rótulo fixo mais o botão de sair", () => {
    montar(<CapsulaDeControle sala="Geral" tempo="12:04" {...todos} />);
    expect(document.body.textContent).toContain("Geral");
    expect(document.body.textContent).toContain("12:04");
    const b = botoes();
    expect(b.mic.getAttribute("aria-pressed")).toBe("true");
    expect(b.audio.getAttribute("aria-pressed")).toBe("true");
    expect(b.camera.getAttribute("aria-pressed")).toBe("false");
    expect(b.tela.getAttribute("aria-pressed")).toBe("false");
    expect(b.sair.hasAttribute("aria-pressed")).toBe(false);
  });

  it("mudo desliga o microfone; o ícone muda, o nome não", () => {
    montar(<CapsulaDeControle sala="Geral" {...todos} />);
    const ligado = botoes().mic.innerHTML;
    desmontar();
    montar(<CapsulaDeControle sala="Geral" mudo {...todos} />);
    expect(botoes().mic.getAttribute("aria-pressed")).toBe("false");
    expect(botoes().mic.getAttribute("aria-label")).toBe(voz.microfone);
    expect(botoes().mic.innerHTML).not.toBe(ligado);
  });

  it("surdo implica mudo: microfone desligado mesmo com mudo falso", () => {
    montar(<CapsulaDeControle sala="Geral" surdo mudo={false} {...todos} />);
    expect(botoes().audio.getAttribute("aria-pressed")).toBe("false");
    expect(botoes().mic.getAttribute("aria-pressed")).toBe("false");
  });

  it("cada controle dispara o seu callback, por mouse e por teclado", async () => {
    const f = { onMudo: vi.fn(), onSurdo: vi.fn(), onCamera: vi.fn(), onTela: vi.fn(), onSair: vi.fn() };
    montar(<CapsulaDeControle sala="Geral" {...f} />);
    const b = botoes();
    await userEvent.click(b.mic);
    await userEvent.click(b.audio);
    await userEvent.click(b.camera);
    await userEvent.click(b.tela);
    await userEvent.click(b.sair);
    b.mic.focus();
    await userEvent.keyboard(" ");
    for (const fn of Object.values(f)) expect(fn).toHaveBeenCalled();
    expect(f.onMudo).toHaveBeenCalledTimes(2);
  });

  it("controle sem tratador não aparece", () => {
    montar(<CapsulaDeControle sala="Geral" onMudo={() => undefined} />);
    expect(document.querySelectorAll("button").length).toBe(1);
  });

  it("Tab percorre os controles na ordem, cada um com um só anel", async () => {
    montar(<CapsulaDeControle sala="Geral" {...todos} />);
    const ordem = [voz.microfone, voz.audioRecebido, voz.camera, voz.compartilharTela, voz.sairDaChamada];
    for (const nome of ordem) {
      await userEvent.tab();
      expect(document.activeElement).toBe(rotulo(nome));
      expect(umSoAnel(document.activeElement!)).toBe(true);
    }
  });

  it("indicador de fala acende em texto e em forma", () => {
    montar(<CapsulaDeControle sala="Geral" falando {...todos} />);
    const ind = pegar('[role="img"]')!;
    expect(ind.getAttribute("aria-label")).toBe(voz.estado.falando);
    desmontar();
    montar(<CapsulaDeControle sala="Geral" {...todos} />);
    expect(pegar('[role="img"]')!.getAttribute("aria-label")).toBe(voz.ninguemFalando);
  });

  it("expande para cima com o ponteiro e recolhe com Esc", async () => {
    montar(
      <div style={{ padding: "200px 0 0 40px" }}>
        <CapsulaDeControle
          sala="Geral"
          qualidade="1080p60"
          pessoas={[
            { nome: "Ana", falando: true },
            { nome: "Bia", mudo: true },
          ]}
          {...todos}
        />
      </div>,
    );
    const extra = pegar('[role="group"][aria-label="Pessoas na chamada"]')!;
    expect(visibilidade(extra)).toBe("hidden");
    await userEvent.hover(botoes().mic);
    await expect.poll(() => visibilidade(extra)).toBe("visible");
    expect(extra.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      botoes().mic.closest("div[class*=barra]")!.getBoundingClientRect().top,
    );
    expect(extra.textContent).toContain("Ana");
    expect(extra.textContent).toContain("1080p60");
    expect(extra.querySelector(`[aria-label="${voz.estado.mudo}"]`)).not.toBeNull();

    // Esc só vale com o foco dentro: sem foco no widget a tecla não recolhe nada.
    await userEvent.keyboard("{Escape}");
    expect(visibilidade(extra)).toBe("visible");
    botoes().mic.focus();
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visibilidade(extra)).toBe("hidden");
  });

  it("foco de teclado também expande, e Esc recolhe mantendo o foco no controle", async () => {
    montar(
      <CapsulaDeControle sala="Geral" pessoas={[{ nome: "Ana" }]} {...todos} />,
    );
    const extra = pegar('[role="group"][aria-label="Pessoas na chamada"]')!;
    await userEvent.tab();
    await expect.poll(() => visibilidade(extra)).toBe("visible");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => visibilidade(extra)).toBe("hidden");
    expect(document.activeElement).toBe(botoes().mic);
  });

  it("controlado: expandido manda e a mudança é avisada", async () => {
    const aoMudar = vi.fn();
    montar(
      <CapsulaDeControle
        sala="Geral"
        pessoas={[{ nome: "Ana" }]}
        expandido
        onExpandidoChange={aoMudar}
        {...todos}
      />,
    );
    const extra = pegar('[role="group"][aria-label="Pessoas na chamada"]')!;
    expect(visibilidade(extra)).toBe("visible");
    botoes().mic.focus();
    await userEvent.keyboard("{Escape}");
    expect(aoMudar).toHaveBeenCalledWith(false);
    expect(visibilidade(extra)).toBe("visible");
  });
});

describe("WidgetDaChamada", () => {
  const regiao = () => pegar('[role="region"]')!;
  const escala = () => {
    const m = /matrix\(([\d.]+)/.exec(getComputedStyle(regiao()).transform);
    return m ? Number(m[1]) : 1;
  };

  it("é uma região rotulada e focável, com prévia 16:9 no palco", () => {
    montar(<WidgetDaChamada sala="Geral" tempo="12:04" transmissao="Tela da Ana" semPosicao />);
    expect(regiao().getAttribute("aria-label")).toBe(voz.chamada);
    expect(regiao().tabIndex).toBe(0);
    const palco = regiao().querySelector("div")!.getBoundingClientRect();
    expect(palco.width / palco.height).toBeCloseTo(16 / 9, 1);
    expect(getComputedStyle(regiao().querySelector("div")!).backgroundColor).toBe("rgb(7, 8, 12)");
    expect(regiao().textContent).toContain("Tela da Ana");
    expect(regiao().textContent).toContain("AO VIVO");
    expect(regiao().textContent).toContain("Geral · 12:04");
  });

  it("sem transmissão não há selo nem rótulo", () => {
    montar(<WidgetDaChamada sala="Geral" semPosicao />);
    expect(regiao().textContent).not.toContain("AO VIVO");
  });

  it("diz quem fala em texto; vazio = ninguém", () => {
    montar(<WidgetDaChamada quemFala="Ana" semPosicao />);
    expect(regiao().textContent).toContain(voz.falando("Ana"));
    desmontar();
    montar(<WidgetDaChamada semPosicao />);
    expect(regiao().textContent).not.toContain("falando");
    expect(regiao().querySelector(`[aria-label="${voz.ninguemFalando}"]`)).not.toBeNull();
  });

  it("repouso em escala 1; ponteiro amplia a partir do canto e sair devolve", async () => {
    montar(
      <Palco>
        <WidgetDaChamada sala="Geral" canto="br" onVoltar={() => undefined} />
      </Palco>,
    );
    expect(escala()).toBe(1);
    // Canto inferior direito: a origem é o canto, não o centro.
    const [ox, oy] = getComputedStyle(regiao()).transformOrigin.split(" ").map(parseFloat);
    expect(ox).toBeCloseTo(regiao().offsetWidth, 0);
    expect(oy).toBeCloseTo(regiao().getBoundingClientRect().height, 0);
    await userEvent.hover(regiao());
    await expect.poll(escala).toBeCloseTo(1.18, 2);
    await userEvent.unhover(regiao());
    await expect.poll(escala).toBe(1);
  });

  it("teclado: Tab foca a região (um anel) e amplia; Esc recolhe; revela Voltar ao palco", async () => {
    const aoVoltar = vi.fn();
    montar(<WidgetDaChamada sala="Geral" onVoltar={aoVoltar} semPosicao />);
    const voltar = () =>
      Array.from(document.querySelectorAll("button")).find((b) => b.textContent === voz.voltarAoPalco)!;
    expect(visibilidade(voltar())).toBe("hidden");

    await userEvent.tab();
    expect(document.activeElement).toBe(regiao());
    expect(getComputedStyle(regiao()).outlineStyle).toBe("solid");
    await expect.poll(escala).toBeCloseTo(1.18, 2);
    await expect.poll(() => visibilidade(voltar())).toBe("visible");

    await userEvent.tab();
    expect(document.activeElement).toBe(voltar());
    await userEvent.keyboard("{Enter}");
    expect(aoVoltar).toHaveBeenCalledOnce();

    await userEvent.keyboard("{Escape}");
    await expect.poll(escala).toBe(1);
    await expect.poll(() => visibilidade(voltar())).toBe("hidden");
  });

  it("controles iguais aos da cápsula e botões de canto", async () => {
    const aoCanto = vi.fn();
    const aoMudo = vi.fn();
    montar(
      <WidgetDaChamada canto="tl" onCanto={aoCanto} onMudo={aoMudo} mudo semPosicao />,
    );
    expect(rotulo(voz.microfone).getAttribute("aria-pressed")).toBe("false");
    await userEvent.click(rotulo(voz.microfone));
    expect(aoMudo).toHaveBeenCalledOnce();
    await userEvent.hover(regiao());
    await expect.poll(() => visibilidade(rotulo(voz.fixarNoCanto.br))).toBe("visible");
    expect(rotulo(voz.fixarNoCanto.tl).getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(rotulo(voz.fixarNoCanto.br));
    expect(aoCanto).toHaveBeenCalledWith("br");
  });

  it("fixa no canto do ancestral", () => {
    montar(
      <Palco>
        <WidgetDaChamada sala="Geral" canto="tr" />
      </Palco>,
    );
    const w = regiao().getBoundingClientRect();
    const c = q("palco").getBoundingClientRect();
    expect(c.right - w.right).toBe(16);
    expect(w.top - c.top).toBe(16);
  });

  it("movimento: só transform e opacidade, até 200ms", () => {
    montar(<WidgetDaChamada sala="Geral" semPosicao />);
    const e = getComputedStyle(regiao());
    expect(e.transitionProperty).toBe("transform");
    expect(parseFloat(e.transitionDuration) * 1000).toBeLessThanOrEqual(200);
  });
});
