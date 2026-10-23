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
 * Ligar na conversa. O primeiro clique entra e a conversa fica na tela — o
 * mesmo contrato de `abrirSala`. O segundo clique, já nesta chamada, abre o
 * palco. Câmera só liga depois de dentro, e também nesse segundo clique em
 * "Vídeo".
 */
export async function ligarNaConversa(canalId: string, comCamera: boolean): Promise<boolean> {
  const c = lerChamada();
  if (c.estado !== "fora" && c.channelId === canalId) {
    definirPalco({ tipo: "grade" });
    if (comCamera && c.estado === "dentro" && !c.camera) await alternarCamera();
    return true;
  }
  const entrou = await ligar(canalId);
  if (entrou && comCamera) {
    const depois = lerChamada();
    if (depois.estado === "dentro" && !depois.camera) await alternarCamera();
  }
  return entrou;
}
