import { entrarNaChamada, sairDaChamada } from "nucleo/sdk/chamada";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
import { lerChamada } from "nucleo/store/chamada";
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

/**
 * Clicar numa sala de voz: entra nela. Na sala em que a pessoa já está, só abre
 * o palco; em outra, `entrarNaChamada` sai da atual antes de conectar à nova.
 */
export async function abrirSala(canalId: string): Promise<boolean> {
  const c = lerChamada();
  if (c.estado !== "fora" && c.channelId === canalId) {
    definirPalco({ tipo: "grade" });
    return true;
  }
  return entrarComPalco(canalId);
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
