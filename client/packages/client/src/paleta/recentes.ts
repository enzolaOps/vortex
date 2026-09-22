/**
 * Os lugares por onde a paleta passou.
 *
 * ⚠ **Existe porque a paleta abria com a LISTA INTEIRA do índice**, ordenada
 * por servidores → canais → pessoas. O design manda o contrário: *"vazio sem
 * filtro = Visitados recentemente"* — e a razão é que uma paleta que abre no
 * primeiro servidor da conta obriga a digitar mesmo quando se quer o lugar de
 * sempre, que é o caso mais frequente de todos.
 *
 * ⚠ **Guarda `{tipo, id}` e não a entrada inteira.** Nome de canal muda, canal
 * é apagado, pessoa troca de apelido — um retrato guardado mostraria o nome
 * velho, ou um canal que não existe mais. A resolução acontece na abertura,
 * contra o índice recém-montado, e o que não resolve some sozinho.
 *
 * Module-level e persistido em `localStorage`, como `pastas.ts` e
 * `colapso.ts`: é preferência de leitura desta máquina, não dado de servidor.
 * ⚠ **Não vai no preset** — a lista carrega IDs de canal e de pessoa, que é
 * exatamente a família de dado que o schema foi desenhado para tornar
 * irrepresentável.
 */
import type { TipoDeEntrada } from "./indice";

export type Visitado = {
  readonly tipo: TipoDeEntrada;
  readonly id: string;
};

const CHAVE = "vortex:paleta:recentes";

/**
 * Oito, e o número tem razão: o painel mostra ~6 linhas sem rolar, e uma lista
 * de recentes que exige rolagem deixa de ser atalho. Dois a mais que o visível
 * cobrem o que saiu de vista sem fazer a pessoa rolar para o caso comum.
 */
const TETO = 8;

let lista: readonly Visitado[] = ler();

function ler(): readonly Visitado[] {
  /*
    `try/catch` em TODO acesso, como `store/sessao.ts`: em janela privada, com
    dados do site bloqueados ou dentro de um iframe de origem opaca, tanto a
    leitura quanto a escrita LANÇAM. Uma paleta que não abre por causa de uma
    lista de recentes seria o pior desfecho possível daqui.
  */
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(cru)) return [];
    return cru.flatMap((v: unknown) => {
      if (typeof v !== "object" || v === null) return [];
      const o = v as { tipo?: unknown; id?: unknown };
      if (typeof o.tipo !== "string" || typeof o.id !== "string") return [];
      return [{ tipo: o.tipo as TipoDeEntrada, id: o.id }];
    });
  } catch {
    return [];
  }
}

export function lerRecentes(): readonly Visitado[] {
  return lista;
}

/**
 * Registra uma visita — a mais nova primeiro, sem repetir.
 *
 * ⚠ **Ação NÃO entra.** "Marcar canal como lido" não é um lugar por onde se
 * passou, e uma lista de recentes cheia de comandos deixaria de responder a
 * pergunta que ela existe para responder ("onde eu estava?").
 */
export function visitar(tipo: TipoDeEntrada, id: string): void {
  if (tipo === "acao") return;
  lista = [{ tipo, id }, ...lista.filter((v) => v.id !== id)].slice(0, TETO);
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  } catch {
    /* Sem persistência a lista ainda vale nesta sessão — é o degrau honesto. */
  }
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparRecentes(): void {
  lista = [];
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}
