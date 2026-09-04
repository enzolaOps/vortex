/**
 * Privacidade POR SERVIDOR.
 *
 * ⚠ **Nada disto existe no protocolo Stoat**, e é a mesma situação de
 * `store/privacidade.ts` com uma diferença que importa: lá as preferências são
 * globais e um dia sobem para `UserSettings`; aqui elas são por servidor, e o
 * protocolo não tem nem onde guardar. Quem resolveria é o serviço `api`
 * forkado — o caminho da § Divergência de produto.
 *
 * ⚠ **Por que a decisão é POR SERVIDOR e não uma página de configurações**, e
 * a referência escreve isso: *"é um modal do menu de contexto do servidor,
 * não uma página de configurações — a decisão é sempre tomada no contexto
 * daquele servidor"*. Quem quer fechar DMs de um servidor específico está
 * olhando para ele; abrir configurações e escolher o servidor numa lista
 * inverte a ordem em que a pessoa pensa.
 *
 * `Map` por ID de servidor, e o default é o mesmo objeto para todos — quem
 * nunca mexeu não ocupa entrada. É a razão de `lerPrivacidadeDoServidor`
 * devolver `PADRAO` em vez de criar: sem isso, abrir o modal em cada servidor
 * faria o mapa crescer com cópias idênticas do default.
 */

/** Quem pode me mandar DM a partir deste servidor. */
export const ALCANCES_DE_DM = ["todos", "cargoComum", "ninguem"] as const;
export type AlcanceDeDm = (typeof ALCANCES_DE_DM)[number];

/** O quanto a mídia sensível é escondida. */
export const FILTROS_DE_CONTEUDO = [
  "nao",
  "deNaoAmigos",
  "tudo",
] as const;
export type FiltroDeConteudo = (typeof FILTROS_DE_CONTEUDO)[number];

export type PrivacidadeDoServidor = {
  readonly dm: AlcanceDeDm;
  readonly filtro: FiltroDeConteudo;
  readonly mostrarPresenca: boolean;
  readonly mostrarAtividade: boolean;
  readonly permitirAmizade: boolean;
};

/*
  O padrão é o do design: DM só de quem compartilha cargo, filtro de quem não
  é amigo, presença visível.

  ⚠ **`mostrarAtividade` começa DESLIGADO**, e é a única assimetria: presença
  é o que faz uma lista de membros servir para alguma coisa, mas "o que você
  está jogando" é dado que ninguém pediu para publicar. Ligado por padrão, ele
  vaza antes de a pessoa saber que existe.
*/
export const PADRAO: PrivacidadeDoServidor = {
  dm: "cargoComum",
  filtro: "deNaoAmigos",
  mostrarPresenca: true,
  mostrarAtividade: false,
  permitirAmizade: true,
};

const CHAVE = "vortex:privacidadeDoServidor";

function entrada(v: unknown): PrivacidadeDoServidor | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const r = v as Record<string, unknown>;
  const dm = ALCANCES_DE_DM.find((a) => a === r.dm);
  const filtro = FILTROS_DE_CONTEUDO.find((f) => f === r.filtro);
  if (!dm || !filtro) return undefined;
  if (
    typeof r.mostrarPresenca !== "boolean" ||
    typeof r.mostrarAtividade !== "boolean" ||
    typeof r.permitirAmizade !== "boolean"
  ) {
    return undefined;
  }
  return {
    dm,
    filtro,
    mostrarPresenca: r.mostrarPresenca,
    mostrarAtividade: r.mostrarAtividade,
    permitirAmizade: r.permitirAmizade,
  };
}

function carregar(): {
  padrao: PrivacidadeDoServidor;
  porServidor: Map<string, PrivacidadeDoServidor>;
} {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return { padrao: PADRAO, porServidor: new Map() };
    const o: unknown = JSON.parse(cru);
    if (typeof o !== "object" || o === null) {
      return { padrao: PADRAO, porServidor: new Map() };
    }
    const r = o as Record<string, unknown>;
    const padraoLido = entrada(r.padrao) ?? PADRAO;
    const mapa = new Map<string, PrivacidadeDoServidor>();
    if (typeof r.porServidor === "object" && r.porServidor !== null) {
      for (const [id, valor] of Object.entries(
        r.porServidor as Record<string, unknown>,
      )) {
        const e = entrada(valor);
        if (e) mapa.set(id, e);
      }
    }
    return { padrao: padraoLido, porServidor: mapa };
  } catch {
    return { padrao: PADRAO, porServidor: new Map() };
  }
}

const inicial = carregar();
const porServidor = inicial.porServidor;

/*
  O default vigente. Começa no de fábrica e muda só por "aplicar a todos" —
  `PADRAO` continua sendo o de fábrica, para o teste e para a documentação.
*/
let padrao: PrivacidadeDoServidor = inicial.padrao;

function persistir(): void {
  try {
    localStorage.setItem(
      CHAVE,
      JSON.stringify({
        padrao,
        porServidor: Object.fromEntries(porServidor),
      }),
    );
  } catch {
    /* vale nesta aba */
  }
}

const ouvintes = new Set<() => void>();

export function assinarPrivacidadeDoServidor(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * ⚠ Devolve `PADRAO` — a MESMA referência — para quem nunca mexeu.
 *
 * É o que mantém o `getSnapshot` estável, que é a armadilha nº 1 do briefing:
 * montar `{...PADRAO}` aqui daria objeto novo a cada leitura e o
 * `useSyncExternalStore` entraria em laço.
 */
export function lerPrivacidadeDoServidor(
  serverId: string,
): PrivacidadeDoServidor {
  return porServidor.get(serverId) ?? padrao;
}

export function definirPrivacidadeDoServidor(
  serverId: string,
  mudanca: Partial<PrivacidadeDoServidor>,
): void {
  porServidor.set(serverId, {
    ...lerPrivacidadeDoServidor(serverId),
    ...mudanca,
  });
  persistir();
  for (const o of ouvintes) o();
}

/**
 * "Aplicar a todos os servidores".
 *
 * ⚠ **O botão existe porque é o atalho que as pessoas realmente querem depois
 * de configurar o terceiro servidor** — é a frase da referência, e ela
 * descreve o comportamento certo: copiar ESTE servidor para todos os que já
 * têm entrada, e trocar o default para os que não têm. Sem a segunda metade,
 * "todos" significaria "todos os que eu já abri", que é o tipo de promessa
 * parcial que faz alguém desconfiar da tela inteira.
 *
 * Devolve quantos servidores foram afetados, para o toast poder dizer.
 */
export function aplicarATodos(serverId: string): number {
  const escolha = lerPrivacidadeDoServidor(serverId);
  padrao = escolha;
  for (const id of porServidor.keys()) porServidor.set(id, escolha);
  const quantos = porServidor.size;
  persistir();
  for (const o of ouvintes) o();
  return quantos;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparPrivacidadeDoServidor(): void {
  porServidor.clear();
  padrao = PADRAO;
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* mesma regra da escrita */
  }
}
