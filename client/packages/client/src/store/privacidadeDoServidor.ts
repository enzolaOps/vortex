/**
 * Privacidade POR SERVIDOR.
 *
 * O protocolo Stoat não tem o conceito; ele mora em `UserSettings`, na chave
 * `vortex:privacidadeDoServidor`, sincronizada como as outras preferências.
 * O que cada campo FAZ hoje, e onde:
 *
 * - `filtro` — no cliente: `list/MidiaFiltrada.tsx` soma-o à política de mídia
 *   do servidor. É decisão de quem vê, e é o cliente de quem vê que a aplica.
 * - `dm` e `permitirAmizade` — no `delta`, que LÊ esta chave do destinatário e
 *   recusa conversa nova e pedido de amizade quando o único vínculo entre as
 *   duas pessoas são servidores que dizem não
 *   (`server/crates/core/database/src/util/privacidade_do_servidor.rs`). O
 *   cliente também desvia para a fila de solicitações a DM que já existia.
 * - `mostrarPresenca` — PENDENTE: presença por servidor precisa do `bonfire`
 *   (`pendente/pendencias.ts`, `presencaPorServidor`).
 * - `mostrarAtividade` — sem efeito e fora do modal: o protocolo não tem
 *   atividade de jogo. O campo fica pelo formato já gravado.
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
  ⚠ **O padrão é CONSERVADOR, e diverge do design de propósito.** O design
  marca "só quem compartilha cargo" e "filtrar de quem não é amigo". Enquanto
  a preferência não fazia nada, o padrão era só desenho; agora que ela barra DM
  no servidor e vela mídia, esse padrão mudaria o comportamento de quem nunca
  abriu este modal — conversas deixariam de abrir e imagens passariam a chegar
  cobertas, sem ninguém ter escolhido isso. Quem nunca mexeu mantém o de antes:
  DM de qualquer membro, mídia sem filtro pessoal.

  `mostrarAtividade` começa desligado: "o que você está jogando" é dado que
  ninguém pediu para publicar.
*/
export const PADRAO: PrivacidadeDoServidor = {
  dm: "todos",
  filtro: "nao",
  mostrarPresenca: true,
  mostrarAtividade: false,
  permitirAmizade: true,
};

import { avisarSync } from "./sync";

const CHAVE = "vortex:privacidadeDoServidor";

/*
  ⚠ **Versão 2 existe por causa do padrão antigo.** Todo cliente sobe o
  snapshot da chave quando ela falta no servidor, então quem nunca abriu o
  modal JÁ tem gravado `padrao: {dm: "cargoComum", filtro: "deNaoAmigos"}` — o
  padrão de fábrica de antes, não uma escolha. Sem distinguir, o `delta` passaria
  a barrar DM dessas contas. Formato sem versão é lido com a migração abaixo, e
  o servidor o IGNORA inteiro (mesma regra em Rust).
*/
const VERSAO = 2;

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

/*
  Legado: os dois valores de fábrica antigos viram os conservadores. Quem
  escolheu "cargoComum" de fato perde a escolha — que nunca teve efeito
  nenhum, e por isso não há o que quebrar.
*/
function migrarLegado(e: PrivacidadeDoServidor): PrivacidadeDoServidor {
  return {
    ...e,
    dm: e.dm === "cargoComum" ? "todos" : e.dm,
    filtro: e.filtro === "deNaoAmigos" ? "nao" : e.filtro,
  };
}

