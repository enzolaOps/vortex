/**
 * O canal privado entre a janela principal e a do overlay — a DECISÃO, sem
 * Electron.
 *
 * ⚠ **Porta, e não canal global de IPC.** Estado, mensagens e comandos do overlay
 * passavam por canais globais do main, que qualquer `webContents` pode tentar
 * chamar e que o main precisava filtrar um a um. Agora cada janela recebe do
 * main UMA porta (`MessageChannelMain`, entregue por `webContents.postMessage`
 * com `ports`), e o overlay não tem canal de IPC nenhum: só essa porta.
 *
 * ⚠ **O main fica NO MEIO, de propósito.** Um par ligando as duas janelas
 * direto seria mais curto e cegaria o main — e é ele quem precisa ler o
 * estado para decidir se o overlay aparece, e quem precisa validar o que o
 * overlay pede antes de chegar à principal. Então são dois pares, um por
 * janela, e o main repassa:
 *
 *     principal ──{estado, mensagem}──▶ main ──{estado, mensagem,
 *                                              interacao, silencio}──▶ overlay
 *     principal ◀──vortexComandoDeVoz── main ◀──{comando}──────────── overlay
 *
 * O overlay só pede INTENÇÕES de uma lista fechada (`mutar`, `ensurdecer`,
 * `desconectar`); o que não estiver nela, ou não tiver a forma certa, morre
 * no main.
 *
 * ⚠ **A porta morre com a página.** Recarregar, navegar, o renderer cair ou a
 * janela fechar: o main fecha a porta daquele lado, e a página nova recebe
 * uma nova em `did-finish-load`. Uma porta velha nunca fala com a página nova.
 */

export type Papel = "principal" | "overlay";

/** O canal de IPC (main → renderer) pelo qual a porta é ENTREGUE. */
export const CANAL_DA_PORTA = "vortexOverlayPorta";

export const COMANDOS_DO_OVERLAY = ["mutar", "ensurdecer", "desconectar"] as const;
export type ComandoDoOverlay = (typeof COMANDOS_DO_OVERLAY)[number];

export type EstadoDoOverlay = { readonly ativo: boolean; readonly [k: string]: unknown };

export type MensagemDoOverlay = {
  readonly id: string;
  readonly canal: string;
  readonly autor: string;
  readonly texto: string;
};

/** O que a principal manda pela porta dela. */
export type DaPrincipal =
  | { readonly tipo: "estado"; readonly estado: EstadoDoOverlay }
  | { readonly tipo: "mensagem"; readonly mensagem: MensagemDoOverlay };

/** O que o overlay manda pela porta dele. */
export type DoOverlay = { readonly tipo: "comando"; readonly comando: ComandoDoOverlay };

/** O que o main manda ao overlay. */
export type ParaOOverlay =
  | { readonly tipo: "estado"; readonly estado: EstadoDoOverlay }
  | { readonly tipo: "mensagem"; readonly mensagem: MensagemDoOverlay }
  | { readonly tipo: "interacao"; readonly interagindo: boolean }
  | { readonly tipo: "silencio"; readonly silenciadas: boolean };

function objeto(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined;
}

function estado(v: unknown): EstadoDoOverlay | undefined {
  const o = objeto(v);
  return o && typeof o.ativo === "boolean" ? (o as EstadoDoOverlay) : undefined;
}

function mensagem(v: unknown): MensagemDoOverlay | undefined {
  const o = objeto(v);
  if (!o) return undefined;
  const { id, canal, autor, texto } = o;
  return typeof id === "string" &&
    typeof canal === "string" &&
    typeof autor === "string" &&
    typeof texto === "string"
    ? { id, canal, autor, texto }
    : undefined;
}

export function lerDaPrincipal(dado: unknown): DaPrincipal | undefined {
  const o = objeto(dado);
  if (o?.tipo === "estado") {
    const e = estado(o.estado);
    return e && { tipo: "estado", estado: e };
  }
  if (o?.tipo === "mensagem") {
    const m = mensagem(o.mensagem);
    return m && { tipo: "mensagem", mensagem: m };
  }
  return undefined;
}

export function lerDoOverlay(dado: unknown): DoOverlay | undefined {
  const o = objeto(dado);
  return o?.tipo === "comando" &&
    (COMANDOS_DO_OVERLAY as readonly unknown[]).includes(o.comando)
    ? { tipo: "comando", comando: o.comando as ComandoDoOverlay }
    : undefined;
}

