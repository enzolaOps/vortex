import { describe, expect, it } from "vitest";

import { verbosFaltandoNaPonte, type PonteDesktop } from "./desktop";

/**
 * A casca que não implementou a ponte.
 *
 * ⚠ **Este teste tem um caso real por trás, e ele não é hipotético como o do
 * seletor de tela.** `PonteDesktop` declara treze verbos e a casca Electron
 * expunha `native`, `desktopConfig` e `vortexTela` — nunca `vortex`. Durante
 * meses o cliente tinha o contrato escrito, os consumidores prontos
 * (`BarraDeTitulo`, `Atualizacao`, `config/Desktop`) e nada do outro lado.
 *
 * O sintoma que quem usa relatou: "não aparecem os botões de minimizar,
 * maximizar e fechar". A cadeia: `customFrame: true` é o padrão, então o
 * Electron não desenha moldura; a barra é do CLIENTE; e a barra só se desenha
 * quando `naDesktop()` é verdade. Sem a ponte, uma janela sem moldura do
 * sistema e sem barra nossa.
 *
 * ⚠ **E ninguém percebeu porque o ARNÊS dubla a ponte** (`dev/cascaFalsa.ts`).
 * Em `/dev` a barra sempre apareceu. É a família "arnês mais rico que o
 * produto" na versão mais cara: o que ele escondia era a casca inteira.
 *
 * A outra metade do mecanismo não precisa de teste: `VERBOS` é
 * `Record<keyof PonteDesktop, true>`, então verbo novo no tipo sem entrada lá
 * não COMPILA.
 */

function ponteCompleta(): PonteDesktop {
  return {
    versao: "0.1.0",
    plataforma: "win32",
    electron: "43.4.0",
    janela: () => Promise.resolve(),
    assinarJanela: () => () => undefined,
    lerPreferencias: () => Promise.resolve({}),
    gravarPreferencia: () => Promise.resolve(),
    assinarAtualizacao: () => () => undefined,
    verificarAtualizacao: () => Promise.resolve(),
    instalarEReiniciar: () => Promise.resolve(),
    tamanhoDoCache: () => Promise.resolve(0),
    limparCache: () => Promise.resolve(),
    abrirPastaDeLogs: () => Promise.resolve(),
  };
}

describe("verbosFaltandoNaPonte", () => {
  it("aceita a ponte completa", () => {
    expect(verbosFaltandoNaPonte(ponteCompleta())).toEqual([]);
  });

  it("acusa cada verbo que a casca não entrega", () => {
    for (const verbo of Object.keys(ponteCompleta())) {
      const parcial: Record<string, unknown> = { ...ponteCompleta() };
      delete parcial[verbo];
      expect(verbosFaltandoNaPonte(parcial), `faltando \`${verbo}\``).toEqual([
        verbo,
      ]);
    }
  });

  it("acusa os treze quando a casca nunca implementou nada", () => {
    /*
      O caso que aconteceu de verdade. Treze, e não "algum": uma checagem que
      só notasse ausência parcial passaria justamente aqui.
    */
    expect(verbosFaltandoNaPonte({})).toHaveLength(13);
  });

  it("aceita STRING vazia e `false` — ausência é `undefined`, não falsidade", () => {
    /*
      ⚠ `versao`, `plataforma` e `electron` são strings, e um teste de
      veracidade (`!dela[v]`) reprovaria uma casca que reportasse versão vazia.
      Casca com metadado pobre ainda é casca; casca sem o verbo não é.
    */
    const magra = { ...ponteCompleta(), versao: "", electron: "" };
    expect(verbosFaltandoNaPonte(magra)).toEqual([]);
  });

  it("ignora verbo A MAIS — casca nova com cliente velho também roda", () => {
    const doFuturo = { ...ponteCompleta(), abrirOverlay: () => Promise.resolve() };
    expect(verbosFaltandoNaPonte(doFuturo)).toEqual([]);
  });
});
