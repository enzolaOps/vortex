import AutoLaunch from "auto-launch";

import { app, ipcMain } from "electron";

/*
  `isHidden` põe `--hidden` na entrada de inicialização, e `createMainWindow`
  já lê essa chave: é o que faz "Iniciar com o sistema" cumprir o detalhe que
  a tela promete — "Abre minimizado no login".
*/
export const autoLaunch = new AutoLaunch({
  name: "Vortex",
  isHidden: true,
});

/**
 * Registra ou remove o app da inicialização do sistema.
 *
 * ⚠ **Só no app EMPACOTADO.** Rodando do `node_modules/.bin/electron`, o
 * executável registrado seria o Electron cru, sem o app — uma entrada que abre
 * uma janela vazia a cada login da máquina de quem está desenvolvendo. Fora do
 * pacote a preferência é só gravada, e o log diz isso.
 */
export async function definirIniciarComSistema(ligado: boolean): Promise<void> {
  if (!app.isPackaged) {
    console.info(
      `Iniciar com o sistema = ${String(ligado)} gravado; não registrado (app não empacotado).`,
    );
    return;
  }
  try {
    if (ligado) await autoLaunch.enable();
    else await autoLaunch.disable();
  } catch (e) {
    console.error("Falha ao alterar a inicialização com o sistema:", e);
  }
}

/**
 * O que o SISTEMA diz, quando dá para perguntar. A entrada pode ter sido
 * removida por fora (Gerenciador de Tarefas → Inicializar), e a tela não pode
 * afirmar o contrário.
 */
export async function iniciarComSistemaNoSistema(): Promise<boolean | undefined> {
  if (!app.isPackaged) return undefined;
  try {
    return await autoLaunch.isEnabled();
  } catch {
    return undefined;
  }
}

/*
  Os verbos da ponte `desktopConfig` do upstream. ⚠ Este módulo nunca era
  importado, então os dois estavam MORTOS; ao ligá-lo para a tela Desktop eles
  voltam a existir, e passam pela mesma guarda — sem isso um `setAutostart`
  registraria o Electron cru na máquina de quem desenvolve.
*/
ipcMain.handle("getAutostart", async () => (await iniciarComSistemaNoSistema()) ?? false);

ipcMain.handle("setAutostart", async (_event, state: unknown) => {
  if (typeof state === "boolean") await definirIniciarComSistema(state);
  return (await iniciarComSistemaNoSistema()) ?? false;
});
