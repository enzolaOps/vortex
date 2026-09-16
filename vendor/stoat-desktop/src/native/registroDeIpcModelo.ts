/**
 * O registro de IPC da casca — a DECISÃO, sem Electron.
 *
 * ⚠ **O renderer executa conteúdo escrito por qualquer pessoa, e há DUAS
 * janelas.** Todo canal que o main ouve passa por um único registro, e cada
 * canal DECLARA três coisas que o tipo exige: quem pode chamá-lo (`quem`), o
 * que ele aceita (`validar`) e o que faz (`executar`). Esquecer uma delas não
 * compila — é a diferença entre "o guarda existe" e "o guarda é o único
 * caminho".
 *
 * Antes de executar, quatro portões, nesta ordem:
 *
 *  1. **Janela** — o `webContents` do remetente é o de uma janela com papel
 *     declarado no canal. A do overlay não alcança os canais da principal, e
 *     vice-versa.
 *  2. **Frame** — o remetente é o frame PRINCIPAL daquela janela. Um iframe
 *     (embed, conteúdo de terceiro) dentro da janela certa é recusado.
 *  3. **Origem** — a URL daquele frame é da origem do app. Se a janela
 *     navegar para outro lugar, ela perde a ponte, mesmo sendo a janela certa.
 *  4. **Payload** — o validador do canal devolve os dados já conferidos, ou
 *     `undefined` e o canal não executa.
 *
 * Recusado em `send`, nada acontece; em `invoke`, resolve `undefined` — o que
 * várias respostas "não se aplica" já devolvem, então recusar não abre caminho
 * de erro novo do lado do cliente.
 */

export type Papel = "principal" | "overlay";

/** O mínimo de `WebFrameMain` que a decisão lê. */
export type FrameConferivel = {
  readonly url: string;
  readonly processId: number;
  readonly routingId: number;
};

/** O mínimo de `BrowserWindow` que a decisão lê. */
export type JanelaConferivel = {
  isDestroyed(): boolean;
  webContents: { id: number };
};

/** O mínimo de `IpcMainEvent`/`IpcMainInvokeEvent` que a decisão lê. */
export type Remetente = {
  readonly sender: { readonly id: number; readonly mainFrame: FrameConferivel };
  readonly senderFrame: FrameConferivel | null;
};

export type Janelas = Record<Papel, JanelaConferivel | undefined>;

export type Ambiente = {
  readonly janelas: Janelas;
  /** `URL.origin` do app — `BUILD_URL`, que vem de `VORTEX_APP_URL`. */
  readonly origem: string;
};

export type Recusa = "janela" | "frame" | "origem" | "payload";

/** Ao menos um papel: um canal que ninguém pode chamar não precisa existir. */
export type Quem = readonly [Papel, ...Papel[]];

type Base<E, T> = {
  readonly quem: Quem;
  /**
   * Recebe os argumentos CRUS do renderer e devolve os dados conferidos, ou
   * `undefined` para recusar. `false`, `0` e `""` são dados válidos.
   */
  readonly validar: (...args: unknown[]) => T | undefined;
  readonly executar: (dados: T, e: E) => unknown;
};

/** `ipcRenderer.send` → `ipcMain.on`. */
export type DefinicaoDeEvento<E, T> = Base<E, T> & { readonly via: "send" };

/** `ipcRenderer.invoke` → `ipcMain.handle`. */
export type DefinicaoDePedido<E, T> = Base<E, T> & { readonly via: "invoke" };

export type Definicao<E, T> = DefinicaoDeEvento<E, T> | DefinicaoDePedido<E, T>;

/** Validador de canal que não recebe argumento nenhum. */
export const semArgumentos = (): true => true;

function mesmoFrame(a: FrameConferivel, b: FrameConferivel): boolean {
  return a === b || (a.processId === b.processId && a.routingId === b.routingId);
}

function origemDe(url: string): string | undefined {
  try {
    const o = new URL(url).origin;
    /* Origem opaca (`about:blank`, `data:`, `file:`) nunca é "a do app". */
    return o === "null" ? undefined : o;
  } catch {
    return undefined;
  }
}

