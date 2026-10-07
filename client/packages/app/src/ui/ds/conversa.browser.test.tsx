import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

import { chat, salas } from "../../textos";
import { CampoDeMensagem, Digitando, ItemDeSala, Mensagem } from "./index";
import { desmontar, montar, pegar, umSoAnel } from "./montar";

afterEach(desmontar);

const q = (id: string) => pegar(`[data-testid="${id}"]`)!;

describe("ItemDeSala", () => {
  const pessoas = [
    { nome: "Ana", id: "1" },
    { nome: "Bia", id: "2" },
  ];

  it("sala: mostra a contagem sempre, inclusive zero, e diz em texto", () => {
    montar(
      <>
        <ItemDeSala nome="Geral" pessoas={pessoas} data-testid="cheia" />
        <ItemDeSala nome="Vazia" data-testid="vazia" />
      </>,
    );
    expect(q("cheia").querySelector(`[aria-label="${salas.naSala(2)}"]`)?.textContent).toBe("2");
    expect(q("vazia").querySelector(`[aria-label="${salas.naSala(0)}"]`)?.textContent).toBe("0");
    expect(getComputedStyle(q("vazia")).color).not.toBe(getComputedStyle(q("cheia")).color);
  });

  it("selecionado: aria-current e marcador de 3px; conectado e ao vivo têm rótulo próprio", () => {
    montar(
      <ItemDeSala nome="Geral" selecionado conectado aoVivo pessoas={pessoas} data-testid="i" />,
    );
    expect(q("i").getAttribute("aria-current")).toBe("true");
    expect(getComputedStyle(q("i"), "::before").width).toBe("3px");
    expect(pegar('[aria-label="Você está aqui"]')).not.toBeNull();
    expect(q("i").textContent).toContain("AO VIVO");
  });

  it("canal: desenha o # sozinho, e menção vence o ponto de não lida", () => {
    montar(
      <>
        <ItemDeSala tipo="canal" nome="geral" naoLida data-testid="a" />
        <ItemDeSala tipo="canal" nome="avisos" naoLida mencoes={3} data-testid="b" />
        <ItemDeSala tipo="canal" nome="lido" data-testid="c" />
      </>,
    );
    expect(q("a").textContent?.startsWith("#geral")).toBe(true);
    expect(q("a").querySelector('[aria-label="Não lida"]')).not.toBeNull();
    expect(Number(getComputedStyle(q("a")).fontWeight)).toBeGreaterThanOrEqual(700);
    expect(Number(getComputedStyle(q("c")).fontWeight)).toBeLessThan(700);
    expect(q("b").querySelector('[aria-label="Não lida"]')).toBeNull();
    expect(q("b").querySelector('[aria-label="3 menções"]')).not.toBeNull();
  });

  it("teclado: Tab foca com um só anel e Enter aciona", async () => {
    const aoClicar = vi.fn();
    montar(<ItemDeSala nome="Geral" onClick={aoClicar} data-testid="i" />);
    await userEvent.tab();
    expect(document.activeElement).toBe(q("i"));
    expect(umSoAnel(q("i"))).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(aoClicar).toHaveBeenCalledOnce();
  });

  it("nome longo é cortado sem estourar a linha", () => {
    montar(
      <div style={{ width: 200 }}>
        <ItemDeSala
          nome="Um nome de sala absurdamente comprido para a coluna estreita"
          data-testid="i"
        />
      </div>,
    );
    expect(q("i").getBoundingClientRect().width).toBeLessThanOrEqual(200);
  });
});

