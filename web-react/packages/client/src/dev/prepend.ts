import { carregarHistorico } from "./firehose";

/**
 * Mede se a âncora sobrevive ao prepend de histórico.
 *
 * É a única propriedade da lista que NÃO se testa em vitest: jsdom não tem
 * engine de layout, então `scrollHeight` e `getBoundingClientRect` voltam zero
 * e um virtualizador ali mede o nada. Precisa de navegador de verdade — por
 * isso vive no arnês, ao lado do firehose, e não em `*.test.ts`.
 *
 * A propriedade: carregar mensagens antigas aumenta o total ACIMA do viewport.
 * Se nada compensar, o que a pessoa está lendo desce e ela perde o lugar. Quem
 * compensa é o TanStack — ao ver as chaves de borda mudarem, guarda a chave sob
 * o scroll e o offset relativo, e depois de remedir devolve o scroll ao mesmo
 * ponto daquele item. É a razão de `getItemKey` ter que ser ID de entidade:
 * com índice, a chave sob o viewport muda de significado a cada prepend.
 */

export type ResultadoPrepend = {
  ok: boolean;
  motivo?: string;
  /** Quanto a mensagem de referência andou na tela. Zero é o alvo. */
  deslocamentoVisual: number;
  crescimentoDoTotal: number;
  deslocamentoDoScroll: number;
  ancora: string;
};

const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export async function medirPrepend(quantas = 50): Promise<ResultadoPrepend> {
  const el = document.querySelector<HTMLElement>('div[role="log"]');
  const vazio: ResultadoPrepend = {
    ok: false,
    deslocamentoVisual: 0,
    crescimentoDoTotal: 0,
    deslocamentoDoScroll: 0,
    ancora: "",
  };

  if (!el) return { ...vazio, motivo: "lista não montada" };

  if (document.hidden) {
    // `publish` agenda por rAF, que não dispara em aba oculta. Medir aqui
    // devolveria "nada mudou" e pareceria bug do prepend — foi exatamente o
    // diagnóstico errado que a corrida do firehose já produziu uma vez.
    return { ...vazio, motivo: "aba oculta: rAF não dispara, medição inválida" };
  }

  const topoDoViewport = el.getBoundingClientRect().top;

  // Precisa estar no MEIO do histórico: no fim, prepend não desloca nada e o
  // teste passaria sem testar.
  if (el.scrollTop < el.clientHeight) {
    return { ...vazio, motivo: "role para o meio da lista antes de medir" };
  }

  const nos = [...document.querySelectorAll<HTMLElement>("[data-mid]")];
  const ancora = nos.find(
    (n) => n.getBoundingClientRect().bottom > topoDoViewport + 2,
  );
  if (!ancora?.dataset.mid) {
    return { ...vazio, motivo: "nenhuma linha sob o topo do viewport" };
  }

  const mid = ancora.dataset.mid;
  const offsetAntes = ancora.getBoundingClientRect().top - topoDoViewport;
  const totalAntes = el.scrollHeight;
  const scrollAntes = el.scrollTop;

  carregarHistorico(quantas);

  // Dois quadros: um para o publish coalescido drenar, outro para o
  // virtualizador remedir e reancorar.
  await quadro();
  await quadro();

  const depois = document.querySelector<HTMLElement>(`[data-mid="${mid}"]`);
  if (!depois) {
    return {
      ...vazio,
      ancora: mid,
      motivo: "a linha de referência saiu da janela — a âncora não segurou",
    };
  }

  const deslocamentoVisual = Math.round(
    depois.getBoundingClientRect().top - topoDoViewport - offsetAntes,
  );

  return {
    // Um frame de tolerância: a remedição pode arredondar sub-pixel. Acima
    // disso é salto perceptível, que é o que se está caçando.
    ok: Math.abs(deslocamentoVisual) <= 2,
    deslocamentoVisual,
    crescimentoDoTotal: Math.round(el.scrollHeight - totalAntes),
    deslocamentoDoScroll: Math.round(el.scrollTop - scrollAntes),
    ancora: mid,
  };
}
