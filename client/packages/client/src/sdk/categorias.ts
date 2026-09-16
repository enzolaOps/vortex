import { toast } from "../components/ui/toastStore";
import type { OverrideDeCanal } from "./canal";
import { bitDaPermissao } from "./cargos";
import { client, conectado } from "./client";
import { motivoDoErro } from "./erros";

/**
 * Permissões de CATEGORIA — a camada anticorrupção.
 *
 * ⚠ **O Stoat não tem isto; é do fork do serviço `api`.** `Category` ganhou
 * `default_permissions` e `role_permissions`, com duas rotas:
 * `PUT /servers/{id}/categories/{cid}/permissions` e
 * `PUT /channels/{id}/permissions/sync`.
 *
 * ⚠ **A categoria NÃO entra no cálculo de permissão.** Ela guarda um conjunto
 * de sobreposições que os canais COPIAM. Um canal está sincronizado quando o
 * conjunto dele é igual ao da categoria; mudar a categoria arrasta junto só os
 * sincronizados (o servidor faz isso). A escolha protege todo cliente Stoat
 * que não conhece categoria com permissão: ele lê o canal e acerta.
 *
 * O SDK não hidrata as chaves novas de `Category` — mas também não as apaga:
 * `categories` é repassado cru. É de lá que a leitura vem.
 */

/** O conjunto de sobreposições de um canal ou de uma categoria. */
export type ConjuntoDeSobreposicoes = {
  /** `undefined` = sem sobreposição para @everyone. */
  readonly padrao: OverrideDeCanal | undefined;
  readonly cargos: Readonly<Record<string, OverrideDeCanal>>;
};

type CampoCru = { a?: number | string; d?: number | string } | null | undefined;

function doCru(c: CampoCru): OverrideDeCanal | undefined {
  if (c === null || c === undefined) return undefined;
  return { allow: BigInt(c.a ?? 0), deny: BigInt(c.d ?? 0) };
}

/** O que é `{0, 0}` não decide nada — vale o mesmo que ausente. O servidor normaliza igual. */
function vazio(o: OverrideDeCanal | undefined): boolean {
  return o === undefined || (o.allow === 0n && o.deny === 0n);
}

function iguais(a: OverrideDeCanal | undefined, b: OverrideDeCanal | undefined): boolean {
  if (vazio(a) && vazio(b)) return true;
  return a?.allow === b?.allow && a?.deny === b?.deny;
}

/**
 * Quantos ALVOS (@everyone e cada cargo) decidem diferente no canal e na
 * categoria. Zero é sincronizado.
 *
 * Por alvo e não por bit: é o número que o banner do design escreve ("tem 3
 * overrides próprios"), e é o que a pessoa corrige na matriz, um alvo por vez.
 */
export function divergencias(
  canal: ConjuntoDeSobreposicoes,
  categoria: ConjuntoDeSobreposicoes,
): number {
  let n = iguais(canal.padrao, categoria.padrao) ? 0 : 1;
  const alvos = new Set([...Object.keys(canal.cargos), ...Object.keys(categoria.cargos)]);
  for (const id of alvos) {
    if (!iguais(canal.cargos[id], categoria.cargos[id])) n += 1;
  }
  return n;
}

/** A categoria tem alguma sobreposição? Sem nenhuma, não há o que herdar. */
export function temSobreposicoes(c: ConjuntoDeSobreposicoes): boolean {
  return !vazio(c.padrao) || Object.values(c.cargos).some((o) => !vazio(o));
}

/**
 * O conjunto "privada": @everyone sem ver, os cargos escolhidos vendo.
 *
 * `ViewChannel` é o único bit que a privacidade mexe — é o mesmo do "Canal
 * privado" da tela de permissões do canal, e as duas telas precisam dizer a
 * mesma coisa com a mesma escrita.
 */