/**
 * Por que o remetente não pode chamar um canal de `quem`, ou `undefined` se
 * pode. Não olha o payload — isso é do validador.
 *
 * ⚠ **Ler `senderFrame` ou `mainFrame` de um frame já destruído lança** no
 * Electron. Lançar aqui é recusar, nunca deixar passar.
 */
export function motivoDeRecusa(quem: Quem, e: Remetente, ambiente: Ambiente): Exclude<Recusa, "payload"> | undefined {
  try {
    const dona = quem.find((papel) => {
      const j = ambiente.janelas[papel];
      return j !== undefined && !j.isDestroyed() && j.webContents.id === e.sender.id;
    });
    if (dona === undefined) return "janela";

    const frame = e.senderFrame;
    if (frame === null || !mesmoFrame(frame, e.sender.mainFrame)) return "frame";

    const app = origemDe(ambiente.origem) ?? ambiente.origem;
    if (origemDe(frame.url) !== app) return "origem";

    return undefined;
  } catch {
    return "frame";
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- a assinatura é a do `ipcMain` */
type Ouvinte<E> = (e: E, ...args: any[]) => unknown;

export type IpcComoOMain<EOn extends Remetente, EHandle extends Remetente> = {
  on(canal: string, ouvinte: Ouvinte<EOn>): unknown;
  handle(canal: string, ouvinte: Ouvinte<EHandle>): unknown;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export type Registro<EOn extends Remetente, EHandle extends Remetente> = {
  registrar<T>(canal: string, def: DefinicaoDeEvento<EOn, T> | DefinicaoDePedido<EHandle, T>): void;
  /** Os canais registrados e quem pode chamar cada um — para teste e auditoria. */
  canais(): ReadonlyMap<string, { via: "send" | "invoke"; quem: Quem }>;
};

/**
 * O registro sobre um `ipcMain`. É o ÚNICO lugar da casca que chama
 * `ipcMain.on`/`ipcMain.handle` — um teste varre `src/` e reprova o resto.
 *
 * ⚠ **Canal repetido lança.** `ipcMain.handle` já lança; `ipcMain.on`
 * acumularia um segundo ouvinte em silêncio, e o segundo registro de um mesmo
 * nome é sempre engano.
 */
export function criarRegistro<EOn extends Remetente, EHandle extends Remetente>(
  ipc: IpcComoOMain<EOn, EHandle>,
  ambiente: () => Ambiente,
  avisar: (canal: string, motivo: Recusa) => void = (canal, motivo) =>
    console.warn(`IPC recusado: "${canal}" (${motivo}).`),
): Registro<EOn, EHandle> {
  const registrados = new Map<string, { via: "send" | "invoke"; quem: Quem }>();

  function conferir<E extends Remetente, T>(canal: string, def: Base<E, T>, e: E, args: unknown[]) {
    const motivo = motivoDeRecusa(def.quem, e, ambiente());
    if (motivo) {
      avisar(canal, motivo);
      return { ok: false as const };
    }
    let dados: T | undefined;
    try {
      dados = def.validar(...args);
    } catch {
      dados = undefined;
    }
    if (dados === undefined) {
      avisar(canal, "payload");
      return { ok: false as const };
    }
    return { ok: true as const, dados };
  }

  return {
    registrar(canal, def) {
      if (registrados.has(canal)) throw new Error(`Canal de IPC registrado duas vezes: "${canal}"`);
      if (def.quem.length === 0) throw new Error(`Canal de IPC sem papel: "${canal}"`);
      registrados.set(canal, { via: def.via, quem: def.quem });
      if (def.via === "send") {
        ipc.on(canal, (e: EOn, ...args: unknown[]) => {
          const r = conferir(canal, def, e, args);
          if (r.ok) def.executar(r.dados, e);
        });
      } else {
        ipc.handle(canal, (e: EHandle, ...args: unknown[]) => {
          const r = conferir(canal, def, e, args);
          return r.ok ? def.executar(r.dados, e) : undefined;
        });
      }
    },
    canais: () => registrados,
  };
}

/* ------------------------------------------------ validadores comuns */

export function booleano(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

export function numeroFinito(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function objeto(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

/** Um valor de uma lista fechada de strings. */
export function umDe<V extends string>(lista: readonly V[]) {
  return (v: unknown): V | undefined =>
    typeof v === "string" && (lista as readonly string[]).includes(v) ? (v as V) : undefined;
}
