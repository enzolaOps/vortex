/**
 * Modelo do servidor — protocolo → domínio.
 *
 * ⚠ **Rotas do fork, não do Stoat.** `GET/POST/PUT/DELETE
 * /servers/{id}/template` gera, lê, sincroniza e apaga o modelo de um
 * servidor; `GET /templates/{code}` pré-visualiza; `POST /templates/{code}`
 * cria um servidor novo a partir dele; `POST /templates/{code}/apply/{server}`
 * acrescenta a estrutura a um servidor existente (só o dono).
 *
 * Não confundir com `servidores/modelos.ts`: aqueles são presets LOCAIS de
 * criação ("Jogos", "Estudo"), que o cliente monta chamando criar canal. Este é
 * o modelo COMPARTILHÁVEL, guardado no servidor, que carrega cargos e
 * permissões — o que um preset local não teria como reproduzir.
 */
import { client } from "./client";
import { motivoDoErro } from "./erros";
import { toast } from "../components/ui/toastStore";

/** O que o cartão de resumo mostra de uma estrutura. */
export type ResumoDeEstrutura = {
  readonly categorias: number;
  readonly canais: number;
  readonly cargos: number;
  /** Exceções de permissão por canal — padrão do canal e por cargo. */
  readonly excecoes: number;
};

export type ModeloDoServidor = {
  readonly codigo: string;
  readonly nome: string;
  readonly criadoEmMs: number;
  readonly usos: number;
  /** A estrutura do servidor mudou desde a última sincronização. */
  readonly desatualizado: boolean;
  readonly resumo: ResumoDeEstrutura;
};

export type PreviaDeModelo = {
  readonly codigo: string;
  readonly nome: string;
  readonly nomeDoServidor: string;
  readonly resumo: ResumoDeEstrutura;
};

type SnapshotCru = {
  name?: string;
  roles?: unknown[];
  channels?: {
    default_permissions?: unknown;
    role_permissions?: Record<string, unknown>;
  }[];
  categories?: unknown[];
};

type ModeloCru = {
  _id: string;
  name: string;
  created_at: string;
  uses?: number;
  snapshot: SnapshotCru;
};

export function resumoDe(s: SnapshotCru): ResumoDeEstrutura {
  const canais = s.channels ?? [];
  return {
    categorias: (s.categories ?? []).length,
    canais: canais.length,
    cargos: (s.roles ?? []).length,
    excecoes: canais.reduce(
      (soma, c) =>
        soma +
        (c.default_permissions !== undefined && c.default_permissions !== null ? 1 : 0) +
        Object.keys(c.role_permissions ?? {}).length,
      0,
    ),
  };
}

export function modeloDe(bruto: { template: ModeloCru; is_dirty: boolean }): ModeloDoServidor {
  return {
    codigo: bruto.template._id,
    nome: bruto.template.name,
    criadoEmMs: Date.parse(bruto.template.created_at),
    usos: bruto.template.uses ?? 0,
    desatualizado: bruto.is_dirty,
    resumo: resumoDe(bruto.template.snapshot),
  };
}

/** O endereço que o cartão mostra e que o campo de aplicar aceita de volta. */
export function linkDoModelo(codigo: string): string {
  return `${location.host}/t/${codigo}`;
}

/**
 * O código, de um código ou de um link `…/t/{codigo}`.
 *
 * O alfabeto é o do servidor (sem `0/O` e `1/l/I`), mas a conferência aqui é
 * só de FORMA: um código plausível e inexistente volta 404 da pré-visualização
 * com a frase certa, e duplicar o alfabeto seria uma segunda regra para
 * manter igual à do servidor.
 */
