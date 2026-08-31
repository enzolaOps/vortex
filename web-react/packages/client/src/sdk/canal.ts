import { client, conectado } from "./client";

/**
 * Escrita de configuração de CANAL — a camada anticorrupção, como sempre.
 *
 * ⚠ **O que o protocolo aceita e o que ele não aceita, medido em
 * `DataEditChannel` e não suposto:**
 *
 * | campo do design      | protocolo                                    |
 * |----------------------|----------------------------------------------|
 * | nome                 | `name` ✓                                     |
 * | assunto              | `description` ✓                              |
 * | restrição de idade   | `nsfw` ✓                                     |
 * | limite de usuários   | `voice.max_users` ✓                          |
 * | **modo lento**       | ⚠ `slowmode` é só LEITURA — não está no edit |
 * | **canal de spoiler** | ⚠ não existe                                 |
 * | **bitrate**          | ⚠ não existe                                 |
 * | **região de voz**    | ⚠ não existe                                 |
 * | **modo de vídeo**    | ⚠ não existe                                 |
 *
 * Os cinco de baixo são desenhados assim mesmo — é a regra desta rodada — e
 * cada um tem entrada em `pendente/pendencias.ts`, que é o que troca "não faz
 * nada" por "diz o que fará e do que depende".
 *
 * ⚠ `slowmode` merece uma nota própria porque ele ENGANA: o objeto do canal
 * carrega o valor e o `stoat.js` expõe o getter, então quem lê o SDK conclui
 * que dá para escrever. `DataEditChannel` não tem o campo. Ler e não poder
 * escrever é pior que não ter, porque a interface mostraria o estado atual e
 * o controle não moveria.
 */

/** O que a Visão geral sabe escrever. Só campos que o protocolo aceita. */
export type EdicaoDeCanal = {
  readonly nome: string;
  readonly assunto: string;
  readonly restritoPorIdade: boolean;
  /** `undefined` fora de canal de voz. `0` é "sem limite" no protocolo. */
  readonly limiteDeUsuarios: number | undefined;
};

export async function salvarCanal(
  channelId: string,
  edicao: EdicaoDeCanal,
): Promise<boolean> {
  if (!conectado()) return false;
  const canal = client.channels.get(channelId);
  if (!canal) return false;

  /*
    `description` vazio vira `null`, e não string vazia.

    O protocolo trata `null` como "apagar o campo" e `""` como "o assunto é
    uma string vazia" — a segunda deixa o cabeçalho reservando espaço para um
    tópico que não existe.
  */
  const dados: Record<string, unknown> = {
    name: edicao.nome,
    description: edicao.assunto.trim() === "" ? null : edicao.assunto,
    nsfw: edicao.restritoPorIdade,
  };
  if (edicao.limiteDeUsuarios !== undefined) {
    dados["voice"] = { max_users: edicao.limiteDeUsuarios };
  }

  try {
    await canal.edit(dados);
    return true;
  } catch {
    return false;
  }
}

/**
 * Uma permissão de canal, por cargo — o par allow/deny do protocolo.
 *
 * ⚠ **É um par e não um booleano, e é isso que faz o tri-state existir.** Um
 * bit pode estar em `allow`, em `deny`, ou em nenhum dos dois — e "nenhum dos
 * dois" é HERDAR, que é diferente de negar. Colapsar num booleano perderia a
 * distinção que a matriz inteira existe para mostrar.
 */
export type OverrideDeCanal = { readonly allow: bigint; readonly deny: bigint };

export function overrideDoCargo(
  channelId: string,
  roleId: string,
): OverrideDeCanal {
  const canal = client.channels.get(channelId);
  const bruto = (
    canal as unknown as {
      rolePermissions?: Record<string, { a?: number; d?: number }>;
    }
  )?.rolePermissions?.[roleId];
  return {
    allow: BigInt(bruto?.a ?? 0),
    deny: BigInt(bruto?.d ?? 0),
  };
}

/**
 * Escreve o par de um cargo neste canal.
 *
 * ⚠ **`BigInt` e não `number`, pela mesma razão do editor de cargos:** voz e
 * menção moram nos bits 30–39, e os operadores bitwise do JavaScript truncam
 * em 32. `Speak` (bit 31) viraria negativo e `MentionRoles` (bit 38) sumiria —
 * erro que só aparece no fim da lista, que é onde ninguém confere.
 *
 * O protocolo recebe os dois como NÚMERO no corpo, então a conversão acontece
 * na fronteira e em lugar nenhum mais.
 */
export async function salvarPermissaoDeCanal(
  channelId: string,
  roleId: string,
  override: OverrideDeCanal,
): Promise<boolean> {
  if (!conectado()) return false;
  const canal = client.channels.get(channelId);
  if (!canal) return false;
  try {
    await canal.setPermissions(roleId, {
      allow: Number(override.allow),
      deny: Number(override.deny),
    });
    return true;
  } catch {
    return false;
  }
}
