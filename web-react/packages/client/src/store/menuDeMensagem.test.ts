import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assinarMenuDeMensagem,
  definirAlvoDoMenu,
  lerAlvoDoMenu,
} from "./menuDeMensagem";

/**
 * O store que permitiu UM `ContextMenu` na lista em vez de um por linha.
 *
 * O que os testes guardam é a economia, não a feature: cada linha montada
 * assina este store, então "notificar só quando muda de verdade" é o que
 * separa acordar duas linhas de acordar as trinta visíveis a cada clique
 * direito. Um `if` a menos aqui não quebra nada visível e devolve o custo que
 * a mudança inteira existiu para eliminar.
 */
describe("alvo do menu de mensagem", () => {
  beforeEach(() => definirAlvoDoMenu(null));

  it("guarda e devolve o alvo", () => {
    definirAlvoDoMenu("m1");
    expect(lerAlvoDoMenu()).toBe("m1");
    definirAlvoDoMenu(null);
    expect(lerAlvoDoMenu()).toBeNull();
  });

  it("NÃO avisa quando o alvo é o mesmo", () => {
    const ouvinte = vi.fn();
    const parar = assinarMenuDeMensagem(ouvinte);

    definirAlvoDoMenu("m1");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    // Clique direito duas vezes na MESMA linha: acontece o tempo todo, e a
    // segunda não deve acordar ninguém.
    definirAlvoDoMenu("m1");
    definirAlvoDoMenu("m1");
    expect(ouvinte).toHaveBeenCalledTimes(1);

    definirAlvoDoMenu("m2");
    expect(ouvinte).toHaveBeenCalledTimes(2);
    parar();
  });

  it("para de avisar depois de cancelar a assinatura", () => {
    // Linha desmonta na velocidade do scroll. Ouvinte sem cleanup aqui é o
    // erro nº 5 do briefing — vazamento que só aparece na sexta hora.
    const ouvinte = vi.fn();
    assinarMenuDeMensagem(ouvinte)();

    definirAlvoDoMenu("m1");
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("o getter devolve valor comparável — nunca objeto novo", () => {
    /*
      A linha assina `lerAlvoDoMenu() === id`, um booleano, e é isso que faz
      trinta subscrições custarem duas re-renderizações. Se o getter passasse a
      devolver um objeto, `Object.is` falharia sempre e a lista inteira
      re-renderizaria a cada render — a armadilha nº 1 do projeto.
    */
    definirAlvoDoMenu("m1");
    expect(Object.is(lerAlvoDoMenu(), lerAlvoDoMenu())).toBe(true);
    expect(typeof lerAlvoDoMenu()).toBe("string");
  });
});
