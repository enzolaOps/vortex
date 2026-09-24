import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  NOME_DO_POPOUT,
  RECUO,
  TAMANHO_INICIAL,
  aberturaLegitima,
  boundsAncorados,
  decidirJanelaNova,
  opcoesDoPopout,
  posicaoInicial,
} from "./popoutDeVozModelo";

const LIVRE = { daPrincipal: true, popoutAberto: false };

describe("popout da chamada — quem pode abrir janela", () => {
  it("a principal abre o popout pelo nome, com URL vazia ou about:blank", () => {
    assert.equal(
      decidirJanelaNova({ url: "", frameName: NOME_DO_POPOUT }, LIVRE),
      "popout",
    );
    assert.equal(
      decidirJanelaNova(
        { url: "about:blank", frameName: NOME_DO_POPOUT },
        LIVRE,
      ),
      "popout",
    );
  });

  it("um por app: com um aberto, o segundo é negado", () => {
    assert.equal(
      decidirJanelaNova(
        { url: "", frameName: NOME_DO_POPOUT },
        { daPrincipal: true, popoutAberto: true },
      ),
      "negar",
    );
  });

  it("só a principal: overlay, o próprio popout ou qualquer outro conteúdo são negados", () => {
    assert.equal(
      decidirJanelaNova(
        { url: "", frameName: NOME_DO_POPOUT },
        { daPrincipal: false, popoutAberto: false },
      ),
      "negar",
    );
  });

  /*
    O nome com outra URL seria uma página de terceiro sempre no topo. Ele não
    abre janela nenhuma: cai na regra de sempre — link vai ao navegador do
    sistema, o resto é negado.
  */
  it("o nome não transforma URL nenhuma além da vazia em janela", () => {
    for (const url of ["https://exemplo.com", "http://localhost:4174/"]) {
      assert.equal(
        decidirJanelaNova({ url, frameName: NOME_DO_POPOUT }, LIVRE),
        "externo",
        url,
      );
    }
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,oi",
      "file:///C:/x",
    ]) {
      assert.equal(
        decidirJanelaNova({ url, frameName: NOME_DO_POPOUT }, LIVRE),
        "negar",
        url,
      );
    }
  });

  /* E about:blank sem o nome é o que qualquer script pediria. */
  it("about:blank sem o nome é negado", () => {
    assert.equal(
      decidirJanelaNova({ url: "about:blank", frameName: "" }, LIVRE),
      "negar",
    );
    assert.equal(
      decidirJanelaNova({ url: "", frameName: "outra" }, LIVRE),
      "negar",
    );
  });

  it("o resto segue a regra de sempre: link externo vai ao navegador, o resto é negado", () => {
    assert.equal(
      decidirJanelaNova({ url: "https://exemplo.com/a", frameName: "" }, LIVRE),
      "externo",
    );
    assert.equal(
      decidirJanelaNova({ url: "mailto:a@b.c", frameName: "_blank" }, LIVRE),
      "externo",
    );
    assert.equal(
      decidirJanelaNova({ url: "file:///C:/x", frameName: "" }, LIVRE),
      "negar",
    );
    assert.equal(
      decidirJanelaNova({ url: "javascript:alert(1)", frameName: "" }, LIVRE),
      "negar",
    );
  });
});

describe("popout da chamada — quem abriu, de verdade", () => {
  const principal = {
    url: "https://vortex.local/servidor/a/canal/b",
    processId: 4,
    routingId: 1,
  };
  const origem = "https://vortex.local";

  it("o frame principal da principal, na origem do app", () => {
    assert.equal(aberturaLegitima(principal, principal, origem), true);
  });

  it("um iframe dentro da principal não passa, mesmo no mesmo processo", () => {
    const iframe = {
      url: "https://vortex.local/atividade",
      processId: 4,
      routingId: 7,
    };
    assert.equal(aberturaLegitima(iframe, principal, origem), false);
  });

  it("a principal fora da origem do app não passa", () => {
    const fora = { ...principal, url: "https://outro.site/" };
    assert.equal(aberturaLegitima(fora, fora, origem), false);
  });

  it("sem opener ou sem principal, nada passa", () => {
    assert.equal(aberturaLegitima(null, principal, origem), false);
    assert.equal(aberturaLegitima(undefined, principal, origem), false);
    assert.equal(aberturaLegitima(principal, undefined, origem), false);
  });
});

