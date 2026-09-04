import { useSyncExternalStore } from "react";

import { copiarTexto } from "../../lib/copiar";
import { assinarDev, modoDev } from "../../store/dev";
import { ContextMenuItem } from "./ContextMenu";
import { DropdownMenuItem } from "./DropdownMenu";
import { menuItemId } from "./menu";

/**
 * "Copiar ID" — o item que o modo desenvolvedor acrescenta.
 *
 * ⚠ **Com o modo desligado ele NÃO EXISTE, e não fica desabilitado.** É a
 * instrução do design, e é a mesma regra que já vale para os itens de
 * moderação da member list: item cinza ensina que a ação existe e que você não
 * a tem, ruído permanente para quem nunca vai usá-la. Aqui é ainda mais claro
 * — quem não ligou o modo não quer saber que ele existe.
 *
 * Sempre o ÚLTIMO do menu, em mono e terciário: ele é ferramenta de quem
 * depura, não ação de quem conversa, e o design o separa pelo PESO em vez de
 * por régua — uma régua a mais sugeriria um bloco de ações.
 *
 * ⚠ Assina `modoDev()` e não o snapshot: o predicado é um booleano, então
 * trocar o overlay de depuração não re-renderiza os menus. Como este
 * componente aparece em SEIS menus de contexto, e um deles é montado por linha
 * de canal, a diferença não é acadêmica.
 */
export function ItemDeId({
  id,
  /**
   * Em qual família de menu ele está.
   *
   * ⚠ Os dois primitivos do Radix NÃO são intercambiáveis: `ContextMenuItem`
   * fora de um `ContextMenu.Root` lança em runtime, e o mesmo vale ao
   * contrário. Uma prop é mais honesta que um componente que "descobre" onde
   * está — descobrir exigiria contexto que o Radix não expõe.
   */
  em = "contexto",
}: {
  id: string;
  em?: "contexto" | "dropdown";
}) {
  const ligado = useSyncExternalStore(assinarDev, modoDev);
  if (!ligado) return null;

  const props = {
    className: menuItemId,
    onSelect: () => void copiarTexto(id, "ID"),
    children: "Copiar ID",
  };

  return em === "dropdown" ? (
    <DropdownMenuItem {...props} />
  ) : (
    <ContextMenuItem {...props} />
  );
}
