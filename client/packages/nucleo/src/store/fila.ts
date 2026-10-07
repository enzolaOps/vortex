/**
 * As pendentes que a pessoa JÁ decidiu manter na fila.
 *
 * ⚠ **A decisão é o dado, e por isso ela existe.** "Enviar quando voltar" é o
 * que aconteceria de qualquer jeito — o valor do botão não é mudar o
 * comportamento, é DISPENSAR a pergunta. Sem guardar a escolha, as duas ações
 * ficariam na linha para sempre, e o design as desenha como uma decisão que se
 * toma uma vez.
 *
 * ⚠ **Store com assinatura, e NÃO um `Set` solto lido no render.** A primeira
 * versão era um `Set` no adapter, republicando o snapshot da mensagem para
 * acordar a linha — e não acordava: o snapshot é cacheado por conteúdo e
 * estado, e nenhum dos dois muda quando a escolha muda. A linha continuava
 * mostrando os dois botões depois do clique, sem erro nenhum. É a armadilha
 * nº 1 do briefing pela porta dos fundos: a fonte da verdade tinha de ser
 * observável, e não era.
 *
 * `useSyncExternalStore` sobre um BOOLEANO por ID: a linha compara por valor e
 * descarta o render quando nada mudou. Só as pendentes assinam, e pendente é
 * caso raro por construção.
 */

const confirmadas = new Set<string>();
const ouvintes = new Set<() => void>();

/**
 * Quantas mensagens estão esperando a rede, por canal.
 *
 * ⚠ **Duas estruturas e não uma, e a segunda é o que torna isto idempotente.**
 * `canalDePendente` diz de que canal é cada ID; sem ela, o adapter marcando a
 * mesma mensagem duas vezes (o caminho de envio passa por mais de um ponto)
 * contaria duas, e o rodapé do composer diria "2 mensagens na fila" com uma
 * só. Um contador que mente sobre o que foi escrito é pior que não ter
 * contador.
 *
 * Vive aqui e não no adapter porque é a mesma pergunta que o resto deste
 * módulo responde — "o que está esperando a rede?" — e porque o rodapé do
 * composer precisa de um store observável, exatamente pela razão registrada no
 * cabeçalho: o snapshot da mensagem não muda quando isto muda.
 */
const canalDePendente = new Map<string, string>();
const porCanal = new Map<string, number>();

export function assinarFila(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function confirmadaNaFila(id: string): boolean {
  return confirmadas.has(id);
}

export function confirmarNaFila(id: string): void {
  if (confirmadas.has(id)) return;
  confirmadas.add(id);
  for (const o of ouvintes) o();
}

/**
 * Esquece a decisão.
 *
 * Chamado ao descartar e ao reenviar: em nenhum dos dois casos a mensagem
 * continua na fila, e uma entrada que sobra é vazamento — o erro nº 5 do
 * briefing na sua forma mais barata de evitar.
 */
export function esquecerDaFila(id: string): void {
  const saiu = desmarcarPendente(id);
  if (!confirmadas.delete(id) && !saiu) return;
  for (const o of ouvintes) o();
}

/** Esta mensagem está esperando a rede, neste canal. */
export function marcarPendente(id: string, channelId: string): void {
  if (canalDePendente.get(id) === channelId) return;
  desmarcarPendente(id);
  canalDePendente.set(id, channelId);
  porCanal.set(channelId, (porCanal.get(channelId) ?? 0) + 1);
  for (const o of ouvintes) o();
}

/**
 * Esta mensagem não espera mais — enviou, falhou ou foi descartada.
 *
 * Devolve se havia o que tirar, para quem chama não emitir à toa.
 */
export function desmarcarPendente(id: string): boolean {
  const channelId = canalDePendente.get(id);
  if (channelId === undefined) return false;
  canalDePendente.delete(id);
  const restam = (porCanal.get(channelId) ?? 1) - 1;
  // Entrada zerada é vazamento: o número de canais que a sessão viu não tem
  // teto, e o erro nº 5 do briefing custa uma linha para não acontecer.
  if (restam > 0) porCanal.set(channelId, restam);
  else porCanal.delete(channelId);
  return true;
}

/** Quantas mensagens deste canal esperam a rede. Zero é o caso normal. */
export function lerPendentesDoCanal(channelId: string): number {
  return porCanal.get(channelId) ?? 0;
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparFila(): void {
  confirmadas.clear();
  canalDePendente.clear();
  porCanal.clear();
}
