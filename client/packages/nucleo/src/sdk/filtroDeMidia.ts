/**
 * `explicit_content_filter` — o campo do fork em `Server`.
 *
 * O `stoat.js` não o conhece: a hidratação de `Server` lista os campos que
 * sabe e descarta o resto. Então ele é lido do evento CRU, como `can_publish`
 * no adapter — `Ready` traz todos os servidores, `ServerCreate` o novo, e
 * `ServerUpdate` a mudança —, e escrito por `client.api` cru.
 */
import { client } from "./client";
import {
  definirPolitica,
  politicaDoProtocolo,
  politicaParaProtocolo,
  type PoliticaDeMidia,
} from "../store/filtroDeMidia";

type ServidorCru = { _id?: string; explicit_content_filter?: unknown };

type EventoCru = {
  type?: string;
  servers?: readonly ServidorCru[];
  server?: ServidorCru;
  id?: string;
  data?: { explicit_content_filter?: unknown };
};

/** Aplica um evento cru. Exposto para o teste; o socket chama por `ligar`. */
export function aplicarEventoDeFiltro(evento: unknown): void {
  const e = evento as EventoCru;
  if (e.type === "Ready" && e.servers) {
    for (const s of e.servers) {
      if (s._id) definirPolitica(s._id, politicaDoProtocolo(s.explicit_content_filter));
    }
  } else if (e.type === "ServerCreate" && e.server?._id) {
    definirPolitica(e.server._id, politicaDoProtocolo(e.server.explicit_content_filter));
  } else if (
    e.type === "ServerUpdate" &&
    e.id &&
    e.data &&
    "explicit_content_filter" in e.data
  ) {
    // Só quando o campo VEIO: uma atualização de nome não pode zerar o filtro.
    definirPolitica(e.id, politicaDoProtocolo(e.data.explicit_content_filter));
  }
}

let ligado = false;

export function ligarFiltroDeMidia(): void {
  if (ligado) return;
  ligado = true;
  client.events.on("event", aplicarEventoDeFiltro);
}

/**
 * Grava a política. O `ServerUpdate` que o servidor devolve pelo socket
 * confirma; quem chama aplica antes, de forma otimista, e desfaz na falha.
 */
export async function salvarPoliticaDeMidia(
  serverId: string,
  p: PoliticaDeMidia,
): Promise<void> {
  await client.api.patch(
    `/servers/${serverId}` as never,
    { explicit_content_filter: politicaParaProtocolo(p) } as never,
  );
}
