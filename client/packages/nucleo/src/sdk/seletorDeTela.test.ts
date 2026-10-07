import { describe, expect, it } from "vitest";

import {
  aoVoltarParaAJanela,
  capacidadeDeCaptura,
  verbosFaltando,
  type PonteDeTela,
} from "./seletorDeTela";

/**
 * A casca velha, e por que este teste existe.
 *
 * ⚠ **`PonteDeTela` é tipo de COMPILAÇÃO sobre um objeto injetado em runtime.**
 * O `window.vortexTela` vem do preload da casca Electron; o TypeScript acredita
 * nos seis verbos porque alguém os declarou, não porque alguém os viu. Se a
 * casca instalada for anterior ao verbo, ele simplesmente não está lá e a
 * chamada lança `is not a function` — dentro do seletor de tela, na hora em que
 * a pessoa está tentando apresentar.
 *
 * E isso não é hipótese remota: **a casca carrega o cliente por URL remota**.
 * O cliente web atualiza no deploy, a casca não. "Casca velha + cliente novo"
 * é o estado normal depois de toda subida.
 *
 * ⚠ **Este teste existe porque a medição direta é IMPOSSÍVEL.** Tentei simular
 * a casca antiga dentro do Electron rodando, substituindo `window.vortexTela`
 * por uma versão sem `permissao` — e o `contextBridge` cria objeto
 * não-configurável, então a substituição falha com `TypeError`. Não dá para
 * provar o defeito no lugar onde ele mora. O que dá é exercitar a guarda com
 * pontes montadas à mão, que é o que está aqui.
 *
 * A outra metade do mecanismo não precisa de teste: `VERBOS` é
 * `Record<keyof PonteDeTela, true>`, então verbo novo no tipo sem entrada lá
 * não COMPILA. É a mesma mecânica de `ModalId` e `PainelId`.
 */

/** Uma ponte completa, do jeito que a casca desta árvore entrega. */
function ponteCompleta(): PonteDeTela {
  return {
    seletorProprio: () => Promise.resolve(true),
    fontes: () => Promise.resolve([]),
    escolher: () => Promise.resolve(true),
    cancelar: () => Promise.resolve(),
    permissao: () => Promise.resolve("concedida"),
    abrirAjustes: () => Promise.resolve(),
  };
}

describe("verbosFaltando", () => {
  it("aceita a ponte completa", () => {
    expect(verbosFaltando(ponteCompleta())).toEqual([]);
  });

  it("acusa cada verbo que a casca não entrega", () => {
    /*
      Um por vez, e não todos de uma: uma casca antiga costuma faltar UM verbo
      — o mais novo —, e uma checagem que só notasse a ausência de vários
      passaria justamente no caso real.
    */
    for (const verbo of Object.keys(ponteCompleta())) {
      const parcial: Record<string, unknown> = { ...ponteCompleta() };
      delete parcial[verbo];
      expect(verbosFaltando(parcial), `faltando \`${verbo}\``).toEqual([verbo]);
    }
  });

  it("acusa o verbo que existe mas NÃO é função", () => {
    /*
      ⚠ O caso que um `in` não pegaria. Uma casca que exponha a chave com outro
      valor — `undefined` de um encaminhamento errado, ou um objeto de um
      refactor pela metade — passa no `'permissao' in ponte` e explode na
      chamada. Por isso a checagem é `typeof === "function"`.
    */
    const torta = { ...ponteCompleta(), permissao: undefined };
    expect(verbosFaltando(torta)).toEqual(["permissao"]);
  });

  it("acusa TODOS quando a casca é de outro mundo", () => {
    expect([...verbosFaltando({})].sort()).toEqual(
      [
        "abrirAjustes",
        "cancelar",
        "escolher",
        "fontes",
        "permissao",
        "seletorProprio",
      ].sort(),
    );
  });

  it("ignora verbo A MAIS — casca nova com cliente velho também roda", () => {
    /*
      A deriva acontece nas duas direções, e só uma é problema. Casca mais nova
      que o cliente traz verbos que este cliente não conhece; ignorá-los é o
      certo — recusar seria transformar uma casca perfeitamente boa em nenhuma.
    */
    const doFuturo = { ...ponteCompleta(), gravarTela: () => Promise.resolve() };
    expect(verbosFaltando(doFuturo)).toEqual([]);
  });
});

describe("capacidadeDeCaptura — o que o navegador entrega", () => {
  const getDisplayMedia = () => Promise.resolve();

  it("sem getDisplayMedia não há captura nem áudio", () => {
    expect(capacidadeDeCaptura(undefined)).toEqual({
      captura: false,
      audio: false,
    });
    expect(capacidadeDeCaptura({})).toEqual({ captura: false, audio: false });
  });

  it("Chromium: a constraint de áudio de tela existe", () => {
    expect(
      capacidadeDeCaptura({
        getDisplayMedia,
        getSupportedConstraints: () => ({ suppressLocalAudioPlayback: true }),
      }),
    ).toEqual({ captura: true, audio: true });
  });

  it("Firefox/Safari: captura sem áudio, e o toggle vai desabilitado", () => {
    expect(
      capacidadeDeCaptura({
        getDisplayMedia,
        getSupportedConstraints: () => ({ width: true }),
      }),
    ).toEqual({ captura: true, audio: false });
  });
});

describe("aoVoltarParaAJanela — a permissão revalida sozinha", () => {
  function montar() {
    const janela = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    let leituras = 0;
    const soltar = aoVoltarParaAJanela(
      () => {
        leituras += 1;
      },
      janela,
      doc,
    );
    return { janela, doc, soltar, leituras: () => leituras };
  }

  it("relê ao focar a janela e ao ela voltar a ficar visível", () => {
    const m = montar();
    m.janela.dispatchEvent(new Event("focus"));
    m.doc.dispatchEvent(new Event("visibilitychange"));
    expect(m.leituras()).toBe(2);
  });

  it("não relê quando a janela SOME", () => {
    const m = montar();
    m.doc.visibilityState = "hidden";
    m.doc.dispatchEvent(new Event("visibilitychange"));
    expect(m.leituras()).toBe(0);
  });

  it("solta os ouvintes — sem isso o modal fechado seguiria lendo", () => {
    const m = montar();
    m.soltar();
    m.janela.dispatchEvent(new Event("focus"));
    m.doc.dispatchEvent(new Event("visibilitychange"));
    expect(m.leituras()).toBe(0);
  });
});
