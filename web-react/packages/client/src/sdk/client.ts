/**
 * A instância do SDK.
 *
 * `new Client()` NÃO conecta — a conexão só acontece em `connect()`/login. Isso
 * é o que permite o spike rodar contra o SDK de verdade, com hidratação e
 * reatividade reais, sem backend e sem rede.
 */
import { Client, ConnectionState } from "stoat.js";

import { estaSilenciado } from "../store/silencio";
import { API_URL } from "./config";

export const client = new Client({
  /*
    ⚠ **Isto faltava, e sem ele o app falava com `https://stoat.chat/api`** — o
    default do SDK, que é a instância pública do Stoat. Ver `sdk/config.ts`: o
    sintoma não era erro, era o app funcionando contra o servidor errado.
  */
  baseURL: API_URL,
  /*
    Silenciar é decisão do CLIENTE, e o SDK diz isso na forma da API: ele expõe
    `channel.muted` como uma pergunta que o app responde. Não há escrita para
    silenciar — o protocolo guarda em configuração de usuário, e o modelo
    delega.

    Ligar aqui é o que faz `channel.muted` valer em todo lugar que o SDK o
    consulta, em vez de o app ter uma segunda verdade paralela à do modelo.
  */
  channelIsMuted: (channel) => estaSilenciado(channel.id),
});

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
