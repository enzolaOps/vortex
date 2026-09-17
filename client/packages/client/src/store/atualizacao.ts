import { linkDeDownload } from "../lib/downloadDoDesktop";
import { versaoAbaixoDoMinimo } from "../lib/versao";
import { esperarConfiguracao, versaoMinimaDoDesktop } from "../sdk/config";
import { ponte, type Atualizacao } from "../sdk/desktop";
import { assinarDesktop, lerDesktop } from "./desktop";

/**
 * O ciclo de atualização da casca, como a interface o vê.
 *
 * ⚠ **Store e não `useState` no componente, e é a lei nº 1.** Duas superfícies
 * leem o mesmo estado — a faixa/bloqueio no topo da janela e a linha "Versão
 * instalada" em Configurações —, e cada uma assinando a ponte por conta própria
 * daria dois ouvintes de IPC e duas opiniões sobre se a atualização é
 * obrigatória.
 *
 * ⚠ **"Obrigatória" é decidida AQUI, não na casca.** Quem sabe a versão mínima
 * é o servidor (`features.desktop_min_version`), e a casca não fala com ele:
 * ela carrega o cliente por URL. A casca só sabe baixar e instalar.
 */

export type TelaDeAtualizacao = {
  /** O estado que a casca reportou por último. */
  readonly casca: Atualizacao;
  /** A tela cobre o app: a versão instalada está abaixo da exigida. */
  readonly bloqueada: boolean;
  /** A versão mínima que o servidor exige, quando exige. */
  readonly exigida: string | undefined;
  /** A instalação obrigatória foi pedida e ainda não terminou nem falhou. */
  readonly instalando: boolean;
  /**
   * A instalação falhou — pela casca (`falhou`) ou por falta de resposta.
   *
   * ⚠ **Falta de resposta conta**: casca antiga ignora o pedido obrigatório e
   * não emite nada. Sem este caso o botão giraria para sempre numa tela que
   * não deixa usar o app.
   */
  readonly falhou: boolean;
};

const INICIAL: Atualizacao = { estado: "em-dia", versao: undefined, progresso: 0 };

/** Quanto esperar a casca reagir a um pedido obrigatório antes de desistir. */
export const ESPERA_DA_CASCA_MS = 10_000;

/**
 * A decisão, pura: o que a tela mostra a partir do que a casca disse, do que
 * o servidor exige e do pedido em curso.
 */
export function montarTela(
  casca: Atualizacao,
  exigida: string | undefined,
  versaoInstalada: string | undefined,
  pedido: "nenhum" | "aguardando" | "sem-resposta",
  /**
   * A casca já disse `obrigatoria` alguma vez nesta ligação.
   *
   * ⚠ **O bloqueio TRAVA.** Pedir a instalação faz a casca seguir para
   * `verificando`, `baixando`, `falhou` — e se o bloqueio dependesse só do
   * estado atual, o primeiro clique em "Atualizar e reiniciar" destravaria o
   * app. Medido no arnês antes da trava: o bloqueio sumia e sobrava a faixa de
   * falha, com o app usável numa versão que o servidor recusa.
   */
  cascaExigiu = false,
): TelaDeAtualizacao {
  const abaixo =
    versaoInstalada !== undefined && versaoAbaixoDoMinimo(versaoInstalada, exigida);
  const bloqueada = abaixo || cascaExigiu || casca.estado === "obrigatoria";
  const falhou = casca.estado === "falhou" || pedido === "sem-resposta";
  return {
    casca,
    bloqueada,
    exigida: abaixo ? exigida : undefined,
    instalando: pedido === "aguardando" && !falhou,
    falhou,
  };
}

let casca: Atualizacao = INICIAL;
let exigida: string | undefined;
let pedido: "nenhum" | "aguardando" | "sem-resposta" = "nenhum";
let cascaExigiu = false;
let tela: TelaDeAtualizacao = montarTela(INICIAL, undefined, undefined, "nenhum");
let esperaDaCasca: ReturnType<typeof setTimeout> | undefined;

const ouvintes = new Set<() => void>();
let soltarPonte: (() => void) | undefined;
let soltarDesktop: (() => void) | undefined;
/* Cada ligação da casca tem um número; a resposta assíncrona da configuração
   de uma ligação anterior não pode escrever na atual. */
let geracao = 0;

function publicar(): void {
  tela = montarTela(casca, exigida, ponte()?.versao, pedido, cascaExigiu);
  for (const o of ouvintes) o();
}

function pararEspera(): void {
  if (esperaDaCasca !== undefined) clearTimeout(esperaDaCasca);
  esperaDaCasca = undefined;
}

function aoEstadoDaCasca(a: Atualizacao): void {
  casca = a;
  if (a.estado === "obrigatoria") cascaExigiu = true;
  /* Qualquer resposta prova que a casca ouviu; o fim do pedido é `falhou`
     (a tela oferece de novo) ou o reinício, que encerra este processo. */
  pararEspera();
  if (a.estado === "falhou") pedido = "nenhum";
  publicar();
}

function ligar(): void {
  const p = ponte();
  if (!lerDesktop().naCasca || !p) {
    desligarPonte();
    return;
  }
  if (soltarPonte) return;
  const minha = ++geracao;
  soltarPonte = p.assinarAtualizacao(aoEstadoDaCasca);
  void esperarConfiguracao().then(() => {
    if (minha !== geracao) return;
    exigida = versaoMinimaDoDesktop();
    publicar();
  });
}

function desligarPonte(): void {
  if (!soltarPonte) return;
  soltarPonte();
  soltarPonte = undefined;
  geracao++;
  pararEspera();
  casca = INICIAL;
  exigida = undefined;
  cascaExigiu = false;
  pedido = "nenhum";
  publicar();
}

export function assinarAtualizacao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  if (ouvintes.size === 1) {
    soltarDesktop = assinarDesktop(ligar);
    ligar();
  }
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size > 0) return;
    soltarDesktop?.();
    soltarDesktop = undefined;
    desligarPonte();
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerAtualizacao(): TelaDeAtualizacao {
  return tela;
}

/** "Reiniciar agora" da faixa, ou "Atualizar e reiniciar" do bloqueio. */
export function instalarAtualizacao(): void {
  const p = ponte();
  if (!p) return;
  if (!tela.bloqueada) {
    void p.instalarEReiniciar();
    return;
  }
  pedido = "aguardando";
  pararEspera();
  esperaDaCasca = setTimeout(() => {
    esperaDaCasca = undefined;
    if (pedido !== "aguardando") return;
    pedido = "sem-resposta";
    publicar();
  }, ESPERA_DA_CASCA_MS);
  publicar();
  void p.instalarEReiniciar({ obrigatoria: true });
}

/** "Tentar de novo" da faixa de falha e "Verificar" de Configurações. */
export function verificarAtualizacao(): void {
  if (tela.bloqueada) {
    instalarAtualizacao();
    return;
  }
  void ponte()?.verificarAtualizacao();
}

/**
 * "Baixar manualmente" — o instalador da plataforma no navegador do sistema.
 *
 * A casca já manda toda URL http(s) aberta pela janela ao navegador padrão,
 * então `window.open` é o caminho certo e não precisa de verbo de IPC.
 */
export function baixarManualmente(): void {
  const p = ponte();
  if (!p) return;
  window.open(linkDeDownload(p.plataforma), "_blank", "noopener,noreferrer");
}
