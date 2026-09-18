/**
 * Como a plataforma ESCREVE as teclas.
 *
 * ⚠ **Mostrar "Ctrl" a quem usa Mac ensina o atalho errado**, e quem tenta uma
 * vez e não funciona não tenta de novo. O custo de errar aqui é maior que o de
 * não mostrar nada — e o menu da mensagem mostrava `⇧⌘C` para todo mundo,
 * inclusive no Windows, onde a combinação é `Ctrl+Shift+C`.
 *
 * Isto existia escrito à mão em `canais/ListaDeCanais.tsx` (`TECLA_DA_PALETA`)
 * e em lugar nenhum mais; o menu, que tem quatro atalhos, não consultava nada.
 * Duas cópias da mesma pergunta divergem, e a que diverge é a que ninguém
 * abriu naquela semana.
 *
 * `navigator.platform` está deprecado e continua sendo o que funciona em todo
 * navegador; `userAgentData` ainda não é universal. Fora do render de
 * propósito: é constante da máquina, não estado.
 */
export const EH_MAC = /mac/i.test(navigator.platform);

/** O modificador principal: `⌘` no Mac, `Ctrl` no resto. */
export const MOD = EH_MAC ? "⌘" : "Ctrl";

/** `⇧` no Mac, `Shift` no resto — a mesma regra do modificador. */
export const SHIFT = EH_MAC ? "⇧" : "Shift";

/**
 * Um atalho escrito como a plataforma o chama.
 *
 * ⚠ **Sem separador no Mac e com `+` no resto**, porque é assim que os dois
 * sistemas escrevem: `⇧⌘C` contra `Ctrl+Shift+C`. Um formato só produziria
 * `⇧+⌘+C`, que não existe em lugar nenhum.
 */
export function atalho(partes: {
  readonly mod?: boolean;
  readonly shift?: boolean;
  readonly tecla: string;
}): string {
  const pedacos: string[] = [];
  /* A ORDEM difere: o Mac escreve ⇧ antes de ⌘, o Windows escreve Ctrl antes
     de Shift. Trocar uma pela outra é o tipo de detalhe que faz o atalho
     parecer escrito por quem não usa o sistema. */
  if (EH_MAC) {
    if (partes.shift) pedacos.push(SHIFT);
    if (partes.mod) pedacos.push(MOD);
  } else {
    if (partes.mod) pedacos.push(MOD);
    if (partes.shift) pedacos.push(SHIFT);
  }
  pedacos.push(partes.tecla);
  return EH_MAC ? pedacos.join("") : pedacos.join("+");
}