/** Usado pelo preload do overlay: o main é confiável, a porta é conferida igual. */
export function lerParaOOverlay(dado: unknown): ParaOOverlay | undefined {
  const o = objeto(dado);
  switch (o?.tipo) {
    case "estado": {
      const e = estado(o.estado);
      return e && { tipo: "estado", estado: e };
    }
    case "mensagem": {
      const m = mensagem(o.mensagem);
      return m && { tipo: "mensagem", mensagem: m };
    }
    case "interacao":
      return typeof o.interagindo === "boolean"
        ? { tipo: "interacao", interagindo: o.interagindo }
        : undefined;
    case "silencio":
      return typeof o.silenciadas === "boolean"
        ? { tipo: "silencio", silenciadas: o.silenciadas }
        : undefined;
    default:
      return undefined;
  }
}

/* ------------------------------------------------ o ciclo de vida */

/** O mínimo de `MessagePortMain` que o comutador usa. */
export type PortaConferivel = {
  postMessage(mensagem: unknown): void;
  start(): void;
  close(): void;
  on(evento: "message", ouvinte: (e: { data: unknown }) => void): unknown;
  on(evento: "close", ouvinte: () => void): unknown;
};

export type ParDePortas = { port1: PortaConferivel; port2: PortaConferivel };

export type Dependencias = {
  criarPar: () => ParDePortas;
  /**
   * Entrega a porta à janela do papel. `false` quando a janela não existe ou
   * não está na origem do app — aí nada é conectado.
   */
  entregar: (papel: Papel, porta: PortaConferivel) => boolean;
  daPrincipal: (m: DaPrincipal) => void;
  doOverlay: (m: DoOverlay) => void;
  /** Depois de conectar — o overlay recebe aqui o retrato do estado atual. */
  aoConectar: (papel: Papel) => void;
  /** Depois de uma conexão EXISTENTE cair. */
  aoDesconectar: (papel: Papel) => void;
  avisar?: (papel: Papel) => void;
};

export type Comutador = {
  /** (Re)cria a porta do papel: fecha a anterior e entrega uma nova. */
  conectar(papel: Papel): void;
  /** Fecha a porta do papel, se houver. */
  desconectar(papel: Papel): void;
  /** Manda ao overlay. `false` se ele não está conectado. */
  enviarAoOverlay(m: ParaOOverlay): boolean;
  conectado(papel: Papel): boolean;
};

export function criarComutador(d: Dependencias): Comutador {
  const atuais: Record<Papel, PortaConferivel | undefined> = {
    principal: undefined,
    overlay: undefined,
  };
  const avisar =
    d.avisar ?? ((papel: Papel) => console.warn(`Porta do overlay: mensagem recusada vinda de "${papel}".`));

  function fechar(porta: PortaConferivel): void {
    try {
      porta.close();
    } catch {
      /* Fechar o que já fechou não é erro. */
    }
  }

  function desconectar(papel: Papel): void {
    const porta = atuais[papel];
    if (!porta) return;
    atuais[papel] = undefined;
    fechar(porta);
    d.aoDesconectar(papel);
  }

  function receber(papel: Papel, porta: PortaConferivel, dado: unknown): void {
    /* Porta que já foi substituída não fala mais, nem se ainda tiver fila. */
    if (atuais[papel] !== porta) return;
    if (papel === "principal") {
      const m = lerDaPrincipal(dado);
      if (m) d.daPrincipal(m);
      else avisar(papel);
    } else {
      const m = lerDoOverlay(dado);
      if (m) d.doOverlay(m);
      else avisar(papel);
    }
  }

  function conectar(papel: Papel): void {
    desconectar(papel);
    const { port1: nossa, port2: deles } = d.criarPar();
    nossa.on("message", (e) => receber(papel, nossa, e.data));
    nossa.on("close", () => {
      if (atuais[papel] === nossa) desconectar(papel);
    });
    let entregue = false;
    try {
      entregue = d.entregar(papel, deles);
    } catch {
      entregue = false;
    }
    if (!entregue) {
      fechar(nossa);
      fechar(deles);
      return;
    }
    atuais[papel] = nossa;
    nossa.start();
    d.aoConectar(papel);
  }

  return {
    conectar,
    desconectar,
    enviarAoOverlay(m) {
      const porta = atuais.overlay;
      if (!porta) return false;
      try {
        porta.postMessage(m);
        return true;
      } catch {
        return false;
      }
    },
    conectado: (papel) => atuais[papel] !== undefined,
  };
}
