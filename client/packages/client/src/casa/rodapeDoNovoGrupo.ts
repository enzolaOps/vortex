/**
 * O que o rodapé do "Novo grupo" diz e faz, em função de quantas pessoas
 * foram escolhidas — D-DMN-05 e D-DMN-06.
 *
 * Função pura e não condicional no JSX: são TRÊS estados para a dica e TRÊS
 * para o botão, e o de uma pessoa só é o que muda o que o botão FAZ (abre a
 * DM em vez de criar um grupo). Um grupo de duas pessoas é uma DM com um nome
 * e um dono a mais — criá-lo em vez de abrir a conversa que já existe entre
 * as duas deixa duas conversas com a mesma pessoa na coluna.
 */

/**
 * O teto do protocolo.
 *
 * ⚠ **Dez INCLUINDO você**, e é por isso que a conta na tela soma um. O Revolt
 * recusa o 11º recipiente com 400, e descobrir isso depois de escolher dez
 * pessoas é o pior momento — a tela conta para frente e trava antes.
 */
export const TETO = 10;

/** O que o botão primário faz com esta seleção. */
export type AcaoDoNovoGrupo = "nenhuma" | "abrirDm" | "criarGrupo";

export function acaoDoNovoGrupo(escolhidos: number): AcaoDoNovoGrupo {
  if (escolhidos <= 0) return "nenhuma";
  return escolhidos === 1 ? "abrirDm" : "criarGrupo";
}

/** A dica à esquerda do botão. Conta VOCÊ, como o contador do topo. */
export function dicaDoNovoGrupo(escolhidos: number): string {
  if (escolhidos <= 0) return "Escolha pelo menos uma pessoa";
  const restantes = TETO - escolhidos - 1;
  if (restantes <= 0) return `Limite de ${String(TETO)} alcançado`;
  return restantes === 1
    ? "1 vaga restante"
    : `${String(restantes)} vagas restantes`;
}
