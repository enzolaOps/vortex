import { File as ArquivoDoProtocolo } from "stoat.js";

import { toast } from "../components/ui/toastStore";
import {
  definirExibeTag,
  definirPerfilDoServidor,
  definirQuemExibeTag,
  esquecerServidor,
  lerPerfilDoServidor,
  type PerfilDoServidor,
} from "../store/perfilDoServidor";
import { usuarioLocalId } from "./adapter";
import { subirAnexo } from "./anexos";
import { client, conectado } from "./client";
import { motivoDoErro } from "./erros";

/**
 * Tag, emblema e características do servidor — a camada anticorrupção.
 *
 * ⚠ **Nada disto existe no Stoat.** São campos do fork do serviço `api`
 * (`Server.tag`, `Server.tag_badge`, `Server.characteristics`,
 * `Member.show_tag`), aditivos: um servidor Stoat de fábrica simplesmente não
 * os envia, e esta camada devolve "sem tag, sem características" — que é a
 * verdade sobre aquele servidor.
 *
 * ⚠ **O `stoat.js` os DESCARTA na hidratação**, e o submodule é pinado. Então
 * a leitura vem por dois caminhos que o SDK não filtra:
 *
 * 1. O evento CRU (`client.events.on("event")`) — `Ready`, `ServerCreate` e
 *    `ServerUpdate` carregam os campos do servidor; `ServerMemberUpdate`
 *    carrega a escolha de alguém ligar ou desligar a tag.
 * 2. `GET /servers/:id/tag`, para saber quem JÁ exibia: membro hidratado pelo
 *    SDK chega sem o campo, e esperar cada pessoa alternar de novo deixaria a
 *    tag invisível até lá.
 */

/** Um arquivo do protocolo, na forma crua do fio. */
type ArquivoCru = { _id: string; tag: string };

type ServidorCru = {
  _id?: string;
  tag?: string;
  tag_badge?: ArquivoCru;
  characteristics?: string[];
};

type EventoCru = {
  type?: string;
  id?: string | { server?: string; user?: string };
  user?: string;
  servers?: ServidorCru[];
  server?: ServidorCru;
  data?: ServidorCru & { show_tag?: boolean };
  clear?: string[];
  members?: { _id?: { server?: string; user?: string }; show_tag?: boolean }[];
};

/**
 * O endereço do emblema. Injetável porque o teste não tem `autumn`.
 *
 * `createFileURL()` do SDK e não a URL montada aqui: o endereço do servidor de
 * mídia vem da configuração que o SDK buscou, e montá-lo à mão seria a forma
 * do protocolo vazando para cá duas vezes.
 */
export type UrlDeArquivo = (arquivo: ArquivoCru) => string | undefined;

const urlPeloSdk: UrlDeArquivo = (arquivo) =>
  new ArquivoDoProtocolo(client, arquivo as never).createFileURL();

/** Normaliza a tag lida do fio — ausente, vazia ou fora da forma vira nada. */
function tagValida(tag: unknown): string | undefined {
  return typeof tag === "string" && /^[A-Z0-9]{2,4}$/.test(tag) ? tag : undefined;
}

function caracteristicasValidas(lista: unknown): readonly string[] {
  return Array.isArray(lista)
    ? lista.filter((c): c is string => typeof c === "string").slice(0, 5)
    : [];
}

function lerServidorInteiro(s: ServidorCru, url: UrlDeArquivo): void {
  if (!s._id) return;
  definirPerfilDoServidor(s._id, {
    tag: tagValida(s.tag),
    emblemaUrl: s.tag_badge ? url(s.tag_badge) : undefined,
    caracteristicas: caracteristicasValidas(s.characteristics),
  });
}

/**
 * Aplica um evento cru ao store e devolve os servidores cuja lista de quem
 * exibe a tag precisa ser buscada.
 *
 * Pura exceto pelo store — é o que o teste exercita, sem socket.
 */
