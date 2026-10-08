import { app } from "electron";

/**
 * O endereço do cliente que a casca carrega — `VORTEX_APP_URL` no build, ou
 * `--force-server`.
 *
 * ⚠ **Módulo próprio, sem importar nada do projeto.** O registro de IPC confere
 * a ORIGEM de todo remetente contra este endereço, e `window.ts` importa
 * módulos que registram canais no carregamento: morando lá, o registro leria
 * `BUILD_URL` antes de ele existir.
 */
export const BUILD_URL = new URL(
  app.commandLine.hasSwitch("force-server")
    ? app.commandLine.getSwitchValue("force-server")
    : __VORTEX_APP_URL__,
);
