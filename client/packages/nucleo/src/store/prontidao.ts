/**
 * O app já recebeu o `Ready` desta sessão?
 *
 * Antes dele, servidores, canais e quem está em cada sala simplesmente ainda não
 * chegaram: a interface mostra esqueleto, e não "nenhum servidor". Booleano,
 * então estável por valor.
 */
let pronto = false;
const ouvintes = new Set<() => void>();

export function assinarProntidao(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export const lerProntidao = (): boolean => pronto;

export function definirProntidao(valor: boolean): void {
  if (pronto === valor) return;
  pronto = valor;
  for (const o of ouvintes) o();
}
