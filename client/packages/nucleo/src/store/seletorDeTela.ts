import { abrirModal, fecharModal } from "./modais";
import type { Resolucao, Taxa } from "../sdk/seletorDeTela";

/**
 * O pedido de escolha de tela, em voo.
 *
 * ⚠ **Store com PROMESSA, e é o único do projeto assim.** Os outros modais são
 * disparados por um clique e terminam ali; este é perguntado pelo motor de voz,
 * que precisa da resposta para continuar — sem ela não há o que passar ao
 * `getDisplayMedia`. O `resolver` guardado é o que transforma um modal numa
 * pergunta.
 *
 * ⚠ **A promessa resolve SEMPRE, com `undefined` no cancelamento.** Rejeitar
 * obrigaria o chamador a um `try/catch` para um caminho que não é erro —
 * desistir de compartilhar é uso normal. É a mesma escolha de `enviarMensagem`
 * devolvendo `undefined` em vez de lançar.
 */
export type EscolhaDeTela = {
  /**
   * A fonte escolhida no painel da casca.
   *
   * ⚠ **`undefined` no modo `sistema`, e não é ausência de escolha.** Ali quem
   * lista telas, janelas e abas é o `getDisplayMedia` — nenhuma página enxerga
   * as fontes antes de o sistema entregá-las. O painel do Vortex decide o que é
   * do app (áudio e qualidade), e a fonte vem depois, da superfície do sistema.
   */
  readonly fonteId: string | undefined;
  readonly audio: boolean;
  readonly resolucao: Resolucao;
  readonly taxa: Taxa;
};

/**
 * Quem lista as fontes.
 *
 * - `casca`: o `desktopCapturer` da casca enumera, e o painel mostra miniaturas.
 * - `sistema`: navegador, ou casca onde o sistema desenha o próprio seletor
 *   (Wayland, macOS recente). O painel abre SEM fontes e "Transmitir" chama o
 *   `getDisplayMedia`, que é quem mostra a lista.
 */
export type ModoDoSeletor = "casca" | "sistema";

/**
 * Em que ponto o pedido está.
 *
 * ⚠ **`iniciando` existe porque o modal NÃO fecha no clique.** Entre o clique
 * em "Transmitir" e a faixa publicada há captura, codec e publicação — e,
 * na web, a superfície do sistema inteira. Fechar no clique fazia o painel
 * sumir e nada acontecer por um segundo; se falhasse, a pessoa via um toast
 * sobre uma janela que já não existia. Quem fecha agora é o motor, com
 * `concluirEscolhaDeTela`, quando a transmissão está no ar ou falhou.
 */
export type FaseDoSeletor = "fechado" | "escolhendo" | "iniciando";

export type EstadoDoSeletor = {
  readonly fase: FaseDoSeletor;
  readonly modo: ModoDoSeletor;
};

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

const FECHADO: EstadoDoSeletor = { fase: "fechado", modo: "sistema" };

/** Referência cacheada — armadilha nº 1. */
let estado: EstadoDoSeletor = FECHADO;
let resolver: ((e: EscolhaDeTela | undefined) => void) | undefined;

export function assinarSeletorDeTela(o: Ouvinte): () => void {
  ouvintes.add(o);
  return () => ouvintes.delete(o);
}

export function lerSeletorDeTela(): EstadoDoSeletor {
  return estado;
}

function publicar(proximo: EstadoDoSeletor): void {
  if (proximo.fase === estado.fase && proximo.modo === estado.modo) return;
  estado = proximo;
  for (const o of ouvintes) o();
}

/**
 * Abre o seletor e espera a escolha.
 *
 * ⚠ **Um pedido por vez.** Se já houver um em voo — escolhendo OU iniciando —,
 * o novo é recusado na hora em vez de enfileirado: dois seletores abertos
 * disputariam o mesmo `getDisplayMedia`, e o segundo a responder armaria uma
 * fonte que o primeiro pedido já teria consumido.
 */
export function pedirEscolhaDeTela(
  modo: ModoDoSeletor,
): Promise<EscolhaDeTela | undefined> {
  if (estado.fase !== "fechado") return Promise.resolve(undefined);

  publicar({ fase: "escolhendo", modo });
  abrirModal("tela");

  return new Promise((r) => {
    resolver = r;
  });
}

/**
 * Responde o pedido em voo.
 *
 * `undefined` = cancelou, e o modal fecha. Fechar por `Esc` ou pelo véu passa
 * por aqui com `undefined`, e é o que garante que o motor não fique esperando
 * para sempre por uma resposta que ninguém vai dar.
 *
 * Com uma escolha, o modal FICA — em `iniciando` — até o motor concluir.
 */
export function responderEscolhaDeTela(e: EscolhaDeTela | undefined): void {
  const r = resolver;
  if (!r) return;
  resolver = undefined;

  if (e === undefined) {
    fechar();
    r(undefined);
    return;
  }
  publicar({ fase: "iniciando", modo: estado.modo });
  r(e);
}

/**
 * O motor terminou: a faixa está no ar, ou a tentativa falhou.
 *
 * Idempotente de propósito — o motor chama no `finally`, inclusive nos
 * caminhos em que a pessoa já cancelou e o modal já fechou.
 */
export function concluirEscolhaDeTela(): void {
  if (resolver) return;
  if (estado.fase === "fechado") return;
  fechar();
}

function fechar(): void {
  publicar({ fase: "fechado", modo: estado.modo });
  fecharModal();
}
