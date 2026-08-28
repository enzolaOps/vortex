/**
 * Store dos toasts. Module-level, fora do React — lei nº 1.
 *
 * Toast quer API imperativa: quem dispara é um handler de erro, um caminho de
 * reconexão, um envio que falhou. Nada disso está numa árvore de componentes, e
 * enfiar isso em Context obrigaria todo disparo a vir de dentro do React.
 *
 * A armadilha mora aqui: `lerToasts` devolve a MESMA referência enquanto nada
 * muda. Montar o array no getter faria o `useSyncExternalStore` comparar por
 * `Object.is`, achar que mudou, re-renderizar e chamar de novo — loop que
 * trava a aba sem erro no console.
 */

export type TipoDeToast = "info" | "erro";

/**
 * A saída que o toast oferece.
 *
 * Existe para desfazer: quando a ação já aconteceu e reverter é barato, um
 * botão aqui é melhor que uma confirmação antes — a confirmação cobra de todo
 * mundo, sempre, para proteger o caso raro de arrependimento.
 *
 * `rotulo` é o que se lê no botão; `descricaoAlternativa` é o que o Radix
 * exige para quem não vê o toast, e precisa dizer como fazer a mesma coisa sem
 * ele. Toast some; instrução tem que sobreviver a isso.
 */
export type AcaoDeToast = {
  readonly rotulo: string;
  readonly descricaoAlternativa: string;
  readonly aoAtivar: () => void;
};

export type Toast = {
  readonly id: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly tipo: TipoDeToast;
  readonly acao?: AcaoDeToast;
};

const VAZIO: readonly Toast[] = [];

let toasts: readonly Toast[] = VAZIO;
let sequencia = 0;

const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

export function assinarToasts(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada. Nunca aloca. */
export function lerToasts(): readonly Toast[] {
  return toasts;
}

/**
 * Dispara um toast. Devolve o id, para quem quiser dispensar antes da hora.
 *
 * Sequencial em vez de aleatório: id previsível é testável, e não há requisito
 * de imprevisibilidade aqui.
 */
export function toast(entrada: Omit<Toast, "id">): string {
  sequencia += 1;
  const id = `t${sequencia}`;
  toasts = [...toasts, { ...entrada, id }];
  avisar();
  return id;
}

export function dispensarToast(id: string) {
  const restantes = toasts.filter((t) => t.id !== id);
  // Só troca a referência se algo saiu de fato: dispensar um id que já sumiu
  // não pode acordar quem assina.
  if (restantes.length === toasts.length) return;
  toasts = restantes.length === 0 ? VAZIO : restantes;
  avisar();
}
