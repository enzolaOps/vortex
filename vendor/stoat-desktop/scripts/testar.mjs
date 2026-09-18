/**
 * Os testes da lógica PURA da casca — `src/**\/*.test.ts`.
 *
 *   pnpm test        (a partir de vendor/stoat-desktop/)
 *
 * ⚠ **`node:test` e não vitest, e a razão é dependência.** O que se testa aqui
 * é tradução sem Electron (que chave vira que campo, quando avisar sobre tela
 * cheia); o Node já traz o runner, e o esbuild já está na árvore pelo vite do
 * forge. Um segundo framework de teste só para isto seria dependência nova sem
 * nada que o Node não faça.
 *
 * ⚠ **Arquivo que importa `electron` não é testável aqui**, e é de propósito:
 * a regra é separar a decisão (pura, testada) do efeito (fino, verificado no
 * Electron).
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const RAIZ = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function testes(pasta, sufixo) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return testes(caminho, sufixo);
    return e.name.endsWith(sufixo) ? [caminho] : [];
  });
}

const entradas = testes(join(RAIZ, "src"), ".test.ts");
const saida = mkdtempSync(join(tmpdir(), "casca-testes-"));

try {
  await build({
    entryPoints: entradas,
    outdir: saida,
    outbase: join(RAIZ, "src"),
    bundle: true,
    platform: "node",
    format: "esm",
    outExtension: { ".js": ".mjs" },
    external: ["electron"],
    logLevel: "warning",
  });
  const compilados = testes(saida, ".test.mjs");
  /*
    ⚠ **`VORTEX_CASCA_RAIZ` porque `process.cwd()` NÃO serve.** O runner do
    Node roda cada arquivo num processo próprio, e o `cwd` dele acaba sendo a
    pasta temporária do build — então um teste que precise de arquivo do
    pacote (o `.gif` do instalador) procuraria no lixo. A raiz vai explícita.
  */
  const r = spawnSync(process.execPath, ["--test", ...compilados], {
    stdio: "inherit",
    env: { ...process.env, VORTEX_CASCA_RAIZ: RAIZ },
  });
  process.exitCode = r.status ?? 1;
} finally {
  rmSync(saida, { recursive: true, force: true });
}
