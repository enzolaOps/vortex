import { BIT_VER_CANAL } from "../../sdk/bits";
import type { OverrideDeCanal } from "../../sdk/canal";
import type { ConjuntoDeSobreposicoes } from "../../sdk/categorias";
import { bitDaPermissao, PERMISSOES } from "../../sdk/cargos";

/**
 * A matemática das duas telas de permissão do canal — pura, sem SDK.
 *
 * As duas telas (a lista "quem pode acessar" e a matriz avançada) leem e
 * escrevem os MESMOS overrides (D-CCANAL-14): o que decide "este cargo tem
 * acesso explícito" na lista é o mesmo número que a matriz conta ao lado do
 * cargo. Morarem num módulo só é o que impede as duas de divergirem.
 */

/**
 * O alvo @everyone, na chave que o PROTOCOLO usa para escrever
 * (`PUT /channels/{id}/permissions/default`).
 *
 * ⚠ **Ler é outra coisa.** No objeto do canal o @everyone NÃO está em
 * `role_permissions["default"]` — está em `default_permissions`. A tela lia
 * `rolePermissions["default"]` e por isso "Canal privado" não refletia o
 * canal. `overrideDoAlvo` é a única leitura, e ela sabe a diferença.
 */
export const ALVO_EVERYONE = "default";

export type Estado = "negar" | "herdar" | "permitir";

const NADA: OverrideDeCanal = { allow: 0n, deny: 0n };

/** Os bits que a matriz mostra — os do catálogo, na ordem dele. */
function bitsDoCatalogo(): bigint[] {
  const out: bigint[] = [];
  for (const g of PERMISSOES) {
    for (const p of g.itens) {
      const b = bitDaPermissao(p.id);
      if (b !== 0n) out.push(b);
    }
  }
  return out;
}

/** O par de um alvo no conjunto do canal — @everyone mora em `padrao`. */
export function overrideDoAlvo(
  conjunto: ConjuntoDeSobreposicoes,
  alvo: string,
): OverrideDeCanal {
  return (alvo === ALVO_EVERYONE ? conjunto.padrao : conjunto.cargos[alvo]) ?? NADA;
}

/** "Canal privado": `ViewChannel` negado para @everyone, e só isso. */
export function canalPrivado(conjunto: ConjuntoDeSobreposicoes): boolean {
  return ((conjunto.padrao?.deny ?? 0n) & BIT_VER_CANAL) !== 0n;
}

/**
 * O estado de um bit no par.
 *
 * ⚠ `deny` é conferido ANTES de `allow`: o protocolo não proíbe um bit estar
 * nos dois, e nesse caso quem ganha é a negação.
 */
export function estadoDe(o: OverrideDeCanal, bit: bigint): Estado {
  if ((o.deny & bit) !== 0n) return "negar";
  if ((o.allow & bit) !== 0n) return "permitir";
  return "herdar";
}

/** Move um bit para o estado pedido, tirando-o do outro lado. */
export function aplicar(o: OverrideDeCanal, bit: bigint, e: Estado): OverrideDeCanal {
  return {
    allow: e === "permitir" ? o.allow | bit : o.allow & ~bit,
    deny: e === "negar" ? o.deny | bit : o.deny & ~bit,
  };
}

/**
 * "N permitidas · M negadas" (D-CCANAL-20), contado sobre o catálogo.
 *
 * Bit fora do catálogo não conta: a matriz não tem linha para ele, e um número
 * que ninguém consegue achar na tela é pior que um número menor.
 */
export function contarDecisoes(o: OverrideDeCanal): {
  readonly permitidas: number;
  readonly negadas: number;
} {
  let permitidas = 0;
  let negadas = 0;
  for (const b of bitsDoCatalogo()) {
    const e = estadoDe(o, b);
    if (e === "permitir") permitidas += 1;
    else if (e === "negar") negadas += 1;
  }
  return { permitidas, negadas };
}

export function totalDeDecisoes(o: OverrideDeCanal): number {
  const c = contarDecisoes(o);
  return c.permitidas + c.negadas;
}

