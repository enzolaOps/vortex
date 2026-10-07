/**
 * Para onde a pessoa ia quando teve de entrar antes.
 *
 * Um link de convite (`/convite/:codigo`) ou de autorização por QR (`/qr/:id`) é
 * aberto, muitas vezes, por quem ainda não tem sessão: cai na entrada, cria a conta
 * ou digita a senha e, só então, o app vale. Sem guardar o destino, o clique se
 * perde em silêncio e a pessoa teria de pedir o link de novo.
 *
 * Fica no `sessionStorage` e não só na memória: dar F5 no meio da entrada não pode
 * apagar o convite. Não é segredo (o código de convite é público por natureza e o
 * id do pedido de QR só vale com o código de confirmação conferido por quem
 * autoriza), então o armazenamento da aba basta. Consumir apaga: abrir o app depois
 * não reabre um convite já visto.
 */

type Destino = { convite?: string; qr?: string };

const CHAVE = "vortex.destino-pendente";

let atual: Destino | undefined;
const ouvintes = new Set<() => void>();

function ler(): Destino {
  if (atual) return atual;
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    atual = bruto ? (JSON.parse(bruto) as Destino) : {};
  } catch {
    atual = {};
  }
  return atual;
}

function gravar(novo: Destino): void {
  // Objeto novo a cada mudança: `useSyncExternalStore` compara por referência.
  atual = novo;
  try {
    if (novo.convite === undefined && novo.qr === undefined) sessionStorage.removeItem(CHAVE);
    else sessionStorage.setItem(CHAVE, JSON.stringify(novo));
  } catch {
    /* Armazenamento bloqueado: o destino vale só até a página recarregar. */
  }
  for (const o of ouvintes) o();
}

export function assinarDestino(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerDestino(): Destino {
  return ler();
}

export function guardarConvite(codigo: string): void {
  if (ler().convite === codigo) return;
  gravar({ ...ler(), convite: codigo });
}

export function guardarPedidoDeQr(id: string): void {
  if (ler().qr === id) return;
  gravar({ ...ler(), qr: id });
}

export function esquecerConvite(): void {
  const resto: Destino = { ...ler() };
  delete resto.convite;
  gravar(resto);
}

export function esquecerPedidoDeQr(): void {
  const resto: Destino = { ...ler() };
  delete resto.qr;
  gravar(resto);
}

/** Estado limpo entre testes. */
export function limparDestino(): void {
  gravar({});
}
