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
 * Posso dar ou tirar ESTE cargo?
 *
 * O servidor recusa mexer em cargo do mesmo nível ou acima do meu mais alto
 * (`rank <= topo` → `NotElevated`). Menor rank é mais alto.
 */
export function cargoAoAlcance(rankDoCargo: number, alcance: Alcance): boolean {
  return alcance.podeAtribuir && rankDoCargo > alcance.topo;
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