describe("popout da chamada — a janela", () => {
  it("nasce no canto inferior do fim da área de trabalho, com o recuo do cartão", () => {
    const area = { x: 0, y: 0, width: 1920, height: 1040 };
    assert.deepEqual(posicaoInicial(area), {
      x: 1920 - TAMANHO_INICIAL.width - RECUO,
      y: 1040 - TAMANHO_INICIAL.height - RECUO,
    });
  });

  /* Segundo monitor à esquerda do primário: coordenadas negativas são legítimas. */
  it("respeita a origem da tela onde a principal está", () => {
    const area = { x: -1280, y: 200, width: 1280, height: 984 };
    assert.deepEqual(posicaoInicial(area), {
      x: -1280 + 1280 - TAMANHO_INICIAL.width - RECUO,
      y: 200 + 984 - TAMANHO_INICIAL.height - RECUO,
    });
  });

  it("área menor que a janela encosta no início em vez de sair da tela", () => {
    assert.deepEqual(
      posicaoInicial({ x: 10, y: 20, width: 300, height: 200 }),
      { x: 10, y: 20 },
    );
  });

  it("sem moldura, sempre no topo, sem roubar o foco e alcançável pela barra de tarefas", () => {
    const o = opcoesDoPopout({ x: 0, y: 0, width: 1920, height: 1040 });
    assert.equal(o.frame, false);
    assert.equal(o.alwaysOnTop, true);
    assert.equal(o.show, false);
    assert.equal(o.skipTaskbar, false);
    assert.equal(o.resizable, false);
    assert.equal(o.width, TAMANHO_INICIAL.width);
  });
});

describe("popout da chamada — trocar de forma", () => {
  const area = { x: 0, y: 0, width: 2752, height: 1104 };

  it("encolher para o mínimo mantém o canto de baixo e do fim", () => {
    const atual = { x: 2316, y: 816, width: 420, height: 272 };
    const nova = boundsAncorados(atual, { width: 216, height: 120 }, area);
    assert.deepEqual(nova, { x: 2520, y: 968, width: 216, height: 120 });
    assert.equal(nova.x + nova.width, atual.x + atual.width);
    assert.equal(nova.y + nova.height, atual.y + atual.height);
  });

  it("crescer de volta devolve a janela ao lugar", () => {
    const minima = { x: 2520, y: 968, width: 216, height: 120 };
    assert.deepEqual(
      boundsAncorados(minima, { width: 420, height: 272 }, area),
      {
        x: 2316,
        y: 816,
        width: 420,
        height: 272,
      },
    );
  });

  /* Arrastada até o canto de cima e do começo, crescer empurraria a janela
     para coordenada negativa. */
  it("não sai da área de trabalho", () => {
    const noCanto = { x: 0, y: 0, width: 216, height: 120 };
    assert.deepEqual(
      boundsAncorados(noCanto, { width: 420, height: 272 }, area),
      {
        x: 0,
        y: 0,
        width: 420,
        height: 272,
      },
    );
    const segundaTela = { x: -1280, y: 200, width: 1280, height: 984 };
    const dentro = boundsAncorados(
      { x: -300, y: 1000, width: 216, height: 120 },
      { width: 420, height: 272 },
      segundaTela,
    );
    assert.ok(dentro.x >= -1280 && dentro.x + dentro.width <= 0);
    assert.ok(dentro.y >= 200 && dentro.y + dentro.height <= 1184);
  });

  it("pedido maior que a área é cortado a ela", () => {
    const nova = boundsAncorados(
      { x: 0, y: 0, width: 420, height: 272 },
      { width: 5000, height: 5000 },
      area,
    );
    assert.equal(nova.width, area.width);
    assert.equal(nova.height, area.height);
  });
});
