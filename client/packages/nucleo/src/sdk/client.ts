/**
 * A instância do SDK.
 *
 * `new Client()` NÃO conecta — a conexão só acontece em `connect()`/login. Isso
 * é o que permite o spike rodar contra o SDK de verdade, com hidratação e
 * reatividade reais, sem backend e sem rede.
 */
import { Client, ConnectionState } from "stoat.js";

import { estaMudo } from "../store/silencio";
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
  channelIsMuted: (channel) => estaMudo(channel.id, channel.serverId),
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

/**
 * "Tentar agora" — religar sem esperar o próximo passo do backoff.
 *
 * `client.connect()` limpa o timer de reconexão pendente e abre o socket na
 * hora, então ele serve às duas entradas: sair de uma pausa e encurtar uma
 * espera que já está em minutos (o `retryDelayFunction` do SDK cresce).
 *
 * ⚠ **`autoReconnect` volta a `true` aqui**, senão uma pausa anterior deixaria
 * esta tentativa ser a ÚLTIMA — ela falharia e nada mais tentaria, com a faixa
 * dizendo "reconectando" para sempre.
 *
 * ⚠ **Sem sessão não há o que reconectar**, e o SDK lança ao montar a URL: o
 * guarda é estreito de propósito, porque o caminho normal até aqui é um botão
 * numa faixa que só existe depois de a sessão ter funcionado uma vez.
 */
export function reconectarAgora(): void {
  if (client.sessionId === undefined) return;
  client.options.autoReconnect = true;
  client.connect();
}

/**
 * "Cancelar" — parar de tentar.
 *
 * Existe porque o backoff do SDK é infinito: num avião, num túnel ou com o
 * servidor fora, o app fica abrindo socket para sempre, e quem está lendo o
 * histórico em cache não tem como dizer "deixa pra lá".
 *
 * ⚠ **Desligar `autoReconnect` ANTES de desconectar**, porque é o handler de
 * `Disconnected` que agenda o próximo — na ordem inversa a pausa agendaria
 * uma tentativa e só depois se desligaria, ou seja o cancelar cancelaria tudo
 * menos a próxima.
 */
export function pausarReconexao(): void {
  client.options.autoReconnect = false;
  client.events.disconnect();
}
