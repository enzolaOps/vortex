/**
 * Os atalhos de voz: push-to-talk, mutar, ensurdecer e desconectar.
 *
 * ⚠ **Só nesta máquina, sem sync com o servidor.** As outras preferências de
 * voz viajam entre dispositivos; atalho não deveria — o teclado do notebook e
 * o do computador do jogo são outros, e uma combinação boa num pode ser a tecla
 * de habilidade do jogo no outro.
 *
 * ⚠ **A combinação guarda o `code` FÍSICO da tecla, não o caractere.** O
 * `KeyboardEvent.key` muda com o layout (ABNT, US, com Shift ou sem); o
 * `code` é a posição, e é o único que a casca consegue casar com o hook de
 * teclado do sistema, que também só conhece posições.
 *
 * Modificadores em notação neutra: `mod` é Ctrl no Windows e Linux e ⌘ no
 * Mac, a mesma convenção de `components/ui/Tecla.tsx`.
 */

export const ACOES_DE_VOZ = [
  "pushToTalk",
  "mutar",
  "ensurdecer",
  "desconectar",
] as const;
export type AcaoDeVoz = (typeof ACOES_DE_VOZ)[number];

export const ROTULO_DA_ACAO: Record<AcaoDeVoz, string> = {
  pushToTalk: "Push-to-talk",
  mutar: "Mutar microfone",
  ensurdecer: "Ensurdecer",
  desconectar: "Desconectar da voz",
};

export type CombinacaoDeTeclas = {
  /** `KeyboardEvent.code` da tecla principal — `KeyM`, `Space`, `F13`. */
  readonly codigo: string;
  readonly mod: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
};

export type AtalhosDeVoz = Readonly<
  Record<AcaoDeVoz, CombinacaoDeTeclas | undefined>
>;

/** Os do design. */
export const ATALHOS_PADRAO: AtalhosDeVoz = {
  pushToTalk: { codigo: "Space", mod: false, alt: true, shift: false },
  mutar: { codigo: "KeyM", mod: true, alt: false, shift: true },
  ensurdecer: { codigo: "KeyD", mod: true, alt: false, shift: true },
  desconectar: { codigo: "Backspace", mod: true, alt: false, shift: true },
};

/** Teclas que só modificam: gravar uma delas sozinha não é combinação. */
const SO_MODIFICADORES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
]);

/**
 * A combinação que um `keydown` descreve, ou `undefined` se ainda falta a
 * tecla principal (a pessoa só apertou Ctrl, por exemplo).
 */
export function combinacaoDoEvento(
  e: {
    code: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  },
  mac: boolean,
): CombinacaoDeTeclas | undefined {
  if (!e.code || SO_MODIFICADORES.has(e.code)) return undefined;
  return {
    codigo: e.code,
    mod: mac ? e.metaKey : e.ctrlKey,
    alt: e.altKey,
    shift: e.shiftKey,
  };
}

export function mesmaCombinacao(
  a: CombinacaoDeTeclas | undefined,
  b: CombinacaoDeTeclas | undefined,
): boolean {
  if (!a || !b) return false;
  return (
    a.codigo === b.codigo && a.mod === b.mod && a.alt === b.alt && a.shift === b.shift
  );
}

/** O nome da tecla principal, para mostrar. */
export function nomeDaTecla(codigo: string): string {
  if (/^Key[A-Z]$/.test(codigo)) return codigo.slice(3);
  if (/^Digit\d$/.test(codigo)) return codigo.slice(5);
  if (/^Numpad\d$/.test(codigo)) return `Num ${codigo.slice(6)}`;
  const nomes: Record<string, string> = {
    Space: "Espaço",
    Backspace: "backspace",
    Enter: "enter",
    Escape: "esc",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    CapsLock: "Caps Lock",
    Tab: "Tab",
  };
  return nomes[codigo] ?? codigo;
}

/** Tokens para `<Combinacao>` — `["shift", "mod", "M"]`. */
export function teclasDaCombinacao(c: CombinacaoDeTeclas): string[] {
  return [
    ...(c.shift ? ["shift"] : []),
    ...(c.mod ? ["mod"] : []),
    ...(c.alt ? ["alt"] : []),
    nomeDaTecla(c.codigo),
  ];
}

/**
 * As ações cuja combinação se repete em outra.
 *
 * ⚠ **As DUAS linhas são marcadas**, e a regra é do design: marcar só uma
 * faria a pessoa consertar a errada. E nenhuma das duas dispara enquanto o
 * conflito existir — disparar as duas de uma vez (mutar E desconectar) seria
 * pior que nenhuma.
 */
export function acoesEmConflito(atalhos: AtalhosDeVoz): ReadonlySet<AcaoDeVoz> {
  const conflito = new Set<AcaoDeVoz>();
  for (const a of ACOES_DE_VOZ) {
    for (const b of ACOES_DE_VOZ) {
      if (a !== b && mesmaCombinacao(atalhos[a], atalhos[b])) {
        conflito.add(a);
        conflito.add(b);
      }
    }
  }
  return conflito;
}

/** Os atalhos que valem: sem os em conflito e sem os vazios. */
export function atalhosAtivos(
  atalhos: AtalhosDeVoz,
): Partial<Record<AcaoDeVoz, CombinacaoDeTeclas>> {
  const conflito = acoesEmConflito(atalhos);
  const ativos: Partial<Record<AcaoDeVoz, CombinacaoDeTeclas>> = {};
  for (const a of ACOES_DE_VOZ) {
    const c = atalhos[a];
    if (c && !conflito.has(a)) ativos[a] = c;
  }
  return ativos;
}

/* ------------------------------------------------------------- o store */

const CHAVE = "vortex:atalhosDeVoz";

function combinacao(v: unknown): CombinacaoDeTeclas | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.codigo !== "string" || o.codigo === "") return undefined;
  return {
    codigo: o.codigo,
    mod: o.mod === true,
    alt: o.alt === true,
    shift: o.shift === true,
  };
}

function ler(): AtalhosDeVoz {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return ATALHOS_PADRAO;
    const o = JSON.parse(cru) as Record<string, unknown>;
    const lido = {} as Record<AcaoDeVoz, CombinacaoDeTeclas | undefined>;
    for (const a of ACOES_DE_VOZ) {
      /* `null` guardado = a pessoa APAGOU o atalho; ausente = nunca mexeu. */
      lido[a] = o[a] === null ? undefined : (combinacao(o[a]) ?? ATALHOS_PADRAO[a]);
    }
    return lido;
  } catch {
    return ATALHOS_PADRAO;
  }
}

let atalhos: AtalhosDeVoz = ler();
const ouvintes = new Set<() => void>();

export function assinarAtalhosDeVoz(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável — trocada só quando algo muda. */
export function lerAtalhosDeVoz(): AtalhosDeVoz {
  return atalhos;
}

export function definirAtalho(
  acao: AcaoDeVoz,
  c: CombinacaoDeTeclas | undefined,
): void {
  if (c === atalhos[acao] || mesmaCombinacao(c, atalhos[acao])) return;
  atalhos = { ...atalhos, [acao]: c };
  try {
    const guardar: Record<string, CombinacaoDeTeclas | null> = {};
    for (const a of ACOES_DE_VOZ) guardar[a] = atalhos[a] ?? null;
    localStorage.setItem(CHAVE, JSON.stringify(guardar));
  } catch {
    /* vale nesta aba */
  }
  for (const o of ouvintes) o();
}
