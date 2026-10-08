import { entrarNaChamada, sairDaChamada } from "nucleo/sdk/chamada";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
import { lerChamada } from "nucleo/store/chamada";
import { limparFalhaDeVoz } from "nucleo/store/falhaDeVoz";

/**
 * Entrar com o palco já pedido — o botão "Tentar de novo" e o "Entrar" de
 * quem já está olhando o palco. O clique na coluna NÃO passa por aqui.
 */
export async function entrarComPalco(canalId: string): Promise<boolean> {
  definirPalco({ tipo: "grade" });
  return entrarNaChamada(canalId);
}

/**
 * Clicar numa sala: entra, sem abrir o palco.
 *
 * O segundo clique na sala em que a pessoa já está é que abre o palco. Trocar
 * de sala fecha o palco da anterior — foco no meio é um segundo gesto, não um
 * efeito colateral de entrar.
 */
export async function abrirSala(canalId: string): Promise<boolean> {
  const c = lerChamada();
  if (c.estado !== "fora" && c.channelId === canalId) {
    definirPalco({ tipo: "grade" });
    return true;
  }
  fecharPalco();
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
