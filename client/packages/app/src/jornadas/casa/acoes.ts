import { abrirConversaCom } from "nucleo/sdk/social";
import { alternarCamera, ligar } from "nucleo/sdk/chamada";
import { lerChamada } from "nucleo/store/chamada";
import { abrirConversa } from "nucleo/store/navegacao";
import { definirPalco } from "nucleo/store/palcoDeVoz";

/** "Mensagem": abre (ou reabre) a DM com a pessoa e leva a pessoa até ela. */
export async function conversarCom(userId: string): Promise<boolean> {
  const canalId = await abrirConversaCom(userId);
  if (canalId === undefined) return false;
  abrirConversa(canalId);
  return true;
}

/**
 * Ligar na conversa: o palco abre na hora, antes da rede, para o "conectando"
 * ter onde aparecer (a mesma regra de `entrarComPalco` nos servidores). Câmera
 * só liga depois de dentro — é uma escolha de quem clicou em "Vídeo".
 */
export async function ligarNaConversa(canalId: string, comCamera: boolean): Promise<boolean> {
  definirPalco({ tipo: "grade" });
  const entrou = await ligar(canalId);
  if (entrou && comCamera) {
    const c = lerChamada();
    if (c.estado === "dentro" && !c.camera) await alternarCamera();
  }
  return entrou;
}