describe("Mensagem", () => {
  const autor = { nome: "Caio Melo", id: "u1" };

  it("inicial: avatar, nome e hora; continuação: sem avatar nem nome", () => {
    montar(
      <>
        <Mensagem autor={autor} hora="14:32">
          Olá
        </Mensagem>
        <Mensagem autor={autor} hora="14:33" continuacao>
          Segunda
        </Mensagem>
      </>,
    );
    const [a, b] = Array.from(document.querySelectorAll("article"));
    expect(a?.querySelector('[role="img"]')).not.toBeNull();
    expect(a?.textContent).toContain("Caio Melo");
    expect(a?.textContent).toContain("14:32");
    expect(b?.querySelector('[role="img"]')).toBeNull();
    expect(b?.querySelector("time")?.textContent).toBe("14:33");
    expect(getComputedStyle(b!.querySelector("time")!).opacity).toBe("0");
  });

  it("citação de resposta e link no corpo em destaque sublinhado", () => {
    montar(
      <Mensagem autor={autor} hora="14:32" resposta={{ autor: "Ana", trecho: "Vamos?" }}>
        Veja{" "}
        <a href="https://exemplo.com" data-testid="l">
          isto
        </a>
      </Mensagem>,
    );
    expect(pegar('[aria-label="Resposta a Ana"]')?.textContent).toContain("Vamos?");
    expect(getComputedStyle(q("l")).textDecorationLine).toBe("underline");
  });

  it("anexo reserva a caixa pela proporção antes de qualquer imagem", () => {
    montar(
      <div style={{ width: 800 }}>
        <Mensagem autor={autor} hora="14:32" anexo={{ proporcao: "16 / 9", rotulo: "foto.png" }} />
      </div>,
    );
    const caixa = pegar('[aria-label="foto.png"]')!.getBoundingClientRect();
    expect(caixa.width).toBe(360);
    expect(caixa.height).toBeCloseTo(202.5, 0);
  });

  it("medida de leitura: em tela larga o texto não passa de ~70 caracteres", () => {
    montar(
      <div style={{ width: 2400 }}>
        <Mensagem autor={autor} hora="14:32">
          {"palavra ".repeat(300)}
        </Mensagem>
      </div>,
    );
    const largura = document
      .querySelector("article > div:nth-child(2)")!
      .getBoundingClientRect().width;
    expect(largura).toBeGreaterThan(400);
    expect(largura).toBeLessThan(900);
  });

  it("barra de ações: escondida em repouso, aparece no hover e com o foco do teclado", async () => {
    const aoResponder = vi.fn();
    montar(
      <Mensagem
        autor={autor}
        hora="14:32"
        tabIndex={0}
        onReagir={() => undefined}
        onResponder={aoResponder}
      >
        Olá
      </Mensagem>,
    );
    const barra = pegar('[role="toolbar"]')!;
    expect(getComputedStyle(barra).visibility).toBe("hidden");

    await userEvent.hover(pegar("article")!);
    await expect.poll(() => getComputedStyle(barra).visibility).toBe("visible");
    await userEvent.unhover(pegar("article")!);
    await expect.poll(() => getComputedStyle(barra).visibility).toBe("hidden");

    await userEvent.tab();
    expect(document.activeElement).toBe(pegar("article"));
    expect(umSoAnel(pegar("article")!)).toBe(true);
    await expect.poll(() => getComputedStyle(barra).visibility).toBe("visible");
    await userEvent.tab();
    expect(document.activeElement).toBe(pegar('[aria-label="Reagir"]'));
    await userEvent.tab();
    expect(document.activeElement).toBe(pegar(`[aria-label="${chat.responder}"]`));
    await userEvent.keyboard("{Enter}");
    expect(aoResponder).toHaveBeenCalledOnce();
  });

  it("só desenha os botões que têm ação, e nenhuma barra sem nenhum", () => {
    montar(
      <>
        <Mensagem autor={autor} hora="14:32" onMaisAcoes={() => undefined} />
        <Mensagem autor={{ nome: "Bia" }} hora="14:35" />
      </>,
    );
    expect(document.querySelectorAll('[role="toolbar"]').length).toBe(1);
    expect(document.querySelectorAll('[role="toolbar"] button').length).toBe(1);
  });

  it("a altura da linha não muda no hover (a barra sobrepõe)", async () => {
    montar(
      <Mensagem autor={autor} hora="14:32" onReagir={() => undefined}>
        Olá
      </Mensagem>,
    );
    const antes = pegar("article")!.getBoundingClientRect().height;
    await userEvent.hover(pegar("article")!);
    expect(pegar("article")!.getBoundingClientRect().height).toBe(antes);
  });

  it("memo: re-render do pai com as mesmas props não re-renderiza a linha", async () => {
    let renders = 0;
    function Corpo() {
      renders++;
      return <span>texto</span>;
    }
    const corpo = <Corpo />;
    function Pai() {
      const [n, setN] = useState(0);
      return (
        <>
          <button
            data-testid="b"
            onClick={() => {
              setN(n + 1);
            }}
          >
            {n}
          </button>
          <Mensagem autor={autor} hora="14:32">
            {corpo}
          </Mensagem>
        </>
      );
    }
    montar(<Pai />);
    const inicial = renders;
    await userEvent.click(q("b"));
    expect(q("b").textContent).toBe("1");
    expect(renders).toBe(inicial);
  });
});

describe("Digitando", () => {
  it("região educada que continua montada quando ninguém digita", () => {
    montar(<Digitando nomes={[]} />);
    const r = pegar('[role="status"]')!;
    expect(r.getAttribute("aria-live")).toBe("polite");
    expect(r.textContent).toBe("");
  });

  it("um, dois e vários", () => {
    montar(
      <>
        <div data-testid="1">
          <Digitando nomes={["Davi"]} />
        </div>
        <div data-testid="2">
          <Digitando nomes={["Davi", "Ana"]} />
        </div>
        <div data-testid="3">
          <Digitando nomes={["Davi", "Ana", "Bia"]} />
        </div>
      </>,
    );
    expect(q("1").textContent).toBe("Davi está digitando…");
    expect(q("2").textContent).toBe("Davi e Ana estão digitando…");
    expect(q("3").textContent).toBe("Várias pessoas estão digitando…");
  });
});

