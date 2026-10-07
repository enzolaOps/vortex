import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do `app` (TRD §9). Chromium com mídia falsa: microfone, câmera e tela saem de
 * dispositivos sintéticos do próprio navegador, sem pedir permissão a ninguém.
 *
 * Variáveis de ambiente:
 *   VORTEX_E2E_URL      onde o app está servido. Sem ela, o `webServer` abaixo constrói e serve
 *                       o build de produção em :4173 (e reaproveita um servidor já de pé fora do CI).
 *   VORTEX_E2E_API      API da pilha local do pi-infra (padrão http://localhost:8880/api), usada
 *                       só pelo `globalSetup` e pelos specs marcados @backend.
 *   VORTEX_CHROME       executável do Chrome/Chromium, quando o Chromium do Playwright não está
 *                       instalado (CI instala o próprio com `playwright install chromium`).
 */
const URL_DO_APP = process.env.VORTEX_E2E_URL ?? "http://localhost:4173";
const SOBE_O_SERVIDOR = process.env.VORTEX_E2E_URL === undefined;

export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts$/,
  globalSetup: "./globalSetup.ts",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]] : "list",
  outputDir: "../test-results",

  use: {
    baseURL: URL_DO_APP,
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.VORTEX_CHROME ? { executablePath: process.env.VORTEX_CHROME } : {}),
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
      ],
    },
    permissions: ["microphone", "camera"],
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1600, height: 900 } } }],

  webServer: SOBE_O_SERVIDOR
    ? {
        // O build normal (sem arnês). `vite preview` serve o `dist/` e o job só precisa do shell.
        command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
        cwd: "..",
        url: URL_DO_APP,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : undefined,
});
