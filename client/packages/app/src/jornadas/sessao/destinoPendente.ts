/**
 * Para onde a pessoa ia quando teve de entrar antes.
 *
 * Um link de convite (`/convite/:codigo`) ou de autorização por QR (`/qr/:id`) é
 * aberto, muitas vezes, por quem ainda não tem sessão: cai na entrada, cria a conta
 * ou digita a senha e, só então, o app vale. Sem guardar o destino, o clique se
 * perde em silêncio e a pessoa teria de pedir o link de novo.
 *
 * O CONVITE fica no `localStorage`, com prazo de 24 horas: o fluxo comum é criar a
 * conta numa aba, abrir o link de confirmação do e-mail em OUTRA e entrar lá, e o
 * armazenamento da aba (`sessionStorage`) deixaria o convite para trás. O prazo
 * existe para um convite esquecido não reaparecer dias depois. O consumo é ÚNICO:
 * esquecer apaga do armazenamento, e as outras abas largam a cópia que tinham. Não é
 * segredo (o código de convite é público por natureza).
 *
 * O pedido de QR continua na aba: ele autoriza um login e só vale ali, com o código
 * de confirmação conferido por quem autoriza; não deve vazar para outra aba.
 *
 * Todo acesso a armazenamento é protegido: bloqueado, o destino vale até a página
 * recarregar.
 */

type Destino = { convite?: string; qr?: string };

/** Quanto um convite guardado espera por quem ainda está criando a conta. */
export const PRAZO_DO_CONVITE_MS = 24 * 60 * 60 * 1000;

const CHAVE_DO_CONVITE = "vortex.convite-pendente";
const CHAVE_DO_QR = "vortex.destino-pendente";

let atual: Destino | undefined;
let conviteAte = 0;
const ouvintes = new Set<() => void>();

function lerConviteGuardado(): { codigo: string; ate: number } | undefined {
  try {
    const bruto = localStorage.getItem(CHAVE_DO_CONVITE);
    if (!bruto) return undefined;
    const v = JSON.parse(bruto) as { codigo?: unknown; ate?: unknown };
    if (typeof v.codigo !== "string" || typeof v.ate !== "number") return undefined;
    if (v.ate <= Date.now()) {
      try {
        localStorage.removeItem(CHAVE_DO_CONVITE);
      } catch {
        /* Só limpeza; o prazo é conferido na leitura de qualquer jeito. */
      }
      return undefined;
    }
    return { codigo: v.codigo, ate: v.ate };
  } catch {
    return undefined;
  }
}

function lerQr(): string | undefined {
  try {
    const bruto = sessionStorage.getItem(CHAVE_DO_QR);
    const v = bruto ? (JSON.parse(bruto) as Destino) : {};
    return typeof v.qr === "string" ? v.qr : undefined;
  } catch {
    return undefined;
  }
}

function montar(convite: string | undefined, qr: string | undefined): Destino {
  const d: Destino = {};
  if (convite !== undefined) d.convite = convite;
  if (qr !== undefined) d.qr = qr;
  return d;
}

function ler(): Destino {
  if (atual) {
    // Um convite em memória também vence: sessão longa não o ressuscita depois do prazo.
    if (atual.convite !== undefined && conviteAte <= Date.now()) {
      atual = montar(undefined, atual.qr);
      conviteAte = 0;
    }
    return atual;
  }
  const convite = lerConviteGuardado();
  conviteAte = convite?.ate ?? 0;
  atual = montar(convite?.codigo, lerQr());
  return atual;
}

function persistir(convite: string | undefined, qr: string | undefined): void {
  try {
    if (convite === undefined) localStorage.removeItem(CHAVE_DO_CONVITE);
    else localStorage.setItem(CHAVE_DO_CONVITE, JSON.stringify({ codigo: convite, ate: conviteAte }));
  } catch {
    /* Armazenamento bloqueado: o convite vale só até a página recarregar. */
  }
  try {
    if (qr === undefined) sessionStorage.removeItem(CHAVE_DO_QR);
    else sessionStorage.setItem(CHAVE_DO_QR, JSON.stringify({ qr }));
  } catch {
    /* Idem. */
  }
}

function gravar(convite: string | undefined, qr: string | undefined): void {
  // Objeto novo a cada mudança: `useSyncExternalStore` compara por referência.
  atual = montar(convite, qr);
  persistir(convite, qr);
  for (const o of ouvintes) o();
}

/** Outra aba guardou ou consumiu o convite: larga a cópia e avisa quem assina. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== CHAVE_DO_CONVITE && e.key !== null) return;
    atual = undefined;
    for (const o of ouvintes) o();
  });
}

export function assinarDestino(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerDestino(): Destino {
  return ler();
}

export function guardarConvite(codigo: string): void {
  const d = ler();
  if (d.convite === codigo) return;
  conviteAte = Date.now() + PRAZO_DO_CONVITE_MS;
  gravar(codigo, d.qr);
}

export function guardarPedidoDeQr(id: string): void {
  const d = ler();
  if (d.qr === id) return;
  gravar(d.convite, id);
}

export function esquecerConvite(): void {
  const d = ler();
  conviteAte = 0;
  gravar(undefined, d.qr);
}

export function esquecerPedidoDeQr(): void {
  gravar(ler().convite, undefined);
}

/** Estado limpo entre testes. */
export function limparDestino(): void {
  conviteAte = 0;
  gravar(undefined, undefined);
}

/** Só para teste: esquece a cópia em memória, como numa página recém-aberta. */
export function reabrirDestino(): void {
  atual = undefined;
  conviteAte = 0;
}
