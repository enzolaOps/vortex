import { app } from "electron";
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

const FATOR = 0.5;

type Sessao = { appName: string; volume: number };
type Mixer = { getDefaultDevice(tipo: number): { sessions: Sessao[] } };

let mixer: Promise<{ m: Mixer; saida: number } | undefined> | undefined;

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

/** Por executável: o volume original e o que nós pusemos. */
const atenuadas = new Map<string, { original: number; posto: number }>();

function sessoesDeOutros(m: Mixer, saida: number): Sessao[] {
  const proprio = process.execPath.toLowerCase();
  return m
    .getDefaultDevice(saida)
    .sessions.filter((s) => s.appName && s.appName.toLowerCase() !== proprio);
}

async function atenuar(sim: boolean): Promise<void> {
  const x = await carregar();
  if (!x) return;
  try {
    const sessoes = sessoesDeOutros(x.m, x.saida);
    if (sim) {
      for (const s of sessoes) {
        if (atenuadas.has(s.appName)) continue;
        const posto = s.volume * FATOR;
        atenuadas.set(s.appName, { original: s.volume, posto });
        s.volume = posto;
      }
      return;
    }
    for (const s of sessoes) {
      const a = atenuadas.get(s.appName);
      if (!a) continue;
      /* Mexeram no volume enquanto estava atenuado: a escolha é da pessoa. */
      if (Math.abs(s.volume - a.posto) < 0.02) s.volume = a.original;
    }
    atenuadas.clear();
  } catch (e) {
    /* Um programa que fechou no meio da conversa leva a sessão junto. */
    console.error("Não deu para ajustar o volume dos outros apps:", e);
    if (!sim) atenuadas.clear();
  }
}

export function registrarAtenuacao(): void {
  ipc.on("vortexAtenuar", (_e, sim: unknown) => void atenuar(sim === true));
  /* Sair do app no meio de uma fala não pode deixar o computador a 50%. */
  app.on("will-quit", () => void atenuar(false));
}
