/**
 * A sessão — se há alguém logado, e quem.
 *
 * Store module-level, lei nº 1: quem muda isto é uma resposta de rede ou o
 * evento `logout` do SDK, e nenhum dos dois está numa árvore de componentes.
 *
 * ⚠ **Uma coisa aqui não foi verificada, e não podia ser: a chamada de
 * autenticação.** Não há backend alcançável deste repositório — `pi-infra` é
 * outro projeto, e não há configuração de servidor aqui. Tudo o mais neste
 * arquivo é exercitado por teste; `client.login()` é a única linha que só vai
 * rodar de verdade quando houver servidor. Está isolada de propósito, para que
 * o dia em que ela falhar tenha um lugar só para olhar.
 */

/**
 * Os estados, e por que são cinco.
 *
 * `desconhecida` existe porque a primeira pergunta que o app faz é ao
 * armazenamento local, e ela é síncrona mas não instantânea: renderizar a tela
 * de login enquanto se descobre que já há sessão faria a tela piscar em toda
 * abertura. Um estado a mais aqui evita esse flash sem `setTimeout` nenhum.
 */
export type EstadoDaSessao =
  | "desconhecida"
  | "fora"
  | "entrando"
  | "dentro"
  | "erro";

export type Sessao = {
  readonly estado: EstadoDaSessao;
  /** Quem sou eu. Só existe em `dentro`. */
  readonly userId: string | undefined;
  /** O que deu errado, para a tela dizer. Só existe em `erro`. */
  readonly motivo: string | undefined;
};

/**
 * A chave do armazenamento.
 *
 * ⚠ **O token de sessão fica em `localStorage`, e isso é uma decisão com
 * custo.** Um XSS neste app vira roubo de conta, porque o token É a
 * credencial — e o app renderiza conteúdo escrito por qualquer pessoa, que é
 * exatamente a superfície de onde um XSS viria.
 *
 * Foi escolhido assim porque as alternativas não existem para um SPA puro:
 * cookie `httpOnly` exige o backend emiti-lo, e o protocolo entrega token no
 * corpo; `sessionStorage` perde a sessão a cada aba nova, o que num app de
 * jornada de 8h é pior do que parece; memória só obriga login a cada F5.
 *
 * As defesas reais estão em não dar o XSS: nada de `innerHTML` com conteúdo de
 * terceiro, e a CSP sem `unsafe-inline` que o Electron já exige. Se um dia
 * houver backend próprio, cookie `httpOnly` é a melhora, e é ali que ela cabe.
 */
const CHAVE = "vortex.sessao";

const INICIAL: Sessao = {
  estado: "desconhecida",
  userId: undefined,
  motivo: undefined,
};

let sessao: Sessao = INICIAL;
const ouvintes = new Set<() => void>();

export function assinarSessao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — nunca monta objeto no getter. Armadilha nº 1. */
export function lerSessao(): Sessao {
  return sessao;
}

function publicar(nova: Sessao) {
  sessao = nova;
  for (const ouvinte of ouvintes) ouvinte();
}

/** O token guardado, ou nada. Formato do protocolo: `{_id, token, user_id}`. */
export type TokenGuardado = {
  readonly _id: string;
  readonly token: string;
  readonly user_id: string;
};

/**
 * O que está no armazenamento, se estiver íntegro.
 *
 * Um JSON corrompido — meia escrita, versão antiga, alguém mexendo no console —
 * devolve `undefined` em vez de estourar. Sessão ilegível é sessão inexistente,
 * e a resposta certa é pedir login, não quebrar a abertura do app.
 */
export function lerTokenGuardado(): TokenGuardado | undefined {
  let bruto: string | null;
  try {
    bruto = localStorage.getItem(CHAVE);
  } catch {
    // Aba anônima, armazenamento bloqueado. Sem sessão guardada, e sem drama.
    return undefined;
  }
  if (!bruto) return undefined;

  try {
    const v: unknown = JSON.parse(bruto);
    if (
      typeof v === "object" &&
      v !== null &&
      typeof (v as TokenGuardado)._id === "string" &&
      typeof (v as TokenGuardado).token === "string" &&
      typeof (v as TokenGuardado).user_id === "string"
    ) {
      return v as TokenGuardado;
    }
  } catch {
    // Cai fora igual.
  }
  return undefined;
}

export function guardarToken(t: TokenGuardado): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(t));
  } catch {
    /*
      Falhar ao guardar NÃO derruba o login.

      A pessoa está autenticada nesta aba; o que se perde é a comodidade de não
      digitar de novo amanhã. Trocar uma sessão viva por um erro seria pagar
      caro por uma conveniência.
    */
  }
}

export function esquecerToken(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // Idem.
  }
}

/* ------------------------------------------------------- transições */

export function entrando(): void {
  publicar({ estado: "entrando", userId: undefined, motivo: undefined });
}

export function dentro(userId: string): void {
  publicar({ estado: "dentro", userId, motivo: undefined });
}

export function fora(): void {
  publicar({ estado: "fora", userId: undefined, motivo: undefined });
}

/**
 * Deu errado, e a mensagem é para QUEM USA.
 *
 * "Failed to fetch" é escrito para quem programa. Quem digitou a senha precisa
 * saber se errou a senha ou se o servidor não respondeu — são problemas
 * diferentes com ações diferentes, e confundi-los faz a pessoa tentar a coisa
 * errada.
 */
export function erro(motivo: string): void {
  publicar({ estado: "erro", userId: undefined, motivo });
}

/** Estado limpo entre testes. */
export function limparSessao(): void {
  sessao = INICIAL;
  esquecerToken();
}