/**
 * A cor da contagem ao lado do alvo, como o design pinta: só negações em
 * vermelho, só permissões em verde, misturado em neutro. `undefined` quando o
 * alvo não decide nada — o design não escreve "0".
 */
export function tomDaContagem(
  o: OverrideDeCanal,
): "negar" | "permitir" | "misto" | undefined {
  const c = contarDecisoes(o);
  if (c.permitidas === 0 && c.negadas === 0) return undefined;
  if (c.permitidas === 0) return "negar";
  if (c.negadas === 0) return "permitir";
  return "misto";
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/**
 * A nota do cabeçalho do alvo (D-CCANAL-17).
 *
 * "base do canal" é do @everyone e só dele: é o override sobre o qual todos
 * os outros somam. ⚠ O design escreve "2 membros · 6 overrides" nos cargos; a
 * contagem de membros por cargo não está em lugar nenhum do cliente sem varrer
 * a member list inteira, e fica de fora em vez de virar número inventado.
 */
export function notaDoAlvo(alvo: string, o: OverrideDeCanal): string {
  const n = totalDeDecisoes(o);
  const decisoes = n === 0 ? "herda tudo" : plural(n, "override", "overrides");
  return alvo === ALVO_EVERYONE ? `base do canal · ${decisoes}` : decisoes;
}

/**
 * O veredito de uma linha da lista de acesso (D-CCANAL-12).
 *
 * "sem acesso" ganha de tudo: negar ver é a decisão que a pergunta "quem pode
 * acessar?" quer saber. "acesso total" é permitir ver sem negar nada. O resto
 * é contado — "3 overrides" diz que o cargo entra, com regras próprias.
 */
export function rotuloDeAcesso(o: OverrideDeCanal):
  | { readonly tom: "negado"; readonly texto: string }
  | { readonly tom: "total"; readonly texto: string }
  | { readonly tom: "neutro"; readonly texto: string } {
  if ((o.deny & BIT_VER_CANAL) !== 0n) return { tom: "negado", texto: "sem acesso" };
  const n = totalDeDecisoes(o);
  if (n === 0) return { tom: "neutro", texto: "herda do servidor" };
  if (o.deny === 0n && (o.allow & BIT_VER_CANAL) !== 0n) {
    return { tom: "total", texto: "acesso total" };
  }
  return { tom: "neutro", texto: plural(n, "override", "overrides") };
}

/**
 * Os cargos que DECIDEM algo neste canal, na ordem da hierarquia.
 *
 * É a lista de acesso explícito: antes ela mostrava TODOS os cargos do
 * servidor com "acesso total" fixo — afirmando, para cargo que o canal nem
 * menciona, um acesso que ninguém deu.
 */
export function cargosComAcessoExplicito<T extends { readonly id: string }>(
  conjunto: ConjuntoDeSobreposicoes,
  cargos: readonly T[],
): T[] {
  return cargos.filter((c) => totalDeDecisoes(overrideDoAlvo(conjunto, c.id)) > 0);
}

/** "N cargos com acesso explícito" — o resumo do cabeçalho da lista. */
export function resumoDeAcesso(n: number): string {
  if (n === 0) return "Nenhum cargo com acesso explícito — todos herdam do servidor";
  return `${plural(n, "cargo", "cargos")} com acesso explícito`;
}

/**
 * Os alvos da coluna da matriz (D-CCANAL-16): @everyone sempre, os cargos que
 * decidem algo, e os que alguém ACABOU de acrescentar (ainda sem decisão),
 * filtrados pela busca.
 *
 * O acrescentado precisa ficar: sem ele, "＋ Adicionar cargo" poria o cargo na
 * coluna e ele sumiria no primeiro render, antes de a pessoa escolher o
 * primeiro bit.
 */
export function alvosDaMatriz<T extends { readonly id: string; readonly nome: string }>(
  conjunto: ConjuntoDeSobreposicoes,
  cargos: readonly T[],
  adicionados: ReadonlySet<string>,
  busca: string,
): { readonly everyone: boolean; readonly cargos: T[] } {
  const f = busca.trim().toLocaleLowerCase("pt-BR");
  const casa = (nome: string) => f === "" || nome.toLocaleLowerCase("pt-BR").includes(f);
  return {
    everyone: casa("@everyone"),
    cargos: cargos.filter(
      (c) =>
        (adicionados.has(c.id) || totalDeDecisoes(overrideDoAlvo(conjunto, c.id)) > 0) &&
        casa(c.nome),
    ),
  };
}

/** Os cargos que ainda NÃO estão na coluna — o que "＋ Adicionar cargo" oferece. */
export function cargosParaAdicionar<T extends { readonly id: string }>(
  conjunto: ConjuntoDeSobreposicoes,
  cargos: readonly T[],
  adicionados: ReadonlySet<string>,
): T[] {
  return cargos.filter(
    (c) => !adicionados.has(c.id) && totalDeDecisoes(overrideDoAlvo(conjunto, c.id)) === 0,
  );
}

/* --------------------------------------------------------- procedência */

/** Aplica um par a um valor booleano — `(v | allow) & !deny`, como o servidor. */
function aplicarPar(v: boolean, o: OverrideDeCanal | undefined, bit: bigint): boolean {
  if (o === undefined) return v;
  if ((o.deny & bit) !== 0n) return false;
  if ((o.allow & bit) !== 0n) return true;
  return v;
}

/**
 * De onde vem, e quanto vale, um bit que o alvo HERDA neste canal
 * (D-CCANAL-21, "Herdando de Produto · negado").
 *
 * O valor segue a ordem do cálculo do servidor: piso do servidor → par do
 * cargo no servidor → override de @everyone NESTE canal. A categoria não entra
 * no valor — no fork ela é o conjunto que o canal COPIA, não um degrau do
 * cálculo (ver `sdk/categorias.ts`).
 *
 * O NOME da origem é o degrau mais próximo que decide:
 * - para um cargo, se o @everyone deste canal decide o bit, é "@everyone";
 * - senão, a categoria — só quando ela também herda o bit para este alvo, ou
 *   seja quando "herdar daqui" e "herdar da categoria" são a mesma coisa;
 * - senão, "servidor". Dizer "Herdando de Produto" com a categoria DECIDINDO
 *   outra coisa afirmaria um valor que o canal não recebe — é o caso do canal
 *   dessincronizado, que o banner já explica.
 */
export function herdado(args: {
  readonly alvo: string;
  readonly bit: bigint;
  readonly canal: ConjuntoDeSobreposicoes;
  readonly categoria: { readonly titulo: string; readonly conjunto: ConjuntoDeSobreposicoes } | undefined;
  readonly servidor: {
    readonly padrao: bigint;
    readonly cargos: Readonly<Record<string, OverrideDeCanal>>;
  };
}): { readonly origem: string; readonly permitido: boolean } {
  const { alvo, bit, canal, categoria, servidor } = args;
  const piso = (servidor.padrao & bit) !== 0n;
  const ehEveryone = alvo === ALVO_EVERYONE;
  const noServidor = ehEveryone ? piso : aplicarPar(piso, servidor.cargos[alvo], bit);
  const permitido = ehEveryone ? noServidor : aplicarPar(noServidor, canal.padrao, bit);

  let origem = "servidor";
  if (!ehEveryone && canal.padrao && estadoDe(canal.padrao, bit) !== "herdar") {
    origem = "@everyone";
  } else if (
    categoria &&
    estadoDe(overrideDoAlvo(categoria.conjunto, alvo), bit) === "herdar"
  ) {
    origem = categoria.titulo;
  }
  return { origem, permitido };
}

/** A sub-linha da matriz, na palavra do design. */
export function procedencia(
  estado: Estado,
  h: { readonly origem: string; readonly permitido: boolean },
): string {
  if (estado === "negar") return "Negado neste canal";
  if (estado === "permitir") return "Permitido explicitamente";
  return `Herdando de ${h.origem} · ${h.permitido ? "permitido" : "negado"}`;
}
