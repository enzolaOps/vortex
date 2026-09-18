import type { Alcance, PessoaParaCargo } from "../sdk/cargos";

/**
 * A lógica da aba "Gerenciar membros", fora do componente.
 *
 * Pura de propósito: a tela é quase só uma decisão sobre QUEM aparece e QUEM
 * pode ser marcado, e as duas decisões carregam regra do servidor
 * (`NotElevated`) que precisa de teste sem montar React nem dublar o SDK.
 */

/** Acima disto a lista para e pede para afinar a busca. */
export const TETO_DA_LISTA = 100;

/**
 * Minúsculas e sem acento.
 *
 * "joao" tem de achar "João": num servidor brasileiro metade dos nomes tem
 * acento, e quem digita rápido não os escreve. `NFD` separa a letra da marca,
 * e a faixa `̀-ͯ` é a das marcas combinantes.
 */
function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export type Filtro = {
  readonly roleId: string;
  /** `true` = quem TEM o cargo (a lista da aba); `false` = candidatos. */
  readonly comCargo: boolean;
  readonly termo: string;
  readonly limite?: number;
};

export type Filtrados = {
  readonly visiveis: readonly PessoaParaCargo[];
  /** Quantas casaram antes do teto — é o que o "mostrando X de Y" diz. */
  readonly total: number;
};

export function filtrarPessoas(
  pessoas: readonly PessoaParaCargo[],
  { roleId, comCargo, termo, limite = TETO_DA_LISTA }: Filtro,
): Filtrados {
  const q = normalizar(termo.trim());
  const casam = pessoas.filter((p) => {
    if (p.cargosIds.includes(roleId) !== comCargo) return false;
    if (q === "") return true;
    return (
      normalizar(p.nome).includes(q) ||
      normalizar(p.username).includes(q) ||
      /* Por ID também, como a página de Membros: é o que sobra a quem só tem o
         número de um relato — o nome pode já ter mudado. */
      p.id.toLowerCase().includes(q)
    );
  });
  /*
    Por nome, com colação pt-BR. A ordem de chegada do SDK é a de hidratação,
    que não diz nada a ninguém; e ordenar SÓ as que casaram mantém o custo
    proporcional ao que a tela mostra quando há busca.
  */
  casam.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { visiveis: casam.slice(0, limite), total: casam.length };
}

/**
 * O motivo, escrito uma vez.
 *
 * ⚠ **Uma string e não quatro cópias.** Ela aparece no `title` da linha de
 * cargo, no tri-state da matriz de permissões e nas falhas do lote — e a
 * primeira divergência entre elas seria a pessoa lendo dois motivos
 * diferentes para a mesma recusa.
 */
export const MOTIVO_HIERARQUIA = "Bloqueado — acima da sua hierarquia";

/**
 * Este cargo está no meu nível ou acima dele?
 *
 * ⚠ **A comparação de rank em UM lugar só.** O servidor recusa mexer em cargo
 * do mesmo nível ou acima do meu mais alto (`rank <= topo` → `NotElevated`,
 * em `roles_edit.rs`, `permissions_set.rs` e `roles_edit_positions.rs`), e
 * menor rank é mais alto. Cada chamador acrescenta a PERMISSÃO que lhe cabe —
 * `AssignRoles` para dar cargo, `ManageRole` para mover, `ManagePermissions`
 * para a matriz —, mas a hierarquia é a mesma regra para os três.
 */
export function acimaDaMinhaHierarquia(
  rankDoCargo: number,
  alcance: Alcance,
): boolean {
  return rankDoCargo <= alcance.topo;
}

/**
 * Posso dar ou tirar ESTE cargo?
 */
export function cargoAoAlcance(rankDoCargo: number, alcance: Alcance): boolean {
  return alcance.podeAtribuir && !acimaDaMinhaHierarquia(rankDoCargo, alcance);
}

/**
 * Posso MOVER ou EDITAR este cargo?
 *
 * ⚠ **`ManageRole` e não `AssignRoles`, e a distinção não é cosmética.** Dar
 * um cargo a alguém e editar o cargo em si são permissões diferentes no
 * protocolo; usar `cargoAoAlcance` aqui travaria a hierarquia para quem tem
 * `ManageRole` sem `AssignRoles` — que é o moderador que só mexe na estrutura.
 */