export function codigoDeModelo(entrada: string): string | undefined {
  const limpo = entrada.trim().split(/[?#]/)[0] ?? "";
  const partes = limpo.split("/").filter((p) => p.length > 0);
  const ultimo = partes.at(-1);
  if (ultimo === undefined) return undefined;
  /* Com barra, só vale se o segmento anterior for `t` — senão um link de
     CONVITE colado aqui viraria um código de modelo errado em silêncio. */
  if (partes.length > 1 && partes.at(-2) !== "t") return undefined;
  return /^[A-Za-z0-9]{4,32}$/.test(ultimo) ? ultimo : undefined;
}

function falhou(titulo: string, e: unknown): void {
  toast({ tipo: "erro", titulo, descricao: motivoDoErro(e) });
}

/** O `stoat-api` lança o corpo da falha em TEXTO — ver `comoObjeto` em `erros.ts`. */
function ehNaoEncontrado(e: unknown): boolean {
  let corpo: unknown = e;
  if (typeof e === "string") {
    try {
      corpo = JSON.parse(e);
    } catch {
      return false;
    }
  }
  return (corpo as { type?: unknown } | null)?.type === "NotFound";
}

/**
 * O modelo deste servidor: `null` quando não há, `undefined` quando não deu
 * para saber. São respostas diferentes — com a segunda, oferecer "Gerar modelo"
 * levaria a um `InvalidOperation` para quem já tem um.
 */
export async function buscarModelo(
  serverId: string,
): Promise<ModeloDoServidor | null | undefined> {
  try {
    const bruto = await client.api.get(`/servers/${serverId}/template` as never);
    return modeloDe(bruto as never);
  } catch (e) {
    if (ehNaoEncontrado(e)) return null;
    return undefined;
  }
}

export async function gerarModelo(
  serverId: string,
  nome: string,
): Promise<ModeloDoServidor | undefined> {
  try {
    const bruto = await client.api.post(
      `/servers/${serverId}/template` as never,
      { name: nome } as never,
    );
    return modeloDe(bruto as never);
  } catch (e) {
    falhou("Não deu para gerar o modelo.", e);
    return undefined;
  }
}

export async function sincronizarModelo(
  serverId: string,
): Promise<ModeloDoServidor | undefined> {
  try {
    const bruto = await client.api.put(`/servers/${serverId}/template` as never);
    return modeloDe(bruto as never);
  } catch (e) {
    falhou("Não deu para sincronizar o modelo.", e);
    return undefined;
  }
}

export async function excluirModelo(serverId: string): Promise<boolean> {
  try {
    await client.api.delete(`/servers/${serverId}/template` as never);
    return true;
  } catch (e) {
    falhou("Não deu para excluir o modelo.", e);
    return false;
  }
}

export async function previaDoModelo(
  entrada: string,
): Promise<PreviaDeModelo | { readonly erro: string }> {
  const codigo = codigoDeModelo(entrada);
  if (codigo === undefined) return { erro: "Isso não parece um modelo." };
  try {
    const bruto = (await client.api.get(`/templates/${codigo}` as never)) as ModeloCru;
    return {
      codigo,
      nome: bruto.name,
      nomeDoServidor: bruto.snapshot.name ?? bruto.name,
      resumo: resumoDe(bruto.snapshot),
    };
  } catch (e) {
    return {
      erro: ehNaoEncontrado(e) ? "Este modelo não existe mais." : motivoDoErro(e),
    };
  }
}

export async function aplicarModelo(codigo: string, serverId: string): Promise<boolean> {
  try {
    await client.api.post(`/templates/${codigo}/apply/${serverId}` as never);
    return true;
  } catch (e) {
    falhou("Não deu para aplicar o modelo.", e);
    return false;
  }
}

/** Cria um servidor novo com a estrutura do modelo. Devolve o ID. */
export async function criarServidorDoModelo(
  codigo: string,
  nome: string,
): Promise<string | undefined> {
  try {
    const bruto = (await client.api.post(
      `/templates/${codigo}` as never,
      { name: nome } as never,
    )) as { server: { _id: string } };
    return bruto.server._id;
  } catch (e) {
    falhou("Não deu para criar o servidor.", e);
    return undefined;
  }
}
