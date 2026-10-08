import { pushDisponivel, ligarPush } from "./push";

/**
 * A permissão de avisos do sistema, e o convite para dá-la.
 *
 * ⚠ **Só por ação da pessoa.** O navegador ignora (e alguns punem) um pedido de
 * permissão feito sem gesto humano; por isso `pedirPermissao` só é chamada de um
 * clique, e nada neste módulo pede sozinho. O convite aparece na casa — onde
 * moram as mensagens diretas — e some para sempre quando a pessoa diz "agora não".
 *
 * O estado vem do `Notification.permission` do navegador, que é a fonte da
 * verdade: não existe cópia dele em preferência, porque a pessoa pode mudá-lo nas
 * configurações do site a qualquer momento.
 */
export type PermissaoDeAvisos = "indisponivel" | "pergunta" | "concedida" | "negada";

const CHAVE_DISPENSADO = "vortex:avisos-dispensados";

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();
let versao = 0;

function emitir(): void {
  versao += 1;
  for (const o of ouvintes) o();
}

export function lerPermissao(): PermissaoDeAvisos {
  if (typeof Notification === "undefined") return "indisponivel";
  const p = Notification.permission;
  return p === "granted" ? "concedida" : p === "denied" ? "negada" : "pergunta";
}

function lerDispensado(): boolean {
  try {
    return localStorage.getItem(CHAVE_DISPENSADO) === "1";
  } catch {
    return false;
  }
}

/** O convite aparece? Só enquanto a pergunta está em aberto e a pessoa não o dispensou. */
export function conviteVisivel(): boolean {
  return lerPermissao() === "pergunta" && !lerDispensado();
}

export function assinarPermissao(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/**
 * Um número que muda a cada mudança de estado: `useSyncExternalStore` pede um
 * snapshot comparável, e `conviteVisivel()` já é um booleano estável — este existe
 * para quem quer reagir a QUALQUER mudança (o aviso de "bloqueado" depois do pedido).
 */
export function versaoDaPermissao(): number {
  return versao;
}

export function dispensarConvite(): void {
  try {
    localStorage.setItem(CHAVE_DISPENSADO, "1");
  } catch {
    /* Sem armazenamento, o convite volta na próxima abertura — o lado seguro. */
  }
  emitir();
}

/**
 * Pede a permissão. Onde há Web Push (navegador comum) liga o push inteiro — que
 * já pede a permissão; na casca ou sem service worker pede só a permissão, que é
 * o que a `Notification` direta precisa para aparecer.
 */
export async function pedirPermissao(): Promise<PermissaoDeAvisos> {
  if (lerPermissao() === "indisponivel") return "indisponivel";
  try {
    if (pushDisponivel()) await ligarPush();
    else await Notification.requestPermission();
  } catch {
    /* Navegadores antigos lançam; o estado abaixo diz o que de fato valeu. */
  }
  emitir();
  return lerPermissao();
}
