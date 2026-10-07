/**
 * Pedidos à lista de mensagens vindos de fora dela.
 *
 * O composer não conhece o virtualizador, mas depois de enviar a lista tem de
 * ir ao fim mesmo que a pessoa estivesse lendo o histórico: quem acabou de
 * falar quer ver a própria fala. Um canal de comunicação mínimo, por canal e
 * sem estado — pedido sem lista montada se perde, e é o certo (ninguém espera).
 */
type Ouvinte = () => void;

const ouvintes = new Map<string, Set<Ouvinte>>();

export function aoPedirFim(canalId: string, ouvinte: Ouvinte): () => void {
  let set = ouvintes.get(canalId);
  if (!set) {
    set = new Set();
    ouvintes.set(canalId, set);
  }
  set.add(ouvinte);
  return () => {
    const atual = ouvintes.get(canalId);
    if (!atual) return;
    atual.delete(ouvinte);
    if (atual.size === 0) ouvintes.delete(canalId);
  };
}

export function pedirFimDaLista(canalId: string): void {
  for (const ouvinte of ouvintes.get(canalId) ?? []) ouvinte();
}

/* ------------------------------------------------------------------- salto */
/**
 * "Pular para a mensagem" (a citação de uma resposta, um permalink): a lista do
 * canal rola até o ID. Mesmo desenho do pedido de fim: sem lista montada, o
 * pedido se perde.
 */
type OuvinteDeSalto = (messageId: string) => void;

const saltos = new Map<string, Set<OuvinteDeSalto>>();

export function aoPedirSalto(canalId: string, ouvinte: OuvinteDeSalto): () => void {
  let set = saltos.get(canalId);
  if (!set) {
    set = new Set();
    saltos.set(canalId, set);
  }
  set.add(ouvinte);
  return () => {
    const atual = saltos.get(canalId);
    if (!atual) return;
    atual.delete(ouvinte);
    if (atual.size === 0) saltos.delete(canalId);
  };
}

export function pedirSalto(canalId: string, messageId: string): void {
  for (const ouvinte of saltos.get(canalId) ?? []) ouvinte(messageId);
}
