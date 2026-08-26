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

export type Toast = {
  readonly id: string;
  readonly titulo: string;
  readonly descricao?: string;
  readonly tipo: TipoDeToast;
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
