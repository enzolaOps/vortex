import { carregarHistorico } from "./firehose";

/**
 * Mede se a âncora sobrevive ao prepend de histórico, em duas fases.
 *
 * É a única propriedade da lista que NÃO se testa em vitest: jsdom não tem
 * engine de layout, então `scrollHeight` e `getBoundingClientRect` voltam zero
 * e um virtualizador ali mede o nada. Precisa de navegador de verdade — por
 * isso vive no arnês, ao lado do firehose, e não em `*.test.ts`.
 *
 * **Fase 1 — inserção.** Carregar mensagens antigas aumenta o total ACIMA do
 * viewport. Se nada compensar, o que a pessoa está lendo desce e ela perde o
 * lugar. Quem compensa é o TanStack: ao ver as chaves de borda mudarem, guarda
 * a chave sob o scroll e o offset relativo, e depois de remedir devolve o
 * scroll ao mesmo ponto daquele item. É a razão de `getItemKey` ter que ser ID
 * de entidade — com índice, a chave sob o viewport muda de significado a cada
 * prepend e a âncora aponta para outra mensagem.
 *
 * **Fase 2 — remedição.** A fase 1 compensa sobre altura ESTIMADA: as linhas
 * novas entram acima do viewport e nunca foram medidas. O caso de segunda
 * ordem é rolar para dentro do bloco, onde cada estimativa vira altura real, o
 * total cresce de novo, e a compensação precisa acontecer durante o scroll. É
 * onde lista de chat costuma quebrar, e não é o que a fase 1 testa.
 */

export type FaseRemedicao = {
  ok: boolean;
  motivo?: string;
  /** Maior salto inesperado do conteúdo, em px. Zero é o alvo. */
  piorSalto: number;
  ondeSaltou: string;
  /** Quanto o total mudou por altura real substituir estimativa. */
  crescimentoPorRemedicao: number;
  /**
   * Quanto o virtualizador mexeu no scroll por conta própria, somado.
   *
   * É o discriminador do diagnóstico, e a razão de este campo existir.
   * Rolando 260px com as linhas acima crescendo X:
   *
   *   compensação funciona → scroll líquido 260−X, movimento visual 260
   *   compensação falha    → scroll líquido 260,   movimento visual 260+X
   *
   * Medir o salto contra o scroll LÍQUIDO devolve X nos dois casos, e os dois
   * viram indistinguíveis. Por isso o esperado é a INTENÇÃO de rolagem, e a
   * compensação é reportada à parte: com salto zero e compensação alta, o
   * virtualizador está fazendo o trabalho.
   */
  compensacaoAplicada: number;
  passos: number;
};

export type ResultadoPrepend = {
  ok: boolean;
  motivo?: string;
  /** Quanto a mensagem de referência andou na tela. Zero é o alvo. */
  deslocamentoVisual: number;
  crescimentoDoTotal: number;
  deslocamentoDoScroll: number;
  ancora: string;
  remedicao?: FaseRemedicao;
};

const quadro = () => new Promise((r) => requestAnimationFrame(() => r(null)));

/** Linha mais alta que ainda cruza o topo do viewport. */
function referencia(el: HTMLElement) {
  const topo = el.getBoundingClientRect().top;
  const nos = [...document.querySelectorAll<HTMLElement>("[data-mid]")];
  return nos.find((n) => n.getBoundingClientRect().bottom > topo + 2);
}

/**
 * Rola para cima em passos e, a cada um, confere se o conteúdo andou APENAS o
 * que o scroll pediu.
 *
 * A conta é direta: se a linha estava a `offset` do topo e o scroll subiu
 * `delta`, ela deveria estar a `offset + delta`. Qualquer diferença é o
 * virtualizador remedindo uma linha acima e empurrando o que está na tela — o
 * salto que o usuário percebe como "a conversa pulou".
 */
