/**
 * Conversas favoritas — fixadas no topo da coluna da casa.
 *
 * ⚠ **Sem protocolo novo, e a razão foi medida antes de escolher.** O registro
 * de pendências dizia que guardar só no cliente daria "uma ordem que só esta
 * máquina enxerga". Verdade para `localStorage` sozinho; falsa com a
 * sincronização de configurações que o app já tem: `POST /sync/settings/set`
 * guarda qualquer chave `vortex:*` na CONTA, e `UserSettingsUpdate` a entrega
 * aos outros dispositivos. Favorito é preferência de quem lê — ninguém mais o
 * vê —, então a conta é exatamente o lugar, e um campo em `Channel` seria o
 * lugar errado: a DM é compartilhada entre as duas pessoas, o favorito não.
 *
 * `localStorage` continua como cache da abertura: sem ele a coluna abriria na
 * ordem de recência e pularia quando a sincronia chegasse.
 */

import { avisarSync } from "./sync";

const CHAVE = "vortex:favoritos";

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Na ordem em que foram marcados — a mais antiga fica em cima. */
let favoritos: readonly string[] = ler();

function ler(): readonly string[] {
  try {
    return deTexto(localStorage.getItem(CHAVE) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * JSON de `localStorage` ou da sincronia → lista de IDs.
 *
 * Os dois são editáveis de fora; qualquer coisa que não seja lista de strings
 * vira vazio, e string repetida entra uma vez.
 */
export function deTexto(texto: string): readonly string[] {
  try {
    const bruto: unknown = JSON.parse(texto);
    if (!Array.isArray(bruto)) return [];
    return [...new Set(bruto.filter((v): v is string => typeof v === "string"))];
  } catch {
    return [];
  }
}

export function assinarFavoritos(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência cacheada — armadilha nº 1. */
export function lerFavoritos(): readonly string[] {
  return favoritos;
}

export function ehFavorita(channelId: string): boolean {
  return favoritos.includes(channelId);
}

function gravar(novos: readonly string[]): void {
  favoritos = novos;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(novos));
  } catch {
    // Armazenamento bloqueado não derruba a sessão — ver `densidade.ts`.
  }
  avisarSync(CHAVE, JSON.stringify(novos));
  for (const o of [...ouvintes]) o();
}

export function alternarFavorita(channelId: string): void {
  gravar(
    ehFavorita(channelId)
      ? favoritos.filter((id) => id !== channelId)
      : [...favoritos, channelId],
  );
}

/** A sincronia chegou — `aplicarRemoto` em volta impede o eco. */
export function definirFavoritos(ids: readonly string[]): void {
  const iguais = ids.length === favoritos.length && ids.every((id, i) => id === favoritos[i]);
  if (iguais) return;
  gravar(ids);
}

/**
 * A ordem da coluna: favoritas primeiro (na ordem em que foram marcadas), o
 * resto na ordem que já veio — a de recência.
 *
 * Pura e ESTÁVEL: favorita que não é mais conversa (grupo de que saiu) é
 * ignorada sem sair da lista, para voltar ao lugar se a conversa voltar.
 */
export function ordenarComFavoritas(
  porRecencia: readonly string[],
  favoritas: readonly string[],
): readonly string[] {
  if (favoritas.length === 0) return porRecencia;
  const presentes = new Set(porRecencia);
  const topo = favoritas.filter((id) => presentes.has(id));
  const noTopo = new Set(topo);
  return [...topo, ...porRecencia.filter((id) => !noTopo.has(id))];
}

/** Estado limpo entre testes. */
export function limparFavoritos(): void {
  favoritos = [];
}
