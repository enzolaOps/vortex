import { slotDe, alternarPainel } from "./layout";
import type { PainelId } from "../preset/schema";

/**
 * O painel que está FLUTUANDO, quando há um.
 *
 * ⚠ **Existe porque o design manda os dois painéis novos flutuarem, e porque a
 * alternativa fazia um evict que ninguém pediu.** Medido antes: abrir a caixa
 * de entrada pelo cabeçalho trocava o ocupante do slot da ponta — a lista de
 * membros SUMIA, sem aviso, e voltar exigia abrir o modo edição. O shell tem
 * três slots e o produto tem nove painéis; roubar o slot é o que acontece
 * quando "abrir" e "ancorar" são a mesma operação.
 *
 * O design separa as duas em uma frase: *"Fixadas e caixa de entrada são o
 * mesmo drawer lateral (400–420) que, em ultrawide, pode ficar ancorado como
 * painel 2 em vez de flutuar."* Ou seja: FLUTUAR é o padrão, ANCORAR é a
 * escolha de quem arruma o layout.
 *
 * Store module-level e não Context, pela lei nº 1: quem abre é um botão do
 * cabeçalho e quem fecha é `Esc`, e nenhum dos dois está numa árvore que o
 * `Cliente` controle.
 */

type Ouvinte = () => void;

let aberto: PainelId | null = null;
const ouvintes = new Set<Ouvinte>();

export function assinarDrawer(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: uma string ou `null`, comparadas por valor. */
export function lerDrawer(): PainelId | null {
  return aberto;
}

function definir(novo: PainelId | null): void {
  if (aberto === novo) return;
  aberto = novo;
  for (const ouvinte of ouvintes) ouvinte();
}

export function fecharDrawer(): void {
  definir(null);
}

/**
 * Abre ou fecha um painel, decidindo ONDE pela configuração atual.
 *
 * É a função que o cabeçalho chama, e ela resolve o conflito nº 3 sem gastar
 * um slot:
 *
 * 1. **Painel ANCORADO** (alguém o pôs num slot no modo edição) → o botão
 *    mostra e esconde aquele slot, como sempre fez. Quem arrumou o layout
 *    decidiu que ele mora ali, e um botão que o arrancasse de lá desfaria a
 *    escolha em silêncio.
 * 2. **Painel sem slot** → flutua. Nada é evictado, e fechar não muda o
 *    layout de ninguém.
 *
 * Um drawer de cada vez, pela mesma razão do registro de modais: dois painéis
 * flutuantes empilhados na mesma borda é a tela onde `Esc` fecha um e ninguém
 * sabe qual.
 */
/**
 * Canais some abaixo de 640px e membros abaixo de 1000px — o CSS é o
 * GUARDA, não o store. Flutuar em vez de `alternarPainel` é o que impede o
 * clique de esconder o slot de verdade e devolver uma coluna morta quando a
 * janela alarga de novo.
 */
function escondidoPeloGuarda(painel: PainelId): boolean {
  if (typeof matchMedia !== "function") return false;
  if (painel === "membros") return matchMedia("(width < 1000px)").matches;
  if (painel === "canais") return matchMedia("(width < 640px)").matches;
  return false;
}

export function alternarSuperficie(painel: PainelId): void {
  if (slotDe(painel) !== undefined && !escondidoPeloGuarda(painel)) {
    alternarPainel(painel);
    return;
  }
  definir(aberto === painel ? null : painel);
}

/** Está aberto — ancorado OU flutuando. É o que o `aria-pressed` diz. */
export function superficieAberta(painel: PainelId, visivelNoSlot: boolean): boolean {
  if (escondidoPeloGuarda(painel)) return aberto === painel;
  return slotDe(painel) !== undefined ? visivelNoSlot : aberto === painel;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparDrawer(): void {
  aberto = null;
}
