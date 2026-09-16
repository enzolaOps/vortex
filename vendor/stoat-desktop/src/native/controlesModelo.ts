/**
 * A decisão dos atalhos globais — o efeito (carregar o `uiohook-napi`, falar
 * com a janela, o overlay e o IPC) mora em `controles.ts`.
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

/*
  ⚠ Ação que a casca não conhece é IGNORADA (o `flatMap` de `definirAtalhos`
  só olha estas): um cliente mais novo que a casca manda chaves a mais, e elas
  não podem derrubar as que ela entende.
*/
const ACOES = [
  "pushToTalk",
  "mutar",
  "ensurdecer",
  "desconectar",
  "overlay",
  "silenciarOverlay",
] as const;
type Acao = (typeof ACOES)[number];

export type EventoDeTecla = { keycode: number };

export type Hook = {
  on(evento: "keydown" | "keyup", ouvinte: (e: EventoDeTecla) => void): void;
  start(): void;
  stop(): void;
};

export type HookCarregado = { hook: Hook; teclas: Record<string, number> };

/**
 * O `KeyboardEvent.code` do cliente no código do hook.
 *
 * Os nomes do `UiohookKey` são os do `code` sem os prefixos `Key` e `Digit` —
 * `KeyM` → `M`, `Digit1` → `1`, `Space`, `F13`, `BracketLeft`.
 */
function nomeNoHook(codigo: string): string {
  return codigo.replace(/^Key(?=[A-Z]$)/, "").replace(/^Digit(?=\d$)/, "");
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

function combinacaoValida(v: unknown): Combinacao | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.codigo !== "string" || !/^[A-Za-z0-9]{1,24}$/.test(o.codigo)) {
    return undefined;
  }
  return { codigo: o.codigo, mod: o.mod === true, alt: o.alt === true, shift: o.shift === true };
}

type Deps = {
  /** O módulo nativo, ainda SEM ouvintes. Idempotente. */
  carregarHook: () => Promise<HookCarregado | undefined>;
  enviar: (comando: ComandoDeVoz) => void;
  alternarOverlay: () => void;
  alternarSilencioDoOverlay: () => void;
  plataforma?: string;
};

export function criarControles({
  carregarHook,
  enviar,
  alternarOverlay,
  alternarSilencioDoOverlay,
  plataforma = process.platform,
}: Deps) {
  /** As combinações valendo, já traduzidas para o código do hook. */
  let cadastro: { acao: Acao; keycode: number; c: Combinacao }[] = [];
  /** Teclas seguradas — o hook repete `keydown` enquanto a tecla está baixa. */
  const baixas = new Set<number>();
  let rodando = false;
  /** Um "começou a falar" foi enviado e ainda não teve o "parou". */
  let falando = false;
  let ouvindo: Promise<HookCarregado | undefined> | undefined;

  /* Os ouvintes entram UMA vez, no primeiro carregamento. */
  function obterHook() {
    ouvindo ??= carregarHook().then((h) => {
      h?.hook.on("keydown", aoApertar);
      h?.hook.on("keyup", aoSoltar);
      return h;
    });
    return ouvindo;
  }

  function segurado(codigos: readonly number[]): boolean {
    return codigos.some((c) => baixas.has(c));
  }

  function modificadoresBatem(c: Combinacao): boolean {
    const mod = segurado(plataforma === "darwin" ? CODIGOS_MOD.meta : CODIGOS_MOD.ctrl);
    return (
      mod === c.mod &&
      segurado(CODIGOS_MOD.alt) === c.alt &&
      segurado(CODIGOS_MOD.shift) === c.shift
    );
  }

  function aoApertar(e: EventoDeTecla): void {
    if (baixas.has(e.keycode)) return;
    baixas.add(e.keycode);
    for (const { acao, keycode, c } of cadastro) {
      if (keycode !== e.keycode || !modificadoresBatem(c)) continue;
      /* O overlay é da casca: alterna aqui mesmo, sem ida e volta ao cliente. */
      if (acao === "overlay") {
        alternarOverlay();
        return;
      }
      /* Silenciar as mensagens do overlay também: é estado da janela dele. */
      if (acao === "silenciarOverlay") {
        alternarSilencioDoOverlay();
        return;
      }
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

  /** Nenhum atalho valendo: o hook para e um push-to-talk aberto fecha. */
  async function semAtalhos(): Promise<void> {
    cadastro = [];
    await parar();
    baixas.clear();
    if (falando) {
      falando = false;
      enviar("pushToTalkFim");
    }
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
      await semAtalhos();
      return true;
    }

    const h = await obterHook();
    if (!h) return false;
    const traduzidos = pedidos.flatMap(({ acao, c }) => {
      const keycode = h.teclas[nomeNoHook(c.codigo)];
      return typeof keycode === "number" ? [{ acao, keycode, c }] : [];
    });
    /*
      ⚠ Códigos que passam no regex mas que o `UiohookKey` não conhece
      traduzem para NADA — e um hook rodando sem cadastro observa o teclado
      inteiro sem motivo. É o mesmo caso de não pedir atalho nenhum.
    */
    if (traduzidos.length === 0) {
      await semAtalhos();
      return true;
    }
    cadastro = traduzidos;
    if (!rodando) {
      h.hook.start();
      rodando = true;
    }
    return true;
  }

  async function parar(): Promise<void> {
    if (!rodando) return;
    (await obterHook())?.hook.stop();
    rodando = false;
  }

  return { definirAtalhos, parar };
}
