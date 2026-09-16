import { toast } from "../components/ui/toastStore";
import { primeiroCanalDe } from "./adapter";
import { client } from "./client";
import { motivoDoErro } from "./erros";

/**
 * Link que dá cargo — a camada anticorrupção.
 *
 * ⚠ **Do fork do serviço `api`, e é um CONVITE com cargos.** O Stoat não tem
 * "link de atribuição"; o que o fork acrescenta é `Invite.roles` e um corpo
 * opcional `{roles}` em `POST /channels/{id}/invites`. Entrar por esse convite
 * aplica os cargos ANTES do evento de entrada, então a pessoa chega vendo os
 * canais que eles abrem.
 *
 * Por ser convite, ele leva a um CANAL (não existe convite de servidor no
 * protocolo) e aparece na página de Convites como qualquer outro — revogar
 * aqui ou lá é a mesma escrita.
 *
 * O servidor exige `AssignRoles` e cargo abaixo do seu, a mesma regra de dar
 * cargo a alguém: dar cargo por link é dar cargo.
 */

export type LinkDeCargo = {
  readonly codigo: string;
  readonly channelId: string;
  readonly criadorId: string;
};

/**
 * Os convites que dão este cargo, a partir da lista CRUA de convites.
 *
 * Crua porque `fetchInvites` do SDK hidrata `ServerChannelInvite` sem o campo
 * novo — `roles` morre ali. Convite de fábrica, sem `roles`, não é link de
 * cargo nenhum.
 */
export function linksDoCargo(convites: unknown, roleId: string): readonly LinkDeCargo[] {
  if (!Array.isArray(convites)) return [];
  return (
    convites as {
      type?: string;
      _id?: string;
      channel?: string;
      creator?: string;
      roles?: unknown;
    }[]
  )
    .filter(
      (c) =>
        c.type === "Server" &&
        typeof c._id === "string" &&
        Array.isArray(c.roles) &&
        c.roles.includes(roleId),
    )
    .map((c) => ({
      codigo: c._id as string,
      channelId: c.channel ?? "",
      criadorId: c.creator ?? "",
    }));
}

/** `undefined` quando não deu para saber — nunca `[]` por falha (ver `listarConvites`). */
export async function listarLinksDoCargo(
  serverId: string,
  roleId: string,
): Promise<readonly LinkDeCargo[] | undefined> {
  try {
    const crus: unknown = await client.api.get(`/servers/${serverId}/invites` as never);
    return linksDoCargo(crus, roleId);
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para listar os links.",
      descricao: motivoDoErro(e),
    });
    return undefined;
  }
}

/**
 * Cria o link no primeiro canal de texto do servidor.
 *
 * O primeiro canal é o mesmo que o servidor usa quando alguém entra por um
 * servidor descobrível — é o "lugar de chegada" que o protocolo já reconhece.
 */
export async function criarLinkDeCargo(
  serverId: string,
  roleId: string,
): Promise<string | undefined> {
  const canal = primeiroCanalDe(serverId);
  if (canal === undefined) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o link.",
      descricao: "O servidor não tem canal para onde o link leve.",
    });
    return undefined;
  }
  try {
    const r = (await client.api.post(
      `/channels/${canal}/invites` as never,
      { roles: [roleId] } as never,
    )) as { _id?: string };
    return r._id;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para criar o link.",
      descricao: motivoDoErro(e),
    });
    return undefined;
  }
}

/** O endereço que se leva daqui — a rota `/convite/:codigo` do próprio app. */
export function enderecoDoLink(codigo: string): string {
  return `${location.origin}/convite/${codigo}`;
}
