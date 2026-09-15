/**
 * O filtro de mídia explícita — a POLÍTICA de cada servidor, e o que esta aba
 * já decidiu mostrar.
 *
 * ⚠ **A política é do servidor; a análise é deste cliente.** O fork guarda
 * `explicit_content_filter` no servidor (quem administra escolhe, todo mundo
 * recebe), e nenhum pixel passa por lá: num Raspberry Pi, classificar cada
 * imagem enviada custaria CPU que o chat ao vivo divide, e o serviço que
 * recebe o upload (`autumn`) nem é publicado por este fork. Ver o PR.
 *
 * ⚠ **Sem analisador, "verificar" quer dizer "esconder até alguém decidir".**
 * O modelo de classificação não entrou nesta rodada (ele é uma dependência de
 * alguns MB que precisa da própria justificativa), então a mídia coberta pela
 * política chega VELADA, com um botão para mostrar. É o default seguro: a
 * alternativa — mostrar tudo até existir o modelo — faria o controle da página
 * de Segurança prometer uma proteção que não acontece.
 *
 * Store keyed por servidor: trocar a política de um servidor acorda só as
 * mídias daquele servidor.
 */

export type PoliticaDeMidia = "nao" | "semCargo" | "todos";

type Ouvinte = () => void;

const politicas = new Map<string, PoliticaDeMidia>();
const ouvintesDePolitica = new Map<string, Set<Ouvinte>>();

/** A forma do protocolo → o vocabulário do app. Desconhecido é "não". */
export function politicaDoProtocolo(valor: unknown): PoliticaDeMidia {
  if (valor === "MembersWithoutRoles") return "semCargo";
  if (valor === "AllMembers") return "todos";
  return "nao";
}

export function politicaParaProtocolo(p: PoliticaDeMidia): string {
  return p === "semCargo" ? "MembersWithoutRoles" : p === "todos" ? "AllMembers" : "Disabled";
}

export function lerPolitica(serverId: string): PoliticaDeMidia {
  return politicas.get(serverId) ?? "nao";
}

/*
  A função de assinatura é CACHEADA por chave: `useSyncExternalStore` compara a
  referência, e uma função nova a cada render desfaria e refaria a assinatura
  em todo render de toda mídia.
*/
const assinantesDePolitica = new Map<string, (o: Ouvinte) => () => void>();
const assinantesDeRevelado = new Map<string, (o: Ouvinte) => () => void>();

export function assinarPolitica(serverId: string) {
  const pronto = assinantesDePolitica.get(serverId);
  if (pronto) return pronto;
  const nova = (ouvinte: Ouvinte): (() => void) => {
    let conjunto = ouvintesDePolitica.get(serverId);
    if (!conjunto) {
      conjunto = new Set();
      ouvintesDePolitica.set(serverId, conjunto);
    }
    conjunto.add(ouvinte);
    return () => {
      conjunto.delete(ouvinte);
      if (conjunto.size === 0) ouvintesDePolitica.delete(serverId);
    };
  };
  assinantesDePolitica.set(serverId, nova);
  return nova;
}

export function definirPolitica(serverId: string, p: PoliticaDeMidia): void {
  if (lerPolitica(serverId) === p) return;
  if (p === "nao") politicas.delete(serverId);
  else politicas.set(serverId, p);
  for (const o of ouvintesDePolitica.get(serverId) ?? []) o();
}

/**
 * A mídia deste autor precisa passar pelo filtro?
 *
 * Quem enviou nunca vê a própria mídia velada: não há de quem protegê-la.
 */
export function precisaVerificar(
  p: PoliticaDeMidia,
  cargosDoAutor: readonly string[] | undefined,
  autorEhVoce: boolean,
): boolean {
  if (p === "nao" || autorEhVoce) return false;
  if (p === "todos") return true;
  return (cargosDoAutor?.length ?? 0) === 0;
}

/* ---------------------------------------------------------- revelados */

/*
  O que esta aba já decidiu mostrar, por anexo.

  Só na memória, de propósito: "mostrar" é uma decisão sobre UMA imagem, agora.
  Persistir faria a escolha de ontem valer para quem sentar no computador hoje.
*/
const revelados = new Set<string>();
const ouvintesDeRevelado = new Map<string, Set<Ouvinte>>();

export function estaRevelado(anexoId: string): boolean {
  return revelados.has(anexoId);
}

export function assinarRevelado(anexoId: string) {
  const pronto = assinantesDeRevelado.get(anexoId);
  if (pronto) return pronto;
  const nova = (ouvinte: Ouvinte): (() => void) => {
    let conjunto = ouvintesDeRevelado.get(anexoId);
    if (!conjunto) {
      conjunto = new Set();
      ouvintesDeRevelado.set(anexoId, conjunto);
    }
    conjunto.add(ouvinte);
    return () => {
      conjunto.delete(ouvinte);
      if (conjunto.size === 0) {
        ouvintesDeRevelado.delete(anexoId);
        // Anexo sai da tela e o cache de assinante sai junto: sem teto, ele
        // cresceria com toda mídia que a sessão de 8 h rolou.
        assinantesDeRevelado.delete(anexoId);
      }
    };
  };
  assinantesDeRevelado.set(anexoId, nova);
  return nova;
}

export function revelar(anexoId: string): void {
  if (revelados.has(anexoId)) return;
  revelados.add(anexoId);
  for (const o of ouvintesDeRevelado.get(anexoId) ?? []) o();
}

/** Estado limpo entre testes. */
export function limparFiltroDeMidia(): void {
  politicas.clear();
  revelados.clear();
}
