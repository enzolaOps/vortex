import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

/* O gerador é um script de build em `.mjs`; `allowJs` no tsconfig o tipa. */
import { gerarSplash } from "../../scripts/splashDoInstalador.mjs";

/*
  ⚠ Nem `__dirname` nem `process.cwd()` servem: `scripts/testar.mjs` compila os
  testes para uma pasta temporária e o runner do Node roda cada arquivo com o
  `cwd` apontado para lá. A raiz da casca vem do runner, pelo ambiente.
*/
const SPLASH = resolve(process.env.VORTEX_CASCA_RAIZ ?? ".", "assets", "instalacao.gif");

describe("animação do instalador", () => {
  /*
    ⚠ **A guarda existe porque o `.gif` é um BINÁRIO COMMITADO.** Ele precisa
    estar na árvore (o maker o lê no build e o CI não roda geração de asset),
    e binário que ninguém consegue reproduzir é binário que ninguém consegue
    auditar. Mexer no gerador sem rodar `node scripts/gerar-splash.mjs`
    reprova aqui.
  */
  it("o arquivo commitado é byte a byte o que o gerador produz", () => {
    assert.deepEqual(readFileSync(SPLASH), gerarSplash());
  });

  it("é um GIF animado de 268×167, o tamanho da janela do instalador", () => {
    const b = readFileSync(SPLASH);
    assert.equal(b.subarray(0, 6).toString("ascii"), "GIF89a");
    assert.equal(b.readUInt16LE(6), 268);
    assert.equal(b.readUInt16LE(8), 167);
    /* Tabela global de 64 cores. */
    assert.equal(b[10] & 0x80, 0x80);
    assert.equal(2 ** ((b[10] & 0x07) + 1), 64);
  });

  /*
    A razão de o arquivo existir: sem ele o `electron-winstaller` usa a
    animação de fábrica, cuja paleta é VERDE. As pontas da rampa são os dois
    tokens da identidade.
  */
  it("a rampa vai de --vx-surface-0 a --vx-accent", () => {
    const b = readFileSync(SPLASH);
    assert.equal(b.subarray(13, 16).toString("hex"), "08090b");
    assert.equal(b.subarray(13 + 63 * 3, 13 + 64 * 3).toString("hex"), "35c2cc");
  });
});
