import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EntornoDoSquirrel,
  acaoDoSquirrel,
  caminhoDoUpdateExe,
  tratarEventosDoSquirrel,
} from "./atalhosDoSquirrelModelo";

/* O caminho real medido na instalação 1.3.1 desta máquina. */
const EXE = "C:\\Users\\alguem\\AppData\\Local\\vortex-desktop\\app-1.3.1\\vortex-desktop.exe";
const UPDATE = "C:\\Users\\alguem\\AppData\\Local\\vortex-desktop\\Update.exe";

type Chamada = { comando: string; argumentos: string[] };

/** `app` e `spawn` dublados: o que se observa é a chamada e o encerramento. */
function entorno(argv: string[], plataforma = "win32") {
  const update: Chamada[] = [];
  let saiu = 0;
  let terminarFilho: (() => void) | undefined;

  const base: EntornoDoSquirrel = {
    argv,
    plataforma,
    execPath: EXE,
    rodarUpdate: (comando, argumentos, aoTerminar) => {
      update.push({ comando, argumentos });
      terminarFilho = aoTerminar;
    },
    sair: () => void (saiu += 1),
  };

  return {
    base,
    update,
    /* O `Update.exe` fechando. */
    fecharUpdate: () => terminarFilho?.(),
    saiu: () => saiu,
  };
}

describe("eventos do Squirrel", () => {
  it("--squirrel-install cria o atalho e só então encerra", () => {
    const e = entorno(["vortex-desktop.exe", "--squirrel-install", "1.4.0"]);

    assert.equal(tratarEventosDoSquirrel(e.base), true);
    assert.deepEqual(e.update, [
      { comando: UPDATE, argumentos: ["--createShortcut", "vortex-desktop.exe"] },
    ]);
    /* ⚠ Sair antes de o `Update.exe` fechar mata a escrita do `.lnk`. */
    assert.equal(e.saiu(), 0);

    e.fecharUpdate();
    assert.equal(e.saiu(), 1);
  });

  it("--squirrel-updated recria o atalho — é o que conserta quem já instalou", () => {
    const e = entorno(["vortex-desktop.exe", "--squirrel-updated", "1.4.0"]);

    assert.equal(tratarEventosDoSquirrel(e.base), true);
    assert.deepEqual(e.update, [
      { comando: UPDATE, argumentos: ["--createShortcut", "vortex-desktop.exe"] },
    ]);
    e.fecharUpdate();
    assert.equal(e.saiu(), 1);
  });

  it("--squirrel-uninstall remove o atalho, senão fica atalho morto no menu", () => {
    const e = entorno(["vortex-desktop.exe", "--squirrel-uninstall", "1.4.0"]);

    assert.equal(tratarEventosDoSquirrel(e.base), true);
    assert.deepEqual(e.update, [
      { comando: UPDATE, argumentos: ["--removeShortcut", "vortex-desktop.exe"] },
    ]);
    e.fecharUpdate();
    assert.equal(e.saiu(), 1);
  });

  it("--squirrel-obsolete só encerra, sem tocar no atalho", () => {
    const e = entorno(["vortex-desktop.exe", "--squirrel-obsolete", "1.3.1"]);

    assert.equal(tratarEventosDoSquirrel(e.base), true);
    assert.deepEqual(e.update, []);
    assert.equal(e.saiu(), 1);
  });

  /*
    ⚠ O evento que NÃO é evento. Ele chega na primeira abertura de verdade,
    logo depois da instalação: tratá-lo faria o app sair em vez de abrir, e a
    instalação terminaria sem nada na tela.
  */
  it("--squirrel-firstrun deixa o app abrir normalmente", () => {
    const e = entorno(["vortex-desktop.exe", "--squirrel-firstrun"]);

    assert.equal(tratarEventosDoSquirrel(e.base), false);
    assert.deepEqual(e.update, []);
    assert.equal(e.saiu(), 0);
  });

  it("sem argumento do Squirrel o app segue — inclusive com o `--no-sandbox` do `pnpm start`", () => {
    for (const argv of [
      ["vortex-desktop.exe"],
      ["electron", ".", "--no-sandbox"],
      ["vortex-desktop.exe", "--squirrel"],
      ["vortex-desktop.exe", "--squirrel-install-nao-e-isto"],
    ]) {
      const e = entorno(argv);
      assert.equal(tratarEventosDoSquirrel(e.base), false, argv.join(" "));
      assert.equal(e.saiu(), 0);
    }
  });

  /* Squirrel é só Windows; no Linux quem instala é o gestor de pacotes. */
  it("fora do Windows nada acontece, nem com o argumento presente", () => {
    for (const plataforma of ["linux", "darwin"]) {
      const e = entorno(["vortex-desktop", "--squirrel-install", "1.4.0"], plataforma);
      assert.equal(tratarEventosDoSquirrel(e.base), false);
      assert.deepEqual(e.update, []);
      assert.equal(e.saiu(), 0);
    }
  });

  it("o nome do executável sai do `execPath`, então renomear o binário não quebra", () => {
    assert.deepEqual(
      acaoDoSquirrel(["--squirrel-install"], "win32", "D:\\qualquer\\app-9.9.9\\Vortex.exe"),
      { tipo: "criarAtalho", exe: "Vortex.exe" },
    );
  });

  it("o `Update.exe` fica um nível acima do executável", () => {
    assert.equal(caminhoDoUpdateExe(EXE), UPDATE);
  });
});
