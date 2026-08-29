/**
 * A densidade da timeline — confortável ou compacta.
 *
 * ⚠ **Compacto NÃO é o confortável com padding menor, e o design diz isso em
 * letras:** *"muda a estrutura (sem avatar, coluna de hora em mono, sem
 * agrupamento por autor)"*. Confundir os dois produz a versão preguiçosa que
 * todo cliente de chat já tentou — a que aperta o espaçamento e continua
 * gastando 40px de calha para não mostrar nada.
 *
 * **Preferência LOCAL, como `colapso.ts` e `silencio.ts`.** Não vai no preset:
 * o preset carrega a SEMENTE de tema e a posição dos slots, e densidade é
 * escolha de leitura de quem está lendo — quem recebe um preset compartilhado
 * não quer herdar a acuidade visual de outra pessoa.
 *
 * ⚠ **É APRESENTAÇÃO, e por isso não encosta no adapter.** O agrupamento por
 * autor continua sendo calculado na escrita (`sdk/agrupamento.ts`), e o modo
 * compacto simplesmente IGNORA `iniciaGrupo` na hora de desenhar. Fazer o
 * adapter agrupar diferente por densidade colocaria uma decisão de vista
 * dentro do store — e, pior, faria trocar de densidade republicar dez mil
 * snapshots em vez de re-renderizar as ~50 linhas visíveis.
 */

const CHAVE = "vortex:densidade";

export type Densidade = "confortavel" | "compacto";

type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();

function ler(): Densidade {
  try {
    // União fechada conferida na LEITURA: `localStorage` é editável por quem
    // usa o app, e um valor inventado não pode virar uma densidade que a
    // interface não sabe desenhar. Qualquer coisa fora da união vira o padrão.
    return localStorage.getItem(CHAVE) === "compacto" ? "compacto" : "confortavel";
  } catch {
    return "confortavel";
  }
}

/** Referência cacheada — armadilha nº 1. */
let densidade: Densidade = ler();

export function assinarDensidade(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerDensidade(): Densidade {
  return densidade;
}

export function definirDensidade(nova: Densidade): void {
  if (nova === densidade) return;
  densidade = nova;
  try {
    localStorage.setItem(CHAVE, nova);
  } catch {
    // Armazenamento bloqueado não derruba a sessão viva: a escolha vale nesta
    // aba e o que se perde é a memória entre aberturas. Mesma decisão de
    // `pastas.ts`.
  }
  for (const ouvinte of ouvintes) ouvinte();
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparDensidade(): void {
  densidade = "confortavel";
}