export function conjuntoPrivado(cargosQueVeem: readonly string[]): ConjuntoDeSobreposicoes {
  const ver = bitDaPermissao("ViewChannel");
  return {
    padrao: { allow: 0n, deny: ver },
    cargos: Object.fromEntries(cargosQueVeem.map((id) => [id, { allow: ver, deny: 0n }])),
  };
}

type CategoriaCrua = {
  id: string;
  title: string;
  channels: string[];
  default_permissions?: CampoCru;
  role_permissions?: Record<string, CampoCru>;
};

function categoriasCruas(serverId: string): readonly CategoriaCrua[] {
  return client.servers.get(serverId)?.categories ?? [];
}

function conjuntoDaCategoria(c: CategoriaCrua): ConjuntoDeSobreposicoes {
  const cargos: Record<string, OverrideDeCanal> = {};
  for (const [id, v] of Object.entries(c.role_permissions ?? {})) {
    const o = doCru(v);
    if (o) cargos[id] = o;
  }
  return { padrao: doCru(c.default_permissions), cargos };
}

/** A categoria que contém o canal, com as sobreposições dela. */
export function categoriaDoCanal(
  channelId: string,
):
  | { readonly id: string; readonly titulo: string; readonly conjunto: ConjuntoDeSobreposicoes }
  | undefined {
  const serverId = client.channels.get(channelId)?.serverId;
  if (!serverId) return undefined;
  const c = categoriasCruas(serverId).find((x) => x.channels.includes(channelId));
  return c ? { id: c.id, titulo: c.title, conjunto: conjuntoDaCategoria(c) } : undefined;
}

export function conjuntoDaCategoriaPorId(
  serverId: string,
  categoriaId: string,
): ConjuntoDeSobreposicoes | undefined {
  const c = categoriasCruas(serverId).find((x) => x.id === categoriaId);
  return c ? conjuntoDaCategoria(c) : undefined;
}

/** O conjunto do canal, na mesma forma da categoria. */
export function conjuntoDoCanal(channelId: string): ConjuntoDeSobreposicoes {
  const canal = client.channels.get(channelId) as unknown as
    | {
        defaultPermissions?: { a: bigint; d: bigint };
        rolePermissions?: Record<string, { a: bigint; d: bigint }>;
      }
    | undefined;
  const cargos: Record<string, OverrideDeCanal> = {};
  for (const [id, v] of Object.entries(canal?.rolePermissions ?? {})) {
    cargos[id] = { allow: BigInt(v.a), deny: BigInt(v.d) };
  }
  const p = canal?.defaultPermissions;
  return { padrao: p ? { allow: BigInt(p.a), deny: BigInt(p.d) } : undefined, cargos };
}

function paraFio(o: OverrideDeCanal) {
  /* `Number` na fronteira e só nela — ver `salvarPermissaoDeCanal`. */
  return { allow: Number(o.allow), deny: Number(o.deny) };
}

export async function salvarPermissoesDaCategoria(
  serverId: string,
  categoriaId: string,
  conjunto: ConjuntoDeSobreposicoes,
): Promise<boolean> {
  if (!conectado()) return false;
  try {
    await client.api.put(
      `/servers/${serverId}/categories/${categoriaId}/permissions` as never,
      {
        default_permissions: conjunto.padrao ? paraFio(conjunto.padrao) : null,
        role_permissions: Object.fromEntries(
          Object.entries(conjunto.cargos).map(([id, o]) => [id, paraFio(o)]),
        ),
      } as never,
    );
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para fechar a categoria.",
      descricao: motivoDoErro(e),
    });
    return false;
  }
}

/** Copia as sobreposições da categoria para o canal. */
export async function sincronizarComCategoria(channelId: string): Promise<boolean> {
  if (!conectado()) return false;
  try {
    await client.api.put(`/channels/${channelId}/permissions/sync` as never);
    return true;
  } catch (e) {
    toast({
      tipo: "erro",
      titulo: "Não deu para sincronizar com a categoria.",
      descricao: motivoDoErro(e),
    });
    return false;
  }
}
