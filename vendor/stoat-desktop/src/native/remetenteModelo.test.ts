import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { after, before, describe, it } from "node:test";

import {
  CANAIS_DO_OVERLAY,
  type IpcComoOMain,
  type Remetente,
  protegerIpc,
} from "./remetenteModelo";

/* Um `ipcMain` de mentira: guarda o ouvinte por canal para o teste disparar. */
function ipcFalso() {
  const ouvintes = new Map<string, (e: Remetente, ...a: unknown[]) => unknown>();
  const ipc: IpcComoOMain<Remetente, Remetente> = {
    on: (canal, f) => ouvintes.set(canal, f),
    handle: (canal, f) => ouvintes.set(canal, f),
  };
  return { ipc, disparar: (canal: string, id: number, ...a: unknown[]) => ouvintes.get(canal)?.({ sender: { id } }, ...a) };
}

const janela = (id: number, destruida = false) => ({
  isDestroyed: () => destruida,
  webContents: { id },
});

const PRINCIPAL = 1;
const OVERLAY = 2;
const ESTRANHA = 3;

function montar() {
  const { ipc, disparar } = ipcFalso();
  const protegido = protegerIpc(ipc, () => ({ principal: janela(PRINCIPAL), overlay: janela(OVERLAY) }));
  return { protegido, disparar };
}

/* Os canais que a revisão do #225 apontou como alcançáveis pelo overlay. */
const SENSIVEIS_ON = ["close", "minimise", "maximise", "vortexAtenuar", "vortexOverlayPublicar", "config"];
const SENSIVEIS_HANDLE = [
  "vortexDefinirAtalhos",
  "vortexGravarPreferencia",
  "vortexReiniciar",
  "vortexLimparCache",
  "vortexJanela",
  "setAutostart",
];

describe("guarda de remetente do IPC", () => {
  // O console.warn da recusa é esperado aqui.
  const aviso = console.warn;
  before(() => {
    console.warn = () => undefined;
  });
  after(() => {
    console.warn = aviso;
  });

  for (const canal of SENSIVEIS_ON) {
    it(`"${canal}" (on) só roda para a janela principal`, () => {
      const { protegido, disparar } = montar();
      const chamadas: number[] = [];
      protegido.on(canal, (e) => void chamadas.push(e.sender.id));
      disparar(canal, OVERLAY);
      disparar(canal, ESTRANHA);
      disparar(canal, PRINCIPAL);
      assert.deepEqual(chamadas, [PRINCIPAL]);
    });
  }

  for (const canal of SENSIVEIS_HANDLE) {
    it(`"${canal}" (handle) recusa com undefined fora da principal`, () => {
      const { protegido, disparar } = montar();
      protegido.handle(canal, () => "feito");
      assert.equal(disparar(canal, OVERLAY), undefined);
      assert.equal(disparar(canal, ESTRANHA), undefined);
      assert.equal(disparar(canal, PRINCIPAL), "feito");
    });
  }

  for (const canal of CANAIS_DO_OVERLAY) {
    it(`"${canal}" só aceita a janela do overlay`, () => {
      const { protegido, disparar } = montar();
      protegido.handle(canal, () => "feito");
      assert.equal(disparar(canal, PRINCIPAL), undefined);
      assert.equal(disparar(canal, ESTRANHA), undefined);
      assert.equal(disparar(canal, OVERLAY), "feito");
    });
  }

  it("repassa os argumentos intactos", () => {
    const { protegido, disparar } = montar();
    protegido.handle("vortexGravarPreferencia", (_e, chave, valor) => [chave, valor]);
    assert.deepEqual(disparar("vortexGravarPreferencia", PRINCIPAL, "aoFechar", "sair"), ["aoFechar", "sair"]);
  });

  it("janela destruída ou ausente não autoriza ninguém", () => {
    const { ipc, disparar } = ipcFalso();
    const protegido = protegerIpc(ipc, () => ({ principal: janela(PRINCIPAL, true), overlay: undefined }));
    protegido.handle("close", () => "feito");
    protegido.handle("vortexOverlayComando", () => "feito");
    assert.equal(disparar("close", PRINCIPAL), undefined);
    assert.equal(disparar("vortexOverlayComando", OVERLAY), undefined);
  });

  it("nenhum `ipcMain.on`/`ipcMain.handle` direto fora do guarda", () => {
    /* `pnpm test` roda a partir de vendor/stoat-desktop/. */
    const src = join(process.cwd(), "src");
    assert.ok(statSync(src).isDirectory(), `src/ não encontrado em ${process.cwd()}`);
    const arquivos = (pasta: string): string[] =>
      readdirSync(pasta, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? arquivos(join(pasta, e.name)) : e.name.endsWith(".ts") ? [join(pasta, e.name)] : [],
      );
    const infratores = arquivos(src)
      .filter((f) => !/remetente(Modelo)?(\.test)?\.ts$/.test(f))
      .filter((f) => /\bipcMain\s*\.\s*(on|once|handle|handleOnce)\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => relative(src, f));
    assert.deepEqual(infratores, []);
  });

});
