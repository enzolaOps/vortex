import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  aoTeclarNoGatilho,
  despacharMenuEm,
  reivindicarGesto,
} from "./MenuDeContexto";

/**
 * O mecanismo de abertura, e o que estes testes guardam é a auditoria.
 *
 * Três das seis quebras que a auditoria de clique direito achou viviam aqui, e
 * nenhuma delas dá erro: menu com o alvo do gesto anterior (long-press), dois
 * menus no toque (aninhamento) e teclado sem caminho nenhum fora da timeline.
 * O que se perde ao quebrar cada uma é silencioso, então a guarda precisa ser
 * teste e não olho.
 */

const TECLA = {
  key: "",
  shiftKey: false,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
};

function montar(html: string): HTMLElement {
  document.body.innerHTML = `<div id="gatilho">${html}</div>`;
  return document.querySelector<HTMLElement>("#gatilho")!;
}

describe("caminho de teclado", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("a tecla Menu e Shift+F10 abrem no elemento FOCADO, não no gatilho", () => {
    const gatilho = montar('<article id="linha">oi</article>');
    const linha = document.querySelector<HTMLElement>("#linha")!;

    expect(aoTeclarNoGatilho({ ...TECLA, key: "ContextMenu" }, gatilho, linha, false)).toBe(linha);
    expect(
      aoTeclarNoGatilho({ ...TECLA, key: "F10", shiftKey: true }, gatilho, linha, false),
    ).toBe(linha);
  });

  it("sem foco dentro do gatilho, o alvo é o próprio gatilho", () => {
    const gatilho = montar("<article>oi</article>");
    const fora = document.createElement("button");
    document.body.append(fora);

    expect(aoTeclarNoGatilho({ ...TECLA, key: "ContextMenu" }, gatilho, fora, false)).toBe(gatilho);
    expect(aoTeclarNoGatilho({ ...TECLA, key: "ContextMenu" }, gatilho, null, false)).toBe(gatilho);
  });

  it("`F10` sem Shift e tecla qualquer não pedem menu", () => {
    const gatilho = montar("<article>oi</article>");
    expect(aoTeclarNoGatilho({ ...TECLA, key: "F10" }, gatilho, null, false)).toBeNull();
    expect(aoTeclarNoGatilho({ ...TECLA, key: "a" }, gatilho, null, false)).toBeNull();
  });

  /* Atalho de sistema passa direto — `Alt+Seta` é voltar no histórico, e
     `Ctrl+Shift+F10` pertence ao navegador. */
  it("modificador de sistema devolve o evento ao navegador", () => {
    const gatilho = montar("<article>oi</article>");
    for (const mod of ["ctrlKey", "altKey", "metaKey"] as const) {
      expect(
        aoTeclarNoGatilho({ ...TECLA, key: "ContextMenu", [mod]: true }, gatilho, null, false),
      ).toBeNull();
    }
  });

  it("`Enter` só abre onde foi pedido, e nunca dentro de um controle", () => {
    const gatilho = montar('<article id="linha">texto <a href="#x" id="link">ir</a></article>');
    const linha = document.querySelector<HTMLElement>("#linha")!;
    const link = document.querySelector<HTMLElement>("#link")!;

    // Sem `abrirComEnter`, a tecla não é deste mecanismo.
    expect(aoTeclarNoGatilho({ ...TECLA, key: "Enter" }, gatilho, linha, false)).toBeNull();
    expect(aoTeclarNoGatilho({ ...TECLA, key: "Enter" }, gatilho, linha, true)).toBe(linha);

    /* ⚠ O caso que justifica o seletor: `Enter` num link é ABRIR o link. Se
       o menu roubasse a tecla, o link do texto de uma mensagem deixaria de
       funcionar por teclado — e nada falharia. */
    expect(aoTeclarNoGatilho({ ...TECLA, key: "Enter" }, gatilho, link, true)).toBeNull();
    // A tecla Menu continua valendo ali: ela não disputa com ativação nenhuma.
    expect(aoTeclarNoGatilho({ ...TECLA, key: "ContextMenu" }, gatilho, link, true)).toBe(link);
  });

  it("despacha o MESMO evento do clique direito, e ele borbulha", () => {
    const gatilho = montar('<article id="linha">oi</article>');
    const linha = document.querySelector<HTMLElement>("#linha")!;
    const visto = vi.fn();
    gatilho.addEventListener("contextmenu", visto);

    despacharMenuEm(linha);

    expect(visto).toHaveBeenCalledTimes(1);
    const evento = visto.mock.calls[0]![0] as MouseEvent;
    expect(evento.type).toBe("contextmenu");
    expect(evento.cancelable).toBe(true);
    expect(evento.target).toBe(linha);
  });
});

describe("aninhamento no toque", () => {
  /**
   * ⚠ **O defeito: dois menus abertos com um toque longo.**
   *
   * Com mouse o gatilho interno previne o `contextmenu` e o externo o vê
   * prevenido. O long-press não passa por ali — cada gatilho arma o próprio
   * timer no `pointerdown`, e os dois abrem. Quem reivindica primeiro é o mais
   * interno, porque o evento sobe.
   */
  it("só o primeiro gatilho fica com o gesto", () => {
    const gesto = new Event("pointerdown");
    expect(reivindicarGesto(gesto)).toBe(true);
    expect(reivindicarGesto(gesto)).toBe(false);

    // Gesto novo é gesto novo — a marca não vaza entre toques.
    expect(reivindicarGesto(new Event("pointerdown"))).toBe(true);
  });
});
