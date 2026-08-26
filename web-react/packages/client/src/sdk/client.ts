/**
 * A instância do SDK.
 *
 * `new Client()` NÃO conecta — a conexão só acontece em `connect()`/login. Isso
 * é o que permite o spike rodar contra o SDK de verdade, com hidratação e
 * reatividade reais, sem backend e sem rede.
 */
import { Client, ConnectionState } from "stoat.js";

export const client = new Client();

/**
 * Há socket aberto?
 *
 * Existe porque `EventClient.send` LANÇA quando não há socket, e o app tem
 * caminhos de fire-and-forget — digitação, presença — que precisam ser
 * silenciosos quando a conexão cai, não fatais. Perguntar antes é melhor que
 * `try/catch` em volta: catch genérico engoliria erro de verdade junto.
 *
 * `state` é signal do Solid; ler aqui, dentro de `src/sdk/`, é o contrato do
 * adapter. Fora daqui ninguém sabe que Solid existe.
 */
export function conectado(): boolean {
  return client.events.state() === ConnectionState.Connected;
}
