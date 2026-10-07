/**
 * Os emojis que VOCÊ mais usa para reagir.
 *
 * ⚠ **O design é explícito, e o código admitia a dívida em prosa:** *"emojis
 * frequentes do usuário, nunca curadoria do produto"*. O comentário de
 * `REACOES_RAPIDAS` dizia "frequência por usuário é store que ainda não
 * existe, então o que está aqui é o ponto de partida" — este é o store, e a
 * lista do design passou a ser SEMENTE de verdade em vez de promessa.
 *
 * Store local, como `pastas.ts`, `silencio.ts` e `colapso.ts`: o protocolo não
 * tem onde guardar isto, e nem deveria — é preferência de quem digita, não
 * fato sobre o servidor. Sincronizar entre dispositivos cabe em configuração
 * de usuário e fica listado; a forma não muda quando chegar.
 *
 * ⚠ **Contagem e não "últimos usados".** Uma pilha de recentes muda a ordem a
 * cada reação, e as quatro posições viram um alvo móvel — quem aprendeu que o
 * segundo é 🔥 erra no clique seguinte. Contagem só reordena quando um emoji
 * realmente passa o outro, o que é raro depois das primeiras dezenas.
 */

const CHAVE = "vortex:reacoesFrequentes";

/** Quantas cabem no conjunto rápido. É o que o menu desenha. */
export const QUANTAS_RAPIDAS = 4;

/**
 * A SEMENTE, do design.
 *
 * Escolhidas por FUNÇÃO e não por gosto: concordar, pensar, celebrar, registrar
 * que leu. Ela é o que aparece antes de haver histórico, e o que completa a
 * lista enquanto ele for menor que quatro — sem isso, a primeira reação da
 * vida deixaria o menu com um emoji só.
 */
export const SEMENTE_DE_REACOES = ["✅", "🧠", "🔥", "👀"] as const;

const contagens = new Map<string, number>();
const ouvintes = new Set<() => void>();

/**
 * A lista publicada, CACHEADA.
 *
 * ⚠ Armadilha nº 1 do briefing: montar o array dentro do getter devolveria
 * referência nova a cada leitura, e `useSyncExternalStore` concluiria que
 * mudou a cada render — loop, com a aba travando em vez de dar erro.
 */
let rapidas: readonly string[] = SEMENTE_DE_REACOES;

function recalcular(): void {
  const porUso = [...contagens.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji);

  const saida: string[] = [];
  for (const e of porUso) {
    if (saida.length === QUANTAS_RAPIDAS) break;
    saida.push(e);
  }
  /* Completa com a semente, pulando o que já entrou: o menu tem quatro caixas
     e um menu com duas seria a interface encolhendo por causa do histórico. */
  for (const e of SEMENTE_DE_REACOES) {
    if (saida.length === QUANTAS_RAPIDAS) break;
    if (!saida.includes(e)) saida.push(e);
  }

  /* Só publica quando a ORDEM muda de fato — reagir com o emoji que já era o
     primeiro não pode acordar nenhuma linha. */
  if (saida.length === rapidas.length && saida.every((e, i) => e === rapidas[i])) {
    return;
  }
  rapidas = saida;
  for (const o of ouvintes) o();
}

export function assinarReacoesFrequentes(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável: o array guardado, nunca um recém-montado. */
export function reacoesRapidas(): readonly string[] {
  return rapidas;
}

/** Registra um uso. Chamado de onde a reação acontece, não do render. */
export function registrarUsoDeReacao(emoji: string): void {
  contagens.set(emoji, (contagens.get(emoji) ?? 0) + 1);
  guardar();
  recalcular();
}

/* ------------------------------------------------------ persistência */

/*
  ⚠ Todo acesso embrulhado, como `store/sessao.ts`: aba anônima e
  armazenamento bloqueado são casos reais, e uma preferência ilegível é tratada
  como preferência inexistente — nunca como motivo para a tela não abrir.
*/
function guardar(): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify([...contagens]));
  } catch {
    /* Sem persistência a sessão continua funcionando; só não lembra depois. */
  }
}

export function restaurarReacoesFrequentes(): void {
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "[]");
    if (!Array.isArray(cru)) return;
    for (const par of cru) {
      if (!Array.isArray(par) || par.length !== 2) continue;
      const [emoji, n] = par as [unknown, unknown];
      if (typeof emoji !== "string" || typeof n !== "number") continue;
      if (!Number.isFinite(n) || n <= 0) continue;
      contagens.set(emoji, n);
    }
  } catch {
    /* JSON corrompido é o mesmo que ausência. */
  }
  recalcular();
}

/** Estado limpo entre testes. */
export function limparReacoesFrequentes(): void {
  contagens.clear();
  rapidas = SEMENTE_DE_REACOES;
}

/*
  Restaura na carga do módulo, como `store/pastas.ts`.

  Sem isso alguém teria de LEMBRAR de chamar, e o sintoma seria o conjunto
  rápido voltando à semente a cada F5 — indistinguível de "a contagem não está
  sendo guardada", que é o defeito oposto e mora noutro lugar.
*/
restaurarReacoesFrequentes();
