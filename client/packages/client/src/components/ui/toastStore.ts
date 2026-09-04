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
  /**
   * Quantas vezes o MESMO aviso chegou seguido. Ausente é uma vez.
   *
   * ⚠ Existe porque cinco toasts idênticos empilhados foi relatado com captura
   * de tela: erro não expira (decisão registrada) e é isento do corte de
   * pilha, então cinco tentativas de salvar o perfil deixaram cinco cópias da
   * mesma frase ocupando o canto inferior.
   */
  readonly repeticoes?: number;
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
/**
 * Teto da pilha, e ele existe por uma razão medida no design: três.
 *
 * ⚠ **Sem teto, uma rajada empilha indefinidamente** — reconexão que falha em
 * série, ou um servidor devolvendo erro a cada tentativa, cobre a tela de
 * baixo para cima e esconde o próprio conteúdo. O toast existe para avisar
 * sem interromper; quinze deles interrompem.
 *
 * Sai o mais VELHO e não o mais novo: quem acabou de agir está olhando para o
 * resultado da última ação, e descartá-la para manter uma de dez segundos
 * atrás inverteria a atenção.
 */
const PILHA_MAXIMA = 3;

export function toast(entrada: Omit<Toast, "id">): string {
  sequencia += 1;
  const id = `t${sequencia}`;
  /*
    ⚠ O corte preserva os ERROS: eles não expiram sozinhos (decisão já
    registrada — cinco segundos é o tempo de confirmar um acerto e o errado de
    relatar um erro), então descartá-los por pressão de fila apagaria a única
    coisa da pilha que ninguém leu ainda.
  */
  /*
    ⚠ **Repetição idêntica CONTA, em vez de empilhar ou de sumir.**

    Deduplicar em silêncio seria o defeito oposto e mais difícil de ver: quem
    tenta de novo e não vê nada mudar conclui que o clique não pegou. O
    contador diz as duas coisas — o aviso é o mesmo, e aconteceu de novo.

    Compara pelos três campos que a pessoa LÊ. `acao` fica de fora de propósito:
    ela carrega closures, que nunca são iguais por referência, e dois avisos com
    o mesmo texto são a mesma notícia mesmo que o botão seja outro.
  */
  const igual = toasts.findIndex(
    (t) =>
      t.tipo === entrada.tipo &&
      t.titulo === entrada.titulo &&
      t.descricao === entrada.descricao,
  );
  if (igual !== -1) {
    const anterior = toasts[igual]!;
    toasts = toasts.map((t, i) =>
      i === igual ? { ...t, repeticoes: (anterior.repeticoes ?? 1) + 1 } : t,
    );
    avisar();
    return anterior.id;
  }

  const proximos = [...toasts, { ...entrada, id }];
  if (proximos.length > PILHA_MAXIMA) {
    const excedente = proximos.length - PILHA_MAXIMA;
    let cortados = 0;
    toasts = proximos.filter((t) => {
      if (cortados >= excedente || t.tipo === "erro" || t.id === id) return true;
      cortados += 1;
      return false;
    });
  } else {
    toasts = proximos;
  }
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
