import { execFile } from "node:child_process";
import { app, type WebContents } from "electron";
import { registrar, semArgumentos } from "./registroDeIpc";

/**
 * Apps cujo som entra na transmissão de tela.
 *
 * O Electron só sabe "som do sistema" ou nada. Aqui a casca lista quem está
 * tocando e captura os PIDs que ficaram marcados (`loopback-capture`, Windows
 * e Linux). Quem foi desmarcado não entra na soma.
 *
 * ponytail: uma captura por PID, somada a cada 20ms. Não é um mixer de estúdio.
 */

export type AppDeAudio = { id: string; nome: string };

let excluidos = new Set<string>();
const emCurso = new Map<number, { stop: () => void }[]>();

export function pidsExcluidos(): ReadonlySet<string> {
  return excluidos;
}

function idsValidos(bruto: unknown): string[] | undefined {
  if (!Array.isArray(bruto) || bruto.some((x) => typeof x !== "string")) return undefined;
  return bruto as string[];
}

async function listar(): Promise<AppDeAudio[]> {
  const proprios = new Set(app.getAppMetrics().map((p) => String(p.pid)));
  try {
    if (process.platform === "linux") return (await listarLinux()).filter((a) => !proprios.has(a.id));
    if (process.platform === "win32") return (await listarWindows()).filter((a) => !proprios.has(a.id));
  } catch (e) {
    console.error("Não deu para listar o áudio dos apps:", e);
  }
  return [];
}

async function listarLinux(): Promise<AppDeAudio[]> {
  const pw = (await import("node-pipewire")) as {
    getNodes?: () => { id: number; props: Record<string, string> }[];
    getClients?: () => { id: number; pid: number; application_name?: string }[];
  };
  const nos = pw.getNodes?.() ?? [];
  const clientes = new Map((pw.getClients?.() ?? []).map((c) => [c.id, c]));
  const vistos = new Map<string, AppDeAudio>();
  for (const no of nos) {
    if (no.props["media.class"] !== "Stream/Output/Audio") continue;
    const cliente = clientes.get(Number(no.props["client.id"]));
    const pid = cliente?.pid ?? Number(no.props["application.process.id"]);
    if (!pid) continue;
    const id = String(pid);
    if (!vistos.has(id)) {
      vistos.set(id, { id, nome: cliente?.application_name || no.props["application.name"] || id });
    }
  }
  return [...vistos.values()];
}

function processosWindows(): Promise<{ id: number; nome: string }[]> {
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command", "Get-Process | ForEach-Object { $_.Id.ToString() + '|' + $_.ProcessName }"],
      { timeout: 4000, windowsHide: true },
      (erro, saida) => {
        if (erro) return resolve([]);
        resolve(
          String(saida)
            .split(/\r?\n/)
            .flatMap((linha) => {
              const [id, nome] = linha.split("|");
              const n = Number(id);
              return nome && Number.isInteger(n) ? [{ id: n, nome }] : [];
            }),
        );
      },
    );
  });
}

async function listarWindows(): Promise<AppDeAudio[]> {
  const mixer = (await import("native-sound-mixer")) as {
    default?: { getDefaultDevice: (tipo: string) => { sessions: { appName: string; name: string }[] } };
  };
  const sessoes = mixer.default?.getDefaultDevice("render")?.sessions ?? [];
  const tocando = new Set(sessoes.map((s) => (s.appName || s.name).toLowerCase()));
  const procs = await processosWindows();
  return procs
    .filter((p) => tocando.has(p.nome.toLowerCase()))
    .map((p) => ({ id: String(p.id), nome: p.nome }));
}

function somar(blocos: Buffer[]): Buffer {
  const n = Math.max(...blocos.map((b) => b.length));
  const saida = Buffer.alloc(n - (n % 2));
  for (const bloco of blocos) {
    for (let i = 0; i + 1 < bloco.length && i + 1 < saida.length; i += 2) {
      const soma = saida.readInt16LE(i) + bloco.readInt16LE(i);
      saida.writeInt16LE(Math.max(-32768, Math.min(32767, soma)), i);
    }
  }
  return saida;
}

async function iniciar(wc: WebContents): Promise<boolean> {
  parar(wc);
  const apps = await listar();
  const marcados = apps.filter((a) => !excluidos.has(a.id));
  if (marcados.length === 0) return false;

  const loopback = (await import("loopback-capture")) as {
    default?: { LoopbackCapture: new () => { start: (pid: number, arvore: boolean, cb: (b: Buffer) => void) => void; stop: () => void } };
    LoopbackCapture?: new () => { start: (pid: number, arvore: boolean, cb: (b: Buffer) => void) => void; stop: () => void };
  };
  const Classe = loopback.default?.LoopbackCapture ?? loopback.LoopbackCapture;
  if (!Classe) return false;

  const ultimos = new Map<string, Buffer>();
  const vivos: { stop: () => void }[] = [];
  for (const appDeAudio of marcados) {
    const pid = Number(appDeAudio.id);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      const captura = new Classe();
      captura.start(pid, true, (bloco) => {
        ultimos.set(appDeAudio.id, bloco);
      });
      vivos.push(captura);
    } catch {
      /* App sem sessão de áudio: segue os outros. */
    }
  }
  if (vivos.length === 0) return false;
  emCurso.set(wc.id, vivos);
  const relogio = setInterval(() => {
    if (wc.isDestroyed()) return;
    const blocos = [...ultimos.values()];
    if (blocos.length === 0) return;
    wc.send("mixerBloco", somar(blocos));
  }, 20);
  wc.once("destroyed", () => {
    clearInterval(relogio);
    parar(wc);
  });
  return true;
}

function parar(wc: WebContents): void {
  const vivos = emCurso.get(wc.id);
  if (!vivos) return;
  emCurso.delete(wc.id);
  for (const c of vivos) {
    try {
      c.stop();
    } catch {
      /* já parou */
    }
  }
}

export function registrarMixerDeApps(): void {
  registrar("mixerListar", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: () => listar(),
  });
  registrar("mixerDefinir", {
    via: "invoke",
    quem: ["principal"],
    validar: (ids: unknown) => idsValidos(ids),
    executar: (ids) => {
      excluidos = new Set(ids);
      return true;
    },
  });
  registrar("mixerIniciar", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: (_nada, e) => iniciar(e.sender),
  });
  registrar("mixerParar", {
    via: "invoke",
    quem: ["principal"],
    validar: semArgumentos,
    executar: (_nada, e) => {
      parar(e.sender);
    },
  });
}
