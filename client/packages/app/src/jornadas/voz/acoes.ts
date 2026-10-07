import { entrarNaChamada, sairDaChamada } from "nucleo/sdk/chamada";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
import { limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";

/**
 * Entrar numa sala a partir da interface: o palco abre NA HORA, antes da rede.
 *
 * É o que dá ao "conectando" um lugar para aparecer (PRD 4.3: "o palco abre e a
 * voz conecta") — esperar a conexão para abrir o palco deixaria a pessoa olhando
 * o chat sem saber se o clique pegou.
 *
 * Quando a entrada falha, o palco continua aberto: é nele que a falha e o
 * "Tentar de novo" aparecem.
 */
export async function entrarComPalco(canalId: string): Promise<boolean> {
  definirPalco({ tipo: "grade" });
  return entrarNaChamada(canalId);
}

/** Sair da sala. O palco fica aberto no estado "você não está na sala". */
export async function sairDaSala(): Promise<void> {
  limparFalhaDeVoz();
  await sairDaChamada();
}

/** Dispensar a falha e voltar a ler: fecha o palco. */
export function voltarDoPalco(): void {
  limparFalhaDeVoz();
  fecharPalco();
}