export function cargoMovivel(rankDoCargo: number, alcance: Alcance): boolean {
  return alcance.podeEditarCargos && !acimaDaMinhaHierarquia(rankDoCargo, alcance);
}

/**
 * Esta reordenação é aceitável para o servidor?
 *
 * ⚠ **Espelha `roles_edit_positions.rs` em vez de aproximar.** O servidor não
 * pergunta "o cargo movido está abaixo de mim"; ele exige que **nenhum** cargo
 * com `rank <= topo` MUDE DE POSIÇÃO — e com boa razão: descer um cargo meu
 * uma casa promove o de cima, que pode estar acima de mim. Uma regra só sobre
 * o movido deixaria passar exatamente a reordenação que o servidor recusa,
 * então a tela reordenaria de forma otimista e o servidor devolveria
 * `NotElevated` depois.
 *
 * As duas listas são a hierarquia COMPLETA, do mais alto para o mais baixo —
 * é o que a rota recebe.
 */
export function reordenacaoPermitida(
  antes: readonly { readonly id: string; readonly rank: number }[],
  depois: readonly string[],
  alcance: Alcance,
): boolean {
  if (!alcance.podeEditarCargos) return false;
  for (let i = 0; i < antes.length; i++) {
    const c = antes[i];
    if (!c) continue;
    if (!acimaDaMinhaHierarquia(c.rank, alcance)) continue;
    if (depois.indexOf(c.id) !== i) return false;
  }
  return true;
}

/**
 * Esta pessoa pode ser marcada para o lote?
 *
 * ⚠ **Travar e não esconder.** Quem está acima de mim continua na lista de
 * quem tem o cargo — sumir faria parecer que ela não o tem. O que muda é a
 * caixa: desabilitada, com o motivo no título.
 */
export function marcavel(pessoa: PessoaParaCargo, rankDoCargo: number, alcance: Alcance): boolean {
  return cargoAoAlcance(rankDoCargo, alcance) && pessoa.editavel;
}

/**
 * Tira da seleção quem deixou de estar visível ou marcável.
 *
 * Sem isto, marcar três, buscar outra coisa e apertar "Remover" removeria as
 * três que já não estão na tela — uma ação sobre gente que a pessoa não vê.
 */
export function selecaoValida(
  selecao: ReadonlySet<string>,
  visiveis: readonly PessoaParaCargo[],
  rankDoCargo: number,
  alcance: Alcance,
): string[] {
  return visiveis
    .filter((p) => selecao.has(p.id) && marcavel(p, rankDoCargo, alcance))
    .map((p) => p.id);
}

/**
 * Divide uma seleção de membros para "Atribuir cargo" em lote.
 *
 * A barra da página de Membros não mostra caixa travada — quem seleciona ali
 * seleciona pessoas, não candidatos a um cargo que ainda nem foi escolhido.
 * Então a trava de hierarquia age DEPOIS da escolha: quem está acima de mim
 * (ou saiu do cache) não gera chamada nenhuma — o servidor recusaria com
 * `NotElevated` — e volta como falha com o motivo escrito, junto das falhas de
 * rede, para ficar marcado igual a elas.
 *
 * A ordem é a da SELEÇÃO, como em `executarEmLote`: a lista de falhas vira
 * linhas na tela e não deve embaralhar entre tentativas.
 */
export function separarParaCargo(
  selecao: readonly string[],
  pessoas: readonly PessoaParaCargo[],
  rankDoCargo: number,
  alcance: Alcance,
): {
  editaveis: string[];
  barradas: { item: string; motivo: string }[];
} {
  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const editaveis: string[] = [];
  const barradas: { item: string; motivo: string }[] = [];
  for (const id of selecao) {
    const p = porId.get(id);
    if (!p) barradas.push({ item: id, motivo: "Essa pessoa não está mais no servidor." });
    /* A frase aqui é de FALHA DE LOTE e não o rótulo do controle travado —
       `MOTIVO_HIERARQUIA` é o do controle, e juntar os dois daria uma lista de
       falhas escrita em travessão. */
    else if (!marcavel(p, rankDoCargo, alcance))
      barradas.push({ item: id, motivo: "Acima da sua hierarquia." });
    else editaveis.push(id);
  }
  return { editaveis, barradas };
}
