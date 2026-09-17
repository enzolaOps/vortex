import { app } from "electron";
import { objeto, registrar } from "./registroDeIpc";

import { type ComandoDeVoz, type Hook, type HookCarregado, criarControles } from "./controlesModelo";
import { alternarOverlay, alternarSilencioDoOverlay } from "./overlay";
import { definirChamadaEmPip } from "./preferencias";
import { definirEstadoDeVoz } from "./tray";
import { mainWindow } from "./window";

/**
 * Atalhos de voz com o app em segundo plano, e a ponte de comandos da bandeja.
 *
 * ⚠ **Hook de teclado (`uiohook-napi`) e não `globalShortcut`**, por duas
 * razões medidas no uso real — push-to-talk com um jogo em foco:
 *
 * 1. `globalShortcut` só avisa quando a tecla é APERTADA. Push-to-talk precisa
 *    saber quando ela é SOLTA, e não há evento para isso.
 * 2. `globalShortcut` RESERVA a combinação no sistema: com Alt+Espaço
 *    registrado, o jogo nunca mais recebe Alt+Espaço. O hook só observa.
 *
 * ⚠ **O hook vê o teclado inteiro, e isso fica AQUI.** O renderer recebe só
 * comandos ("mutar", "começou a falar") das combinações que ele próprio
 * cadastrou — nunca a tecla. E o hook só roda enquanto houver atalho
 * cadastrado.
 */

export type { ComandoDeVoz } from "./controlesModelo";

let hook: Promise<HookCarregado | undefined> | undefined;

function carregarHook() {
  hook ??= import("uiohook-napi")
    .then((m) => {
      const mod = m as unknown as {
        uIOhook?: Hook;
        UiohookKey?: Record<string, number>;
        default?: { uIOhook: Hook; UiohookKey: Record<string, number> };
      };
      const h = mod.uIOhook ?? mod.default?.uIOhook;
      const teclas = mod.UiohookKey ?? mod.default?.UiohookKey;
      if (!h || !teclas) return undefined;
      return { hook: h, teclas };
    })
    .catch((e: unknown) => {
      console.error("Atalhos globais indisponíveis:", e);
      return undefined;
    });
  return hook;
}

function enviar(comando: ComandoDeVoz): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("vortexComandoDeVoz", comando);
}

const { definirAtalhos, parar: pararControles } = criarControles({
  carregarHook,
  enviar,
  /* Por função e não por valor: `overlay.ts` importa `window.ts`, que importa
     este módulo — no ciclo, o binding ainda pode não existir aqui. */
  alternarOverlay: () => alternarOverlay(),
  alternarSilencioDoOverlay: () => alternarSilencioDoOverlay(),
});

export function registrarControles(): void {
  /* O hook precisa parar antes de o processo sair: um hook de teclado órfão é
     exatamente o que antivírus e o próprio Windows tratam com desconfiança. */
  app.on("will-quit", () => void pararControles());

  /* A forma de cada combinação é conferida em `definirAtalhos`; aqui só o
     envelope: um objeto por ação. */
  registrar("vortexDefinirAtalhos", {
    via: "invoke",
    quem: ["principal"],
    validar: objeto,
    executar: (atalhos) => definirAtalhos(atalhos),
  });

  registrar("vortexEstadoDeVoz", {
    via: "send",
    quem: ["principal"],
    validar: objeto,
    executar: (o) => {
      definirEstadoDeVoz({
        naChamada: o.naChamada === true,
        mudo: o.mudo === true,
        surdo: o.surdo === true,
      });
      /* `pip` só existe em clientes novos; ausente é `false`, que é o estado
         de uma casca que nunca soube dele. */
      definirChamadaEmPip(o.naChamada === true && o.pip === true);
    },
  });
}
