import { app, ipcMain } from "electron";

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

export type ComandoDeVoz =
  | "pushToTalkInicio"
  | "pushToTalkFim"
  | "mutar"
  | "ensurdecer"
  | "desconectar";

type Combinacao = {
  codigo: string;
  mod: boolean;
  alt: boolean;
  shift: boolean;
};

const ACOES = ["pushToTalk", "mutar", "ensurdecer", "desconectar"] as const;
type Acao = (typeof ACOES)[number];

type EventoDeTecla = { keycode: number };

type Hook = {
  on(evento: "keydown" | "keyup", ouvinte: (e: EventoDeTecla) => void): void;
  start(): void;
  stop(): void;
};

let hook: Promise<{ hook: Hook; teclas: Record<string, number> } | undefined> | undefined;

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
      h.on("keydown", aoApertar);
      h.on("keyup", aoSoltar);
      return { hook: h, teclas };
    })
    .catch((e: unknown) => {
      console.error("Atalhos globais indisponíveis:", e);
      return undefined;
    });
  return hook;
}

/**
 * O `KeyboardEvent.code` do cliente no código do hook.
 *
 * Os nomes do `UiohookKey` são os do `code` sem os prefixos `Key` e `Digit` —
 * `KeyM` → `M`, `Digit1` → `1`, `Space`, `F13`, `BracketLeft`.
 */
function nomeNoHook(codigo: string): string {
  return codigo.replace(/^Key(?=[A-Z]$)/, "").replace(/^Digit(?=\d$)/, "");
}

/** As combinações valendo, já traduzidas para o código do hook. */
let cadastro: { acao: Acao; keycode: number; c: Combinacao }[] = [];
/** Teclas seguradas — o hook repete `keydown` enquanto a tecla está baixa. */
const baixas = new Set<number>();
let rodando = false;
/** Um "começou a falar" foi enviado e ainda não teve o "parou". */
let falando = false;

function enviar(comando: ComandoDeVoz): void {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("vortexComandoDeVoz", comando);
}

/**
 * Os modificadores, pelas teclas SEGURADAS e não pelas flags do evento.
 *
 * ⚠ **Medido: `altKey`/`shiftKey` do hook vêm `false` com o modificador
 * baixo.** Com Shift (42) apertado antes de F24, o `keydown` do F24 chegou com
 * `shiftKey=false`. Contar as teclas que o próprio hook viu descer é o que dá
 * a resposta certa — e ele reporta essas corretamente.
 */
const CODIGOS_MOD = {
  ctrl: [29, 3613],
  alt: [56, 3640],
  shift: [42, 54],
  meta: [3675, 3676],
} as const;

function segurado(codigos: readonly number[]): boolean {
  return codigos.some((c) => baixas.has(c));
}

function modificadoresBatem(c: Combinacao): boolean {
  const mod = segurado(process.platform === "darwin" ? CODIGOS_MOD.meta : CODIGOS_MOD.ctrl);
  return (
    mod === c.mod && segurado(CODIGOS_MOD.alt) === c.alt && segurado(CODIGOS_MOD.shift) === c.shift
  );
}

function aoApertar(e: EventoDeTecla): void {
  if (baixas.has(e.keycode)) return;
  baixas.add(e.keycode);
  for (const { acao, keycode, c } of cadastro) {
    if (keycode !== e.keycode || !modificadoresBatem(c)) continue;
    if (acao === "pushToTalk") falando = true;
    enviar(acao === "pushToTalk" ? "pushToTalkInicio" : acao);
    return;
  }
}

function aoSoltar(e: EventoDeTecla): void {
  baixas.delete(e.keycode);
  /* Soltar a tecla principal basta: o modificador pode ter sido solto antes, e
     exigir a combinação inteira deixaria o microfone aberto. */
  const ptt = cadastro.find((x) => x.acao === "pushToTalk");
  if (falando && ptt && ptt.keycode === e.keycode) {
    falando = false;
    enviar("pushToTalkFim");
  }
}

function combinacaoValida(v: unknown): Combinacao | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.codigo !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(o.codigo)) {
    return undefined;
  }
  return { codigo: o.codigo, mod: o.mod === true, alt: o.alt === true, shift: o.shift === true };
}

async function definirAtalhos(bruto: unknown): Promise<boolean> {
  /* Validado AQUI: a ponte é alcançável por conteúdo de terceiro se houver XSS. */
  const entrada = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<
    string,
    unknown
  >;
  const pedidos = ACOES.flatMap((acao) => {
    const c = combinacaoValida(entrada[acao]);
    return c ? [{ acao, c }] : [];
  });

  if (pedidos.length === 0) {
    cadastro = [];
    if (rodando) {
      (await carregarHook())?.hook.stop();
      rodando = false;
    }
    baixas.clear();
    if (falando) {
      falando = false;
      enviar("pushToTalkFim");
    }
    return true;
  }

  const h = await carregarHook();
  if (!h) return false;
  cadastro = pedidos.flatMap(({ acao, c }) => {
    const keycode = h.teclas[nomeNoHook(c.codigo)];
    return typeof keycode === "number" ? [{ acao, keycode, c }] : [];
  });
  if (!rodando) {
    h.hook.start();
    rodando = true;
  }
  return true;
}

export function registrarControles(): void {
  /* O hook precisa parar antes de o processo sair: um hook de teclado órfão é
     exatamente o que antivírus e o próprio Windows tratam com desconfiança. */
  app.on("will-quit", () => void pararControles());

  ipcMain.handle("vortexDefinirAtalhos", (_e, atalhos: unknown) => definirAtalhos(atalhos));

  ipcMain.on("vortexEstadoDeVoz", (_e, estado: unknown) => {
    const o = (typeof estado === "object" && estado !== null ? estado : {}) as Record<
      string,
      unknown
    >;
    definirEstadoDeVoz({
      naChamada: o.naChamada === true,
      mudo: o.mudo === true,
      surdo: o.surdo === true,
    });
  });
}

async function pararControles(): Promise<void> {
  if (!rodando) return;
  (await carregarHook())?.hook.stop();
  rodando = false;
}
