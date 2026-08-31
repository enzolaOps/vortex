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
  /** O servidor pediu segundo fator. Ver `metodos`. */
  | "mfa"
  /** Conta nova, autenticada, ainda sem nome de usuário escolhido. */
  | "nome"
  | "dentro"
  | "erro"
  /** A conta existe e foi desativada. Não é erro de senha. */
  | "desativada";

/**
 * Os segundos fatores que o Vortex sabe responder.
 *
 * Vocabulário do app, não do protocolo — `Password | Recovery` é a grafia do
 * Stoat, e traduzir na fronteira é a mesma regra que fez `PresenceStatus`
 * existir em vez de o app falar `"Busy"`.
 *
 * ⚠ **`Totp` NÃO está aqui, e é escolha de produto, não lacuna.** Aplicativo
 * autenticador ficou fora do Vortex. A consequência é dita e tem tratamento: se
 * o servidor desafiar com um método que este cliente não conhece, `concluir`
 * cai no ramo de lista vazia e a tela DIZ que não dá — em vez de mostrar um
 * formulário que só pode falhar.
 *
 * `recuperacao` fica porque não custa nada e é a saída de quem tenha ativado o
 * autenticador por outro cliente: sem ela, essa conta ficaria sem nenhum
 * caminho de entrada.
 */
export type MetodoDeMfa = "senha" | "recuperacao";

export type Sessao = {
  readonly estado: EstadoDaSessao;
  /** Quem sou eu. Só existe em `dentro`. */
  readonly userId: string | undefined;
  /** O que deu errado, para a tela dizer. Só existe em `erro`. */
  readonly motivo: string | undefined;
  /**
   * Quais fatores servem. Só tem conteúdo em `mfa`.
   *
   * Vem do servidor: uma conta pode ter TOTP e códigos de recuperação e outra
   * só senha. Oferecer um método que o servidor não aceita é um formulário que
   * só pode falhar.
   */
  readonly metodos: readonly MetodoDeMfa[];
  /**
   * Há uma chamada de rede em voo AGORA.
   *
   * Separado do estado porque a espera não é um lugar: quem está no segundo
   * fator e aperta "Verificar" continua no segundo fator. A primeira versão
   * disto reusava o estado `entrando`, e o efeito era a pessoa com MFA ser
   * jogada de volta à tela de senha a cada tentativa — sem erro nenhum, só a
   * tela errada.
   */
  readonly ocupada: boolean;
};

/** Referência compartilhada: quase todo estado tem lista vazia. */
const SEM_METODOS: readonly MetodoDeMfa[] = [];

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
  metodos: SEM_METODOS,
  ocupada: false,
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
  publicar({
    estado: "entrando",
    userId: undefined,
    motivo: undefined,
    metodos: SEM_METODOS,
    ocupada: true,
  });
}

export function dentro(userId: string): void {
  publicar({
    estado: "dentro",
    userId,
    motivo: undefined,
    metodos: SEM_METODOS,
    ocupada: false,
  });
}

export function fora(): void {
  publicar({
    estado: "fora",
    userId: undefined,
    motivo: undefined,
    metodos: SEM_METODOS,
    ocupada: false,
  });
}

/**
 * O servidor pediu segundo fator.
 *
 * Estado próprio e não um sinalizador dentro de `entrando`: a tela que pede o
 * código não se parece com a que pede a senha, e o portão decide o que
 * renderizar por um `Record` exaustivo sobre este tipo.
 */
export function precisaDeMfa(
  metodos: readonly MetodoDeMfa[],
  opcoes?: { readonly motivo?: string; readonly ocupada?: boolean },
): void {
  publicar({
    estado: "mfa",
    userId: undefined,
    motivo: opcoes?.motivo,
    metodos,
    ocupada: opcoes?.ocupada ?? false,
  });
}

/**
 * Autenticado, mas a conta ainda não tem nome de usuário.
 *
 * Estado próprio entre `entrando` e `dentro`, e a posição é o ponto: a sessão
 * JÁ vale (o token está instalado e o socket aberto), mas entrar no app agora
 * mostraria as mensagens da pessoa sem autor legível e um ID na member list.
 *
 * `userId` sobrevive porque a tela de nome precisa dele para concluir — é a
 * única transição do arquivo que carrega identidade sem estar `dentro`.
 */
export function precisaDeNome(userId: string, motivo?: string): void {
  publicar({
    estado: "nome",
    userId,
    motivo,
    metodos: SEM_METODOS,
    ocupada: false,
  });
}

/**
 * A conta foi desativada.
 *
 * Separado de `erro` porque a ação é outra: senha errada se resolve tentando de
 * novo, conta desativada não se resolve em tela nenhuma. O upstream trata isto
 * com um `alert()` e um `// TODO`.
 */
export function desativada(): void {
  publicar({
    estado: "desativada",
    userId: undefined,
    motivo: undefined,
    metodos: SEM_METODOS,
    ocupada: false,
  });
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
  publicar({
    estado: "erro",
    userId: undefined,
    motivo,
    metodos: SEM_METODOS,
    ocupada: false,
  });
}

/** Estado limpo entre testes. */
export function limparSessao(): void {
  sessao = INICIAL;
  esquecerToken();
}