describe("CampoDeMensagem", () => {
  const area = () => pegar<HTMLTextAreaElement>("textarea")!;
  const enviarBtn = () => pegar(`[aria-label="${chat.enviar}"]`)!;

  it("Enter envia sem espaços nas pontas e limpa; Shift+Enter quebra linha", async () => {
    const aoEnviar = vi.fn();
    montar(<CampoDeMensagem onEnviar={aoEnviar} />);
    await userEvent.click(area());
    await userEvent.keyboard("  olá{Shift>}{Enter}{/Shift}mundo  ");
    expect(area().value).toBe("  olá\nmundo  ");
    await userEvent.keyboard("{Enter}");
    expect(aoEnviar).toHaveBeenCalledExactlyOnceWith("olá\nmundo");
    expect(area().value).toBe("");
  });

  it("enviar fica desabilitado enquanto vazio e Enter vazio não envia", async () => {
    const aoEnviar = vi.fn();
    montar(<CampoDeMensagem onEnviar={aoEnviar} />);
    expect(enviarBtn().hasAttribute("disabled")).toBe(true);
    await userEvent.click(area());
    await userEvent.keyboard("   {Enter}");
    expect(aoEnviar).not.toHaveBeenCalled();
    await userEvent.keyboard("a");
    expect(enviarBtn().hasAttribute("disabled")).toBe(false);
    await userEvent.click(enviarBtn());
    expect(aoEnviar).toHaveBeenCalledOnce();
  });

  it("controlado: o pai manda o valor e recebe onChange", async () => {
    const aoMudar = vi.fn();
    montar(<CampoDeMensagem valor="fixo" onChange={aoMudar} />);
    await userEvent.click(area());
    await userEvent.keyboard("x");
    expect(aoMudar).toHaveBeenCalledWith("fixox");
    expect(area().value).toBe("fixo");
  });

  it("cresce com as linhas e para no teto de 8, rolando por dentro", async () => {
    montar(<CampoDeMensagem />);
    const h1 = area().getBoundingClientRect().height;
    await userEvent.click(area());
    await userEvent.keyboard("a{Shift>}{Enter}{/Shift}b{Shift>}{Enter}{/Shift}c");
    expect(area().getBoundingClientRect().height).toBeGreaterThan(h1);
    for (let i = 0; i < 12; i++) await userEvent.keyboard("{Shift>}{Enter}{/Shift}x");
    expect(area().getBoundingClientRect().height).toBe(176);
    expect(area().scrollHeight).toBeGreaterThan(176);
  });

  it("um único anel: no contêiner com o texto focado, só no botão com o botão focado", async () => {
    montar(<CampoDeMensagem valorInicial="oi" onAnexar={() => undefined} />);
    const painel = area().parentElement!.parentElement!;
    await userEvent.tab();
    expect(document.activeElement).toBe(pegar(`[aria-label="${chat.anexar}"]`));
    expect(getComputedStyle(painel).outlineStyle).toBe("none");
    expect(umSoAnel(document.activeElement!)).toBe(true);
    await userEvent.tab();
    expect(document.activeElement).toBe(area());
    expect(getComputedStyle(area()).outlineStyle).toBe("none");
    expect(getComputedStyle(painel).outlineStyle).toBe("solid");
    expect(getComputedStyle(painel).outlineWidth).toBe("2px");
    await userEvent.tab();
    expect(document.activeElement).toBe(enviarBtn());
    expect(getComputedStyle(painel).outlineStyle).toBe("none");
  });

  it("desabilitado: bloqueia tudo e diz o motivo ligado ao campo", () => {
    montar(
      <CampoDeMensagem
        desabilitado
        motivo="Você não pode escrever aqui"
        onEmoji={() => undefined}
      />,
    );
    expect(area().disabled).toBe(true);
    expect(enviarBtn().hasAttribute("disabled")).toBe(true);
    expect(pegar('[aria-label="Inserir emoji"]')!.hasAttribute("disabled")).toBe(true);
    const motivo = pegar("p")!;
    expect(motivo.textContent).toBe("Você não pode escrever aqui");
    expect(area().getAttribute("aria-describedby")).toBe(motivo.id);
  });

  it("enviando: o botão vira giro com aria-busy e o envio fica bloqueado", async () => {
    const aoEnviar = vi.fn();
    montar(<CampoDeMensagem valorInicial="oi" enviando onEnviar={aoEnviar} />);
    expect(enviarBtn().getAttribute("aria-busy")).toBe("true");
    expect(enviarBtn().querySelector("svg")).toBeNull();
    await userEvent.click(area());
    await userEvent.keyboard("{Enter}");
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  it("o placeholder é também o nome acessível", () => {
    montar(<CampoDeMensagem placeholder="Conversar em geral" />);
    expect(area().getAttribute("aria-label")).toBe("Conversar em geral");
    expect(area().placeholder).toBe("Conversar em geral");
  });
});