function carregarDe(cru: string): {
  padrao: PrivacidadeDoServidor;
  porServidor: Map<string, PrivacidadeDoServidor>;
} {
  try {
    const o: unknown = JSON.parse(cru);
    if (typeof o !== "object" || o === null) {
      return { padrao: PADRAO, porServidor: new Map() };
    }
    const r = o as Record<string, unknown>;
    const atual = r.versao === VERSAO;
    const ajustar = (e: PrivacidadeDoServidor) => (atual ? e : migrarLegado(e));
    const lido = entrada(r.padrao);
    const padraoLido = lido ? ajustar(lido) : PADRAO;
    const mapa = new Map<string, PrivacidadeDoServidor>();
    if (typeof r.porServidor === "object" && r.porServidor !== null) {
      for (const [id, valor] of Object.entries(
        r.porServidor as Record<string, unknown>,
      )) {
        const e = entrada(valor);
        if (e) mapa.set(id, ajustar(e));
      }
    }
    return {
      padrao: igualAoPadrao(padraoLido) ? PADRAO : padraoLido,
      porServidor: mapa,
    };
  } catch {
    return { padrao: PADRAO, porServidor: new Map() };
  }
}

function carregar(): {
  padrao: PrivacidadeDoServidor;
  porServidor: Map<string, PrivacidadeDoServidor>;
} {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return { padrao: PADRAO, porServidor: new Map() };
    return carregarDe(cru);
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

/* Referência estável para o default: `lerPrivacidadeDoServidor` depende dela. */
function igualAoPadrao(e: PrivacidadeDoServidor): boolean {
  return (
    e.dm === PADRAO.dm &&
    e.filtro === PADRAO.filtro &&
    e.mostrarPresenca === PADRAO.mostrarPresenca &&
    e.mostrarAtividade === PADRAO.mostrarAtividade &&
    e.permitirAmizade === PADRAO.permitirAmizade
  );
}

export function exportarPrivacidadeDoServidor(): string {
  return JSON.stringify({
    versao: VERSAO,
    padrao,
    porServidor: Object.fromEntries(porServidor),
  });
}

function serializar(): string {
  return exportarPrivacidadeDoServidor();
}

function persistir(): void {
  try {
    localStorage.setItem(CHAVE, serializar());
  } catch {
    /* vale nesta aba */
  }
  avisarSync("vortex:privacidadeDoServidor", serializar());
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

/** Troca o mapa inteiro — hidratação vinda do servidor. */
export function hidratarPrivacidadeDoServidor(cru: string): void {
  const lido = carregarDe(cru);
  porServidor.clear();
  for (const [id, valor] of lido.porServidor) porServidor.set(id, valor);
  padrao = lido.padrao;
  persistir();
  for (const o of ouvintes) o();
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

/* ------------------------------------------------------- regras puras */

/**
 * Esta escolha deixa alguém deste servidor abrir DM?
 *
 * `compartilhaCargo` é pergunta que só quem tem os dois membros responde; por
 * isso chega pronta. O mesmo critério roda no `delta`.
 */
export function aceitaDm(
  p: PrivacidadeDoServidor,
  compartilhaCargo: boolean,
): boolean {
  if (p.dm === "todos") return true;
  if (p.dm === "ninguem") return false;
  return compartilhaCargo;
}

/**
 * A privacidade restringe o contato com alguém?
 *
 * ⚠ **Só quando TODOS os servidores em comum dizem não.** Basta um que deixe
 * para haver vínculo legítimo — é o que "vale só aqui, não é global" promete.
 * Sem servidor em comum a preferência por servidor não se aplica, e
 * `undefined` (não deu para saber) não restringe: desviar uma conversa por
 * dado que não chegou seria afirmar algo que ninguém sabe.
 */
export function privacidadeRestringe(
  servidoresEmComum: readonly string[] | undefined,
  permite: (serverId: string) => boolean,
): boolean {
  if (!servidoresEmComum || servidoresEmComum.length === 0) return false;
  return servidoresEmComum.every((id) => !permite(id));
}

/**
 * Alguma escolha restringe DM? Barato, e é o que evita buscar servidores em
 * comum na rede para quem nunca mexeu neste modal.
 */
export function algumaRestricaoDeDm(): boolean {
  if (padrao.dm !== "todos") return true;
  for (const p of porServidor.values()) if (p.dm !== "todos") return true;
  return false;
}
