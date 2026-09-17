import {
  alternarMudo,
  alternarSurdo,
  sairDaChamada,
} from "./chamada";
import { assinarChamada, lerChamada } from "../store/chamada";
import { assinarPopout, lerPopout } from "../store/popout";
import {
  assinarAtalhosDeVoz,
  atalhosAtivos,
  lerAtalhosDeVoz,
  mesmaCombinacao,
  combinacaoDoEvento,
  type AcaoDeVoz,
  type CombinacaoDeTeclas,
} from "../store/atalhosDeVoz";
import { definirSegurando } from "../store/pushToTalk";

/**
 * Os atalhos de voz em funcionamento, e o estado de voz para a bandeja.
 *
 * ⚠ **Dois ouvidos, e NUNCA os dois ao mesmo tempo.** No navegador quem ouve é
 * a janela, e só com ela em foco. No desktop quem ouve é o hook de teclado da
 * casca, com foco ou sem. Ligar os dois no desktop faria cada toque em
 * "mutar" alternar DUAS vezes — ou seja, não fazer nada.
 *
 * ⚠ **A casca nunca manda TECLA para cá, só COMANDO.** O hook vê o teclado do
 * sistema inteiro; o que atravessa a ponte é "mutar" ou "começou a falar".
 * Um XSS no cliente não vira keylogger.
 */

export type ComandoDeVoz =
  | "pushToTalkInicio"
  | "pushToTalkFim"
  | "mutar"
  | "ensurdecer"
  | "desconectar";

export type EstadoDeVozParaCasca = {
  readonly naChamada: boolean;
  readonly mudo: boolean;
  readonly surdo: boolean;
  /**
   * A chamada está no popout em forma de picture-in-picture — é quando
   * "Sempre no topo em chamada" põe a janela acima das outras. Casca antiga
   * ignora o campo.
   */
  readonly pip: boolean;
};

/** A ponte da casca — separada de `vortex` para não tornar cascas antigas incompletas. */
export type PonteDeControles = {
  readonly definirAtalhos: (
    atalhos: Partial<Record<AcaoDeVoz, CombinacaoDeTeclas>>,
  ) => Promise<boolean>;
  readonly assinarComandos: (ouvinte: (c: ComandoDeVoz) => void) => () => void;
  readonly publicarEstadoDeVoz: (e: EstadoDeVozParaCasca) => void;
};

declare global {
  interface Window {
    readonly vortexControles?: PonteDeControles;
  }
}

const VERBOS: Record<keyof PonteDeControles, true> = {
  definirAtalhos: true,
  assinarComandos: true,
  publicarEstadoDeVoz: true,
};

export function ponteDeControles(): PonteDeControles | undefined {
  if (typeof window === "undefined") return undefined;
  const p = window.vortexControles as Record<string, unknown> | undefined;
  if (!p) return undefined;
  return Object.keys(VERBOS).every((v) => typeof p[v] === "function")
    ? window.vortexControles
    : undefined;
}

/** Executa um comando, venha do teclado, do hook ou da bandeja. */
export function executarComando(c: ComandoDeVoz): void {
  switch (c) {
    case "pushToTalkInicio":
      definirSegurando(true);
      return;
    case "pushToTalkFim":
      definirSegurando(false);
      return;
    case "mutar":
      void alternarMudo();
      return;
    case "ensurdecer":
      void alternarSurdo();
      return;
    case "desconectar":
      if (lerChamada().estado !== "fora") void sairDaChamada();
      return;
  }
}

/*
  `overlay` e `silenciarOverlay` ficam de fora de propósito: quem os executa é
  a casca, no processo main, e no navegador não há overlay.
*/
const COMANDO_DE_PRESSAO: Record<
  Exclude<AcaoDeVoz, "pushToTalk" | "overlay" | "silenciarOverlay">,
  ComandoDeVoz
> = {
  mutar: "mutar",
  ensurdecer: "ensurdecer",
  desconectar: "desconectar",
};

const MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/**
 * O que um evento de teclado da JANELA dispara. Exportado para o teste.
 *
 * `repeat` é ignorado: segurar a tecla de mutar não pode alternar trinta vezes
 * por segundo, e o push-to-talk já está "começado".
 */
export function comandoDaTecla(
  e: {
    type: string;
    code: string;
    repeat: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
  },
  ativos: Partial<Record<AcaoDeVoz, CombinacaoDeTeclas>>,
  mac: boolean,
): ComandoDeVoz | undefined {
  const ptt = ativos.pushToTalk;
  /* Soltar: basta a tecla principal — os modificadores podem ter sido soltos
     antes, e exigir a combinação inteira deixaria o microfone aberto. */
  if (e.type === "keyup") {
    return ptt && e.code === ptt.codigo ? "pushToTalkFim" : undefined;
  }
  if (e.type !== "keydown" || e.repeat) return undefined;
  const c = combinacaoDoEvento(e, mac);
  if (!c) return undefined;
  if (mesmaCombinacao(c, ptt)) return "pushToTalkInicio";
  for (const [acao, comando] of Object.entries(COMANDO_DE_PRESSAO)) {
    if (mesmaCombinacao(c, ativos[acao as AcaoDeVoz])) return comando;
  }
  return undefined;
}

let ligado = false;

/**
 * Enquanto uma combinação está sendo GRAVADA nas configurações, os atalhos não
 * disparam — senão gravar "Ctrl+Shift+M" para mutar, com ele já valendo,
 * mutaria no meio da gravação.
 */
let pausado = false;
let reenviar: (() => void) | undefined;

export function pausarAtalhos(sim: boolean): void {
  if (pausado === sim) return;
  pausado = sim;
  if (!sim) definirSegurando(false);
  reenviar?.();
}

/**
 * Liga os atalhos. Idempotente; chamado uma vez quando a sessão abre.
 */
export function ligarAtalhosDeVoz(): void {
  if (ligado || typeof window === "undefined") return;
  ligado = true;

  const casca = ponteDeControles();
  if (casca) {
    const enviar = () =>
      void casca.definirAtalhos(pausado ? {} : atalhosAtivos(lerAtalhosDeVoz()));
    reenviar = enviar;
    enviar();
    assinarAtalhosDeVoz(enviar);
    casca.assinarComandos(executarComando);

    /* A bandeja mostra mudo, surdo e "Desconectar" só com chamada. */
    let ultimo = "";
    const publicar = () => {
      const c = lerChamada();
      const estado = {
        naChamada: c.estado !== "fora",
        mudo: c.mudo,
        surdo: c.surdo,
        pip: c.estado !== "fora" && lerPopout().forma === "pip",
      };
      const chave = JSON.stringify(estado);
      if (chave === ultimo) return;
      ultimo = chave;
      casca.publicarEstadoDeVoz(estado);
    };
    publicar();
    assinarChamada(publicar);
    /* Arrastar o popout também publica; a chave igual descarta sem IPC. */
    assinarPopout(publicar);
    return;
  }

  const aoTeclado = (e: KeyboardEvent) => {
    if (pausado) return;
    const comando = comandoDaTecla(e, atalhosAtivos(lerAtalhosDeVoz()), MAC);
    if (!comando) return;
    /* O atalho é nosso: sem isto, Ctrl+Shift+D também abriria o "adicionar
       favoritos" do navegador. Soltar não tem ação padrão a impedir. */
    if (e.type === "keydown") e.preventDefault();
    executarComando(comando);
  };
  window.addEventListener("keydown", aoTeclado);
  window.addEventListener("keyup", aoTeclado);
  /* Trocar de janela com a tecla segurada: o `keyup` vai para outra janela, e
     o microfone ficaria aberto sem ninguém apertando nada. */
  window.addEventListener("blur", () => definirSegurando(false));
}
