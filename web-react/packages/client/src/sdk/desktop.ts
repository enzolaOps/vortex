/**
 * A ponte com a casca Electron — camada anticorrupção, como o `stoat.js`.
 *
 * ⚠ **API ESTREITA E ENUMERADA, e isto é regra de segurança do briefing, não
 * estilo.** O app renderiza conteúdo escrito por qualquer pessoa; um preload
 * que exponha `ipcRenderer` cru dá a esse conteúdo um canal para o processo
 * main. O que atravessa é esta lista fechada de verbos, cada um com tipo, e o
 * main valida de novo do lado dele.
 *
 * ⚠ **O contrato vive AQUI, no cliente, e não no `desktop/`.** É o cliente que
 * sabe o que precisa; a casca implementa. Invertido, a casca ditaria a forma
 * das telas — que é exatamente o que "casca fina, não segunda aplicação"
 * proíbe. Um arquivo, uma lista, e a casca falha em tempo de tipo se divergir.
 *
 * ⚠ **Tudo degrada no navegador.** `naDesktop()` é `false` ali, e cada função
 * vira no-op ou devolve a ausência. Não há `MessageRow.desktop.tsx` e não vai
 * haver: a divergência de plataforma mora atrás deste módulo, num lugar só.
 */

/** O que a janela pode fazer consigo mesma. */
export type ControleDeJanela = "minimizar" | "maximizar" | "restaurar" | "fechar";

/** O que fazer quando alguém fecha a janela. */
export const AO_FECHAR = ["bandeja", "encerrar", "perguntar"] as const;
export type AoFechar = (typeof AO_FECHAR)[number];

/** Onde o overlay do jogo aparece. */
export const CANTOS = ["cima-inicio", "cima-fim", "baixo-inicio", "baixo-fim"] as const;
export type Canto = (typeof CANTOS)[number];

/** O ciclo de vida de uma atualização — os seis estados do design. */
export const ESTADOS_DE_ATUALIZACAO = [
  "em-dia",
  "verificando",
  "baixando",
  "pronta",
  "obrigatoria",
  "falhou",
] as const;
export type EstadoDeAtualizacao = (typeof ESTADOS_DE_ATUALIZACAO)[number];

export type Atualizacao = {
  readonly estado: EstadoDeAtualizacao;
  /** A versão que está esperando, quando há uma. */
  readonly versao: string | undefined;
  /** 0 a 100, só durante `baixando`. */
  readonly progresso: number;
};

/**
 * O que a casca expõe. Nada além disto atravessa.
 *
 * ⚠ Toda função é `Promise` mesmo quando o main responde na hora: IPC é
 * assíncrono por natureza, e um contrato síncrono obrigaria a casca a usar
 * `ipcRenderer.sendSync`, que BLOQUEIA o renderer. Num app com uma lista
 * virtualizada de dez mil linhas, isso é um congelamento visível por um
 * booleano.
 */
export type PonteDesktop = {
  readonly versao: string;
  readonly plataforma: "win32" | "darwin" | "linux";
  /** Versão do Electron — o design mostra, e só a casca sabe. */
  readonly electron: string;

  readonly janela: (o: ControleDeJanela) => Promise<void>;
  readonly assinarJanela: (
    ouvinte: (estado: { maximizada: boolean; comFoco: boolean }) => void,
  ) => () => void;

  readonly lerPreferencias: () => Promise<Record<string, unknown>>;
  readonly gravarPreferencia: (chave: string, valor: unknown) => Promise<void>;

  readonly assinarAtualizacao: (ouvinte: (a: Atualizacao) => void) => () => void;
  readonly verificarAtualizacao: () => Promise<void>;
  readonly instalarEReiniciar: () => Promise<void>;

  readonly tamanhoDoCache: () => Promise<number>;
  readonly limparCache: () => Promise<void>;
  readonly abrirPastaDeLogs: () => Promise<void>;
};

declare global {
  interface Window {
    /** Injetada pelo preload da casca. Ausente no navegador. */
    readonly vortex?: PonteDesktop;
  }
}

/**
 * Estamos rodando dentro da casca?
 *
 * ⚠ **A pergunta é sobre a PONTE existir, não sobre o user agent.** Testar
 * `navigator.userAgent.includes("Electron")` daria `true` numa aba de DevTools
 * remota e `false` se a casca trocar de runtime — e o que decide se o app pode
 * minimizar uma janela é ter a função, não o nome do processo.
 */
export function naDesktop(): boolean {
  return typeof window !== "undefined" && window.vortex !== undefined;
}

export function ponte(): PonteDesktop | undefined {
  return typeof window === "undefined" ? undefined : window.vortex;
}

/**
 * A versão, para as telas que a mostram.
 *
 * ⚠ **Duas fontes e nenhuma inventada.** Na casca, a versão é a do pacote
 * instalado; no navegador, a do build (`__VERSAO__`). O design mostra também
 * "Electron 32", e isso só existe na casca — no navegador o campo some em vez
 * de mentir, que é a mesma decisão de "Conectado · 42 ms" na faixa de voz.
 */
export function versaoInstalada(): {
  versao: string;
  electron: string | undefined;
} {
  const p = ponte();
  return p
    ? { versao: p.versao, electron: p.electron }
    : { versao: __VERSAO__, electron: undefined };
}
