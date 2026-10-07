import { client } from "./client";

/**
 * Web Push — a metade que fala com o SERVIDOR.
 *
 * O protocolo já tem as duas pontas: a chave pública VAPID vem na configuração
 * da instância (`GET /` → `vapid`) e a inscrição é da SESSÃO
 * (`POST /push/subscribe`, que troca a anterior). Quem envia é o `pushd`, com
 * a chave privada par desta. A metade do NAVEGADOR — service worker e
 * `PushManager` — mora em `notificacao/push.ts`, porque não é SDK.
 */

export type InscricaoDePush = {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
};

/**
 * A chave pública VAPID da instância, ou `undefined` se ela não tiver push.
 *
 * ⚠ **Pede a configuração se ela ainda não chegou.** O `Client` a busca no
 * construtor sem `await`; quem liga o interruptor logo depois de abrir o app
 * encontraria `configuration` vazio e concluiria "esta instância não tem
 * push", que é falso.
 */
export async function chaveVapid(): Promise<string | undefined> {
  const cfg: { vapid?: string } | undefined =
    client.configuration ??
    ((await client.api.get("/" as never)) as { vapid?: string } | undefined);
  const chave = cfg?.vapid;
  return chave ? chave : undefined;
}

export async function enviarInscricao(inscricao: InscricaoDePush): Promise<void> {
  await client.api.post("/push/subscribe" as never, inscricao as never);
}

export async function removerInscricao(): Promise<void> {
  await client.api.post("/push/unsubscribe" as never);
}