export function aplicarEventoDePerfil(
  evento: unknown,
  url: UrlDeArquivo = urlPeloSdk,
): readonly string[] {
  const e = evento as EventoCru;
  const buscar: string[] = [];

  switch (e.type) {
    case "Ready": {
      for (const s of e.servers ?? []) {
        lerServidorInteiro(s, url);
        if (s._id && tagValida(s.tag)) buscar.push(s._id);
      }
      /* A MINHA escolha vem inteira no `Ready`: `members` são as minhas
         participações. A dos outros vem da rota. */
      for (const m of e.members ?? []) {
        if (m._id?.server && m._id.user) {
          definirExibeTag(m._id.server, m._id.user, m.show_tag === true);
        }
      }
      break;
    }
    case "ServerCreate": {
      if (e.server) {
        lerServidorInteiro(e.server, url);
        if (e.server._id && tagValida(e.server.tag)) buscar.push(e.server._id);
      }
      break;
    }
    case "ServerUpdate": {
      if (typeof e.id !== "string") break;
      const serverId = e.id;
      const data = e.data ?? {};
      const clear = e.clear ?? [];
      const mudanca: { -readonly [K in keyof PerfilDoServidor]?: PerfilDoServidor[K] } = {};

      if (clear.includes("Tag")) mudanca.tag = undefined;
      else if ("tag" in data) mudanca.tag = tagValida(data.tag);

      if (clear.includes("TagBadge")) mudanca.emblemaUrl = undefined;
      else if (data.tag_badge) mudanca.emblemaUrl = url(data.tag_badge);

      if ("characteristics" in data) {
        mudanca.caracteristicas = caracteristicasValidas(data.characteristics);
      }

      const tinha = lerPerfilDoServidor(serverId).tag;
      definirPerfilDoServidor(serverId, mudanca);
      /* Tag nova num servidor que não tinha: quem já tinha ligado a exibição
         antes (numa tag anterior) volta a aparecer, e só a rota sabe quem. */
      if (tinha === undefined && mudanca.tag !== undefined) buscar.push(serverId);
      break;
    }
    case "ServerDelete": {
      if (typeof e.id === "string") esquecerServidor(e.id);
      break;
    }
    case "ServerMemberUpdate": {
      if (typeof e.id !== "object") break;
      const { server, user } = e.id;
      if (server && user && typeof e.data?.show_tag === "boolean") {
        definirExibeTag(server, user, e.data.show_tag);
      }
      break;
    }
    case "ServerMemberLeave": {
      /* Quem sai deixa de exibir — senão voltar ao servidor mostraria a tag
         antes de a pessoa escolher de novo. */
      if (typeof e.id === "string" && e.user) definirExibeTag(e.id, e.user, false);
      break;
    }
  }

  return buscar;
}

/** Busca quem exibe a tag. Falha é silenciosa: a tag some, nada quebra. */
export async function carregarQuemExibeTag(serverId: string): Promise<void> {
  try {
    const r = (await client.api.get(`/servers/${serverId}/tag` as never)) as {
      members?: unknown;
    };
    const ids = Array.isArray(r.members)
      ? r.members.filter((x): x is string => typeof x === "string")
      : [];
    definirQuemExibeTag(serverId, ids);
  } catch {
    /* Servidor Stoat sem o fork responde 404 aqui, e é normal: sem a rota,
       ninguém exibe tag. */
  }
}

let instalado = false;

/** Liga o ouvinte do evento cru. Idempotente. */
export function instalarPerfilDoServidor(): void {
  if (instalado) return;
  instalado = true;
  client.events.on("event", (evento: unknown) => {
    for (const serverId of aplicarEventoDePerfil(evento)) {
      void carregarQuemExibeTag(serverId);
    }
  });
}

/* ------------------------------------------------------------- escrita */

async function editarServidor(
  serverId: string,
  corpo: Record<string, unknown>,
  falha: string,
): Promise<boolean> {
  if (!conectado()) {
    toast({ tipo: "erro", titulo: falha, descricao: "Sem conexão." });
    return false;
  }
  try {
    const r = await client.api.patch(`/servers/${serverId}` as never, corpo as never);
    /* A resposta é o servidor inteiro: aplicar já, sem esperar o
       `ServerUpdate` do socket, faz a tela não piscar entre salvar e ver. */
    lerServidorInteiro(r as ServidorCru, urlPeloSdk);
    return true;
  } catch (e) {
    toast({ tipo: "erro", titulo: falha, descricao: motivoDoErro(e) });
    return false;
  }
}

/** `undefined` apaga a tag. */
export function salvarTagDoServidor(
  serverId: string,
  tag: string | undefined,
): Promise<boolean> {
  return editarServidor(
    serverId,
    tag === undefined ? { remove: ["Tag"] } : { tag },
    "Não deu para salvar a tag.",
  );
}

export async function enviarEmblemaDaTag(
  serverId: string,
  arquivo: File,
): Promise<boolean> {
  let id: string;
  try {
    id = await subirAnexo(arquivo, "icons");
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para enviar o emblema.",
      descricao: e instanceof Error ? e.message : undefined,
    });
    return false;
  }
  return editarServidor(
    serverId,
    { tag_badge: id },
    "Não deu para pôr o emblema.",
  );
}

export function removerEmblemaDaTag(serverId: string): Promise<boolean> {
  return editarServidor(
    serverId,
    { remove: ["TagBadge"] },
    "Não deu para remover o emblema.",
  );
}

export function salvarCaracteristicas(
  serverId: string,
  caracteristicas: readonly string[],
): Promise<boolean> {
  return editarServidor(
    serverId,
    { characteristics: caracteristicas },
    "Não deu para salvar as características.",
  );
}

/** Liga ou desliga a MINHA tag neste servidor. */
export async function exibirMinhaTag(
  serverId: string,
  exibe: boolean,
): Promise<boolean> {
  const eu = usuarioLocalId();
  if (eu === undefined || !conectado()) return false;
  try {
    await client.api.patch(
      `/servers/${serverId}/members/${eu}` as never,
      { show_tag: exibe } as never,
    );
    definirExibeTag(serverId, eu, exibe);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para mudar a tag.",
      descricao: motivoDoErro(e),
    });
    return false;
  }
}
