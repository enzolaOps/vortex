import { chaveVapid, enviarInscricao, removerInscricao } from "../sdk/push";
import { definirNotificacoes, lerNotificacoes } from "../store/notificacoes";
import { ponteDeNotificacoes } from "./notificador";

/**
 * Web Push — a metade do NAVEGADOR: service worker, permissão e inscrição.
 *
 * "Notificações push no celular" do design. Com o app fechado não há socket,
 * e o único jeito de uma menção chegar é o servidor (`pushd`) empurrar pelo
 * serviço de push do navegador até um service worker que acorda sozinho.
 *
 * ⚠ **O interruptor mostra o estado REAL, não a preferência.** A preferência
 * `push` guarda a INTENÇÃO (e decide se a abertura do app reinscreve sem
 * perguntar); o que a tela desenha é `EstadoDoPush`. Um interruptor aceso com
 * a permissão negada, ou sem service worker, afirmaria uma entrega que não
 * acontece — o defeito que o registro de pendências existe para não cometer.
 */

export type EstadoDoPush =
  /** Navegador sem `PushManager`, ou a casca Electron (ver `pushDisponivel`). */
  | "indisponivel"
  | "desligado"
  | "ligando"
  | "ligado"
  /** A pessoa negou a permissão — só as configurações do site desfazem. */
  | "bloqueado"
  /** A instância não tem VAPID, ou o servidor recusou a inscrição. */
  | "erro";

let estado: EstadoDoPush = "desligado";
const ouvintes = new Set<() => void>();

function definir(novo: EstadoDoPush): void {
  if (estado === novo) return;
  estado = novo;
  for (const o of ouvintes) o();
}

export function assinarPush(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerPush(): EstadoDoPush {
  return pushDisponivel() ? estado : "indisponivel";
}

/**
 * Há como receber push aqui?
 *
 * ⚠ **Na casca Electron, não — e ela nem precisa.** O Chromium do Electron não
 * tem o serviço de push do Google embutido, então `subscribe` falha; e a casca
 * fica na bandeja com o socket aberto, entregando pela `Notification` comum.
 * Oferecer o interruptor ali seria pedir uma permissão para nada.
 */
export function pushDisponivel(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    typeof window !== "undefined" &&
    "PushManager" in window &&
    typeof Notification !== "undefined" &&
    ponteDeNotificacoes() === undefined
  );
}

/** base64url (sem preenchimento) → bytes, para `applicationServerKey`. */
export function base64UrlParaBytes(texto: string): Uint8Array<ArrayBuffer> {
  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const cheio = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binario = atob(cheio);
  const bytes = new Uint8Array(new ArrayBuffer(binario.length));
  for (let i = 0; i < binario.length; i += 1) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * bytes → base64url sem preenchimento — a forma que o `pushd` decodifica
 * (`URL_SAFE_NO_PAD`). Com `+`, `/` ou `=` o servidor aceita a inscrição e
 * falha na hora de ENVIAR, em silêncio, no primeiro push.
 */
export function bytesParaBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  let binario = "";
  for (const b of new Uint8Array(buffer)) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const CAMINHO_DO_SW = "/sw.js";

async function registro(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(CAMINHO_DO_SW);
  return navigator.serviceWorker.ready;
}

async function inscrever(): Promise<void> {
  const chave = await chaveVapid();
  if (!chave) throw new Error("instância sem VAPID");
  const reg = await registro();
  const inscricao =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(chave),
    }));
  await enviarInscricao({
    endpoint: inscricao.endpoint,
    p256dh: bytesParaBase64Url(inscricao.getKey("p256dh")),
    auth: bytesParaBase64Url(inscricao.getKey("auth")),
  });
}

/**
 * Liga — pedindo a permissão se ainda não foi pedida.
 *
 * Só chamada por CLIQUE: o navegador ignora (e alguns punem) pedido de
 * permissão fora de gesto humano.
 */
export async function ligarPush(): Promise<void> {
  if (!pushDisponivel()) return;
  definir("ligando");
  const permissao =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (permissao !== "granted") {
    definir(permissao === "denied" ? "bloqueado" : "desligado");
    return;
  }
  try {
    await inscrever();
    definirNotificacoes({ push: true });
    definir("ligado");
  } catch {
    definir("erro");
  }
}

export async function desligarPush(): Promise<void> {
  definirNotificacoes({ push: false });
  if (!pushDisponivel()) return;
  definir("desligado");
  try {
    const reg = await navigator.serviceWorker.getRegistration(CAMINHO_DO_SW);
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* Inscrição que não sai daqui ainda sai do servidor, logo abaixo. */
  }
  try {
    await removerInscricao();
  } catch {
    /* Sem rede: a sessão continua inscrita até o próximo desligar. */
  }
}

/**
 * Na abertura da sessão: reinscreve quem já tinha ligado, SEM perguntar nada.
 *
 * ⚠ Reinscrever a cada `Ready` não é desperdício: a inscrição é da SESSÃO no
 * servidor, e entrar de novo cria sessão nova sem inscrição nenhuma. Sem isto,
 * sair e entrar desligaria o push em silêncio com o interruptor aceso.
 */
export async function sincronizarPush(): Promise<void> {
  if (!pushDisponivel()) return;
  if (!lerNotificacoes().push || Notification.permission !== "granted") {
    definir(Notification.permission === "denied" ? "bloqueado" : "desligado");
    return;
  }
  try {
    await inscrever();
    definir("ligado");
  } catch {
    definir("erro");
  }
}

/**
 * O clique numa notificação do service worker, dentro da aba que já existe.
 *
 * O worker manda o CAMINHO; aplicá-lo como um `popstate` reusa o roteador
 * inteiro — servidor, canal e salto para a mensagem — em vez de uma segunda
 * tradução de URL que teria de concordar com a primeira.
 */
export function ouvirCliquesDoPush(): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return () => undefined;
  }
  const aoMensagem = (ev: MessageEvent<unknown>) => {
    const d = ev.data as { tipo?: string; caminho?: string } | null;
    if (d?.tipo !== "vortex:abrir" || typeof d.caminho !== "string") return;
    if (!d.caminho.startsWith("/")) return;
    window.history.pushState(null, "", d.caminho);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
  navigator.serviceWorker.addEventListener("message", aoMensagem);
  return () => navigator.serviceWorker.removeEventListener("message", aoMensagem);
}
