import { members, usuarioLocalId } from "nucleo/sdk/adapter";
import { chaveDeMembro } from "nucleo/sdk/domain";
import { useTyping } from "nucleo/store/hooks";

import { chat } from "../../textos";
import { Digitando } from "../../ui/ds";

/**
 * Quem está digitando neste canal. Assina o store EFÊMERO de digitação (com
 * throttle na fronteira do núcleo), então só este componente acorda a cada
 * mudança — nunca a lista de mensagens. A região fica sempre montada: leitor de
 * tela só anuncia mudança numa região que já existia.
 *
 * Os nomes são lidos do store de membros no render: nome muda raramente e este
 * componente re-renderiza a cada mudança de quem digita, então a leitura direta
 * basta e evita um gancho por pessoa.
 */
export function DigitandoDoCanal({ canalId, servidorId }: { canalId: string; servidorId: string }) {
  const quem = useTyping(canalId);
  const eu = usuarioLocalId();
  const nomes = quem
    .filter((id) => id !== eu)
    .map((id) => members.peek(chaveDeMembro(servidorId, id))?.displayName ?? chat.autorDesconhecido);
  return <Digitando nomes={nomes} />;
}