async function medirRemedicao(
  el: HTMLElement,
  passos: number,
  passoPx: number,
): Promise<FaseRemedicao> {
  const totalAntes = el.scrollHeight;
  let piorSalto = 0;
  let ondeSaltou = "";
  let passosReais = 0;
  let compensacaoAplicada = 0;
  let houveMovimento = false;

  for (let i = 0; i < passos; i++) {
    const scrollAntes = el.scrollTop;

    // A INTENÇÃO de rolagem é o que o usuário pediu, e é contra ela que o
    // movimento visual tem que bater. O scroll líquido não serve de
    // referência: ele já embute a compensação.
    const intencao = Math.min(passoPx, scrollAntes);
    if (intencao === 0) break;

    const topo = el.getBoundingClientRect().top;
    const ref = referencia(el);
    if (!ref?.dataset.mid) break;

    const mid = ref.dataset.mid;
    const offsetAntes = ref.getBoundingClientRect().top - topo;

    el.scrollTop = scrollAntes - intencao;
    await quadro();
    await quadro();

    passosReais += 1;
    compensacaoAplicada += Math.round(intencao - (scrollAntes - el.scrollTop));

    const depois = document.querySelector<HTMLElement>(`[data-mid="${mid}"]`);
    // Rolando para cima a referência desce e pode sair da janela: isso é
    // esperado, não é falha.
    if (!depois) continue;

    const real = depois.getBoundingClientRect().top - topo;
    if (Math.abs(real - offsetAntes) > 1) houveMovimento = true;

    const salto = Math.round(real - (offsetAntes + intencao));

    if (Math.abs(salto) > Math.abs(piorSalto)) {
      piorSalto = salto;
      ondeSaltou = mid;
    }
  }

  if (passosReais > 0 && !houveMovimento) {
    return {
      ok: false,
      motivo: "nada se moveu na tela — o scroll não está sendo aplicado",
      piorSalto: 0,
      ondeSaltou: "",
      crescimentoPorRemedicao: Math.round(el.scrollHeight - totalAntes),
      compensacaoAplicada,
      passos: passosReais,
    };
  }

  const crescimentoPorRemedicao = Math.round(el.scrollHeight - totalAntes);

  if (passosReais === 0) {
    return {
      ok: false,
      motivo: "não sobrou histórico acima para rolar",
      piorSalto: 0,
      ondeSaltou: "",
      crescimentoPorRemedicao,
      compensacaoAplicada,
      passos: 0,
    };
  }

  // Se o total não mudou nada, nenhuma estimativa virou altura real e esta
  // fase não exercitou o que existe para exercitar. Passar aqui seria passar
  // pelo motivo errado.
  if (crescimentoPorRemedicao === 0) {
    return {
      ok: false,
      motivo: "nenhuma linha foi remedida — a fase não testou nada",
      piorSalto,
      ondeSaltou,
      crescimentoPorRemedicao,
      compensacaoAplicada,
      passos: passosReais,
    };
  }

  return {
    // Dois pixels de tolerância para arredondamento sub-pixel, igual à fase 1.
    ok: Math.abs(piorSalto) <= 2,
    piorSalto,
    ondeSaltou,
    crescimentoPorRemedicao,
    compensacaoAplicada,
    passos: passosReais,
  };
}

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

  const ancora = referencia(el);
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

  // Um frame de tolerância: a remedição pode arredondar sub-pixel. Acima disso
  // é salto perceptível, que é o que se está caçando.
  const faseUmOk = Math.abs(deslocamentoVisual) <= 2;

  // Fechado ANTES da fase 2: ela rola e remede, e somar aquele crescimento
  // aqui misturaria o custo da inserção com o da remedição.
  const crescimentoDoTotal = Math.round(el.scrollHeight - totalAntes);
  const deslocamentoDoScroll = Math.round(el.scrollTop - scrollAntes);

  const remedicao = await medirRemedicao(el, 12, 260);

  return {
    ok: faseUmOk && remedicao.ok,
    deslocamentoVisual,
    crescimentoDoTotal,
    deslocamentoDoScroll,
    ancora: mid,
    remedicao,
  };
}
