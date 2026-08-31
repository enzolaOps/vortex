/**
 * Modo desenvolvedor.
 *
 * ⚠ **Ele é 100% do CLIENTE — não há nada de protocolo aqui**, e é por isso
 * que ele funciona de verdade enquanto quase tudo de "Avançado" no design
 * depende do Electron. O que ele faz é acrescentar "Copiar ID" aos menus de
 * contexto, e ID é dado que o app já tem na mão.
 *
 * Store module-level porque quem o LÊ são os menus de contexto — espalhados
 * por rail, coluna de canais, member list e linha de mensagem — e quem o
 * ESCREVE é uma tela de configuração. Não há árvore comum entre os dois, que é
 * a lei nº 1 na sua forma mais literal.
 *
 * Persistido: quem liga o modo desenvolvedor liga porque vai reportar um
 * problema, e refazer isso a cada F5 é atrito exatamente no momento errado.
 */

const CHAVE = "vx:dev";

export type Dev = {
  readonly modoDesenvolvedor: boolean;
  /** FPS, latência e re-renders no canto — ver a pendência `overlayDeDebug`. */
  readonly overlay: boolean;
};

function ler(): Dev {
  try {
    const cru: unknown = JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
    if (typeof cru !== "object" || cru === null) return PADRAO;
    const o = cru as Partial<Record<keyof Dev, unknown>>;
    return {
      modoDesenvolvedor: o.modoDesenvolvedor === true,
      overlay: o.overlay === true,
    };
  } catch {
    /* JSON corrompido ou armazenamento bloqueado: o padrão vale, e a sessão
       viva não cai por causa disso. Mesma disciplina de `sessao.ts`. */
    return PADRAO;
  }
}

const PADRAO: Dev = { modoDesenvolvedor: false, overlay: false };

let estado: Dev = ler();

const ouvintes = new Set<() => void>();

export function assinarDev(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerDev(): Dev {
  return estado;
}

/**
 * O predicado, para quem só quer saber se mostra "Copiar ID".
 *
 * Função e não campo do snapshot: os menus de contexto são MUITOS, e assinar o
 * objeto inteiro em cada um faria trocar o overlay re-renderizar todos eles.
 * Como booleano, o React descarta o render quando o valor não mudou.
 */
export function modoDev(): boolean {
  return estado.modoDesenvolvedor;
}

export function definirDev(mudanca: Partial<Dev>): void {
  estado = { ...estado, ...mudanca };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    /* Aba anônima, armazenamento cheio. A escolha vale nesta sessão. */
  }
  for (const o of ouvintes) o();
}
