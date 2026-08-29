import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  alvoDeMensagem,
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
 *
 * ⚠ **O alvo virou UNIÃO** — mensagem ou usuário —, e a mudança tem uma
 * consequência que estes testes existem para segurar: quem chama monta o
 * objeto no handler, então a comparação passou a ser por CAMPO. Fosse por
 * referência, dois cliques direitos na mesma linha produziriam dois objetos
 * diferentes e acordariam a lista à toa — exatamente o que o store veio
 * eliminar.
 */
describe("alvo do menu de mensagem", () => {
  beforeEach(() => definirAlvoDoMenu(null));

  it("guarda e devolve o alvo", () => {
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(alvoDeMensagem()).toBe("m1");
    definirAlvoDoMenu(null);
    expect(lerAlvoDoMenu()).toBeNull();
    expect(alvoDeMensagem()).toBeNull();
  });

  it("NÃO avisa quando o alvo é o mesmo, ainda que o objeto seja outro", () => {
    const ouvinte = vi.fn();
    const parar = assinarMenuDeMensagem(ouvinte);

    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).toHaveBeenCalledTimes(1);

    // Clique direito duas vezes na MESMA linha: acontece o tempo todo, e cada
    // clique monta um objeto NOVO no handler. A segunda não deve acordar
    // ninguém — é o caso que a comparação por campo existe para cobrir.
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).toHaveBeenCalledTimes(1);

    definirAlvoDoMenu({ tipo: "mensagem", id: "m2" });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    parar();
  });

  it("mensagem e usuário de mesmo id são alvos DIFERENTES", () => {
    /*
      Os dois menus são o mesmo `ContextMenu`, e o que os separa é só o `tipo`.
      Comparar apenas o identificador faria o clique direito no autor abrir o
      menu da mensagem — sem erro nenhum, porque o alvo "não mudou".
    */
    const ouvinte = vi.fn();
    const parar = assinarMenuDeMensagem(ouvinte);

    definirAlvoDoMenu({ tipo: "mensagem", id: "x" });
    definirAlvoDoMenu({ tipo: "usuario", userId: "x" });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(lerAlvoDoMenu()).toEqual({ tipo: "usuario", userId: "x" });
    // E o atalho da linha diz "não sou eu" para alvo de usuário.
    expect(alvoDeMensagem()).toBeNull();
    parar();
  });

  it("para de avisar depois de cancelar a assinatura", () => {
    // Linha desmonta na velocidade do scroll. Ouvinte sem cleanup aqui é o
    // erro nº 5 do briefing — vazamento que só aparece na sexta hora.
    const ouvinte = vi.fn();
    assinarMenuDeMensagem(ouvinte)();

    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(ouvinte).not.toHaveBeenCalled();
  });

  it("os getters devolvem valor comparável — nunca objeto novo", () => {
    /*
      A linha assina `alvoDeMensagem() === id`, um booleano sobre uma STRING, e
      é isso que faz trinta subscrições custarem duas re-renderizações.

      `lerAlvoDoMenu` devolve o objeto GUARDADO, não um recém-montado: quem o
      assina é o menu, um só, e um objeto novo a cada leitura seria a armadilha
      nº 1 do projeto — `useSyncExternalStore` concluindo que mudou a cada
      render, e loop.
    */
    definirAlvoDoMenu({ tipo: "mensagem", id: "m1" });
    expect(Object.is(alvoDeMensagem(), alvoDeMensagem())).toBe(true);
    expect(typeof alvoDeMensagem()).toBe("string");
    expect(Object.is(lerAlvoDoMenu(), lerAlvoDoMenu())).toBe(true);
  });
});
