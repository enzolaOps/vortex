import { ligarRota } from "nucleo/rota/rota";
import { ligarLogoutDoServidor, restaurarSessao, sair } from "nucleo/sdk/autenticacao";
import { ligarAtalhosDeVoz } from "nucleo/sdk/atalhosDeVoz";
import { ligarSonsDeVoz } from "nucleo/som/sons";

/**
 * Sair é de DUAS origens e elas se separam aqui: a pessoa que clica em "Sair" e o
 * servidor que derruba a sessão (token revogado, senha trocada). O portão precisa
 * saber qual foi para não recarregar a página duas vezes.
 */
let encerrando = false;

export function estaEncerrando(): boolean {
  return encerrando;
}

export function recarregarPagina(): void {
  location.reload();
}

/**
 * Sai da conta: apaga a sessão local primeiro (mesmo sem rede), avisa o servidor
 * para revogá-la e RECARREGA a página.
 *
 * Recarregar é o que garante "sair limpa tudo": os stores do app são de módulo, e o
 * SDK arranca todos os ouvintes ao sair, então reentrar na mesma página mostraria
 * dados da conta anterior e um app sem ouvinte nenhum. A recarga só acontece
 * DEPOIS de o pedido ao servidor terminar, senão ela cancelaria a revogação.
 */
export async function encerrarSessao(recarregar: () => void = recarregarPagina): Promise<void> {
  encerrando = true;
  try {
    await sair();
  } finally {
    recarregar();
  }
}

/** Só para teste: volta ao estado de página recém-aberta. */
export function reiniciarEncerramento(): void {
  encerrando = false;
}

/**
 * O que acontece uma vez, quando a página abre: ouvir o servidor derrubar a sessão
 * e tentar voltar com a guardada. A ORDEM importa: o ouvinte vem antes, porque a
 * restauração abre o socket e um token revogado é recusado nessa abertura.
 *
 * Também liga o que vive o tanto que a página vive e não pertence a componente
 * nenhum, porque assina stores e o teclado: o endereço (as configurações são rota),
 * os atalhos de voz (push-to-talk, mutar, ensurdecer) e os sons de entrada e saída
 * das salas. Todos idempotentes.
 */
export function iniciarSessao(): void {
  ligarRota();
  ligarAtalhosDeVoz();
  ligarSonsDeVoz();
  ligarLogoutDoServidor();
  void restaurarSessao();
}
