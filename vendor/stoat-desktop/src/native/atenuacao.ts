import { app } from "electron";
import { type Mixer, type MixerCarregado, criarAtenuacao } from "./atenuacaoModelo";
import { ipc } from "./remetente";

/**
 * "Atenuar outros apps": baixa o volume dos OUTROS programas enquanto alguém
 * fala na chamada, e devolve depois.
 *
 * ⚠ **Por sessão de áudio do Windows, e não pelo volume geral.** Baixar o
 * volume do sistema baixaria a própria chamada junto — exatamente o som que a
 * atenuação existe para destacar. `native-sound-mixer` expõe as sessões do
 * dispositivo de saída padrão, com o executável de cada uma; as do Vortex
 * (`process.execPath`, que é o mesmo executável de todos os processos do app)
 * ficam de fora.
 *
 * ⚠ **Devolve o volume que ESTAVA, e só se ninguém mexeu.** Se a pessoa subiu
 * o volume do Spotify no meio da conversa, restaurar por cima apagaria a
 * escolha dela.
 *
 * Só Windows: no Linux o módulo existe mas as sessões do PulseAudio não
 * carregam o executável de forma confiável, e no macOS não há API pública.
 */

let mixer: Promise<MixerCarregado | undefined> | undefined;

function carregar() {
  if (process.platform !== "win32") return Promise.resolve(undefined);
  mixer ??= import("native-sound-mixer")
    .then((mod) => {
      /*
        ⚠ **O `default` do `import()` de um módulo CommonJS é o `module.exports`
        INTEIRO**, e este pacote exporta a classe como `exports.default` — então
        ela mora em `default.default`. Pego pelo teste no Electron: com
        `default` direto, `getDefaultDevice is not a function` e nenhum volume
        mudava. Procura nas três formas em vez de apostar numa.
      */
      type Forma = { default?: unknown; DeviceType?: { RENDER: number } };
      const niveis = [mod, (mod as Forma).default, ((mod as Forma).default as Forma | undefined)?.default];
      const m = niveis.find(
        (x): x is Mixer => typeof (x as Mixer | undefined)?.getDefaultDevice === "function",
      );
      const tipos = [mod, (mod as Forma).default]
        .map((x) => (x as Forma | undefined)?.DeviceType)
        .find((t) => t !== undefined);
      return m ? { m, saida: tipos?.RENDER ?? 0 } : undefined;
    })
    .catch((e: unknown) => {
      console.error("Atenuação indisponível:", e);
      return undefined;
    });
  return mixer;
}

const { atenuar, aoSair } = criarAtenuacao({ carregar, proprio: process.execPath });

export function registrarAtenuacao(): void {
  ipc.on("vortexAtenuar", (_e, sim: unknown) => void atenuar(sim === true));
  /* Sair do app no meio de uma fala não pode deixar o computador a 50% —
     e `will-quit` com `void` saía antes de o mixer terminar de carregar. */
  app.on("before-quit", (e) => aoSair(e, () => app.quit()));
}
