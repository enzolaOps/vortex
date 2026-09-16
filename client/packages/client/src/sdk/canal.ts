import { client, conectado } from "./client";
import { aplicarSuperficieVortex } from "./adapter";
import { corpoDeVoz, lerConfigDeVoz } from "./vozDoCanal";

/**
 * ⚠ **Sem `voz` na edição, manda a que já está gravada.** O servidor substitui
 * o objeto `voice` inteiro: um salvar que só mexesse no limite apagaria o
 * bitrate e a região escolhidos antes.
 */
function lerConfigDeVozComoEdicao(channelId: string) {
  const c = lerConfigDeVoz(channelId);
  return { bitrateKbps: c.bitrateKbps, regiao: c.regiao, modoDeVideo: c.modoDeVideo };
}

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
 * | modo lento           | `slowmode` ✓                                 |
 * | canal de spoiler     | `spoiler` ✓ (servidor do Vortex)             |
 * | bitrate              | `voice.bitrate` ✓ (fork)                     |
 * | região de voz        | `voice.rtc_region` ✓ (fork)                  |
 * | modo de vídeo        | `voice.video_quality` ✓ (fork)               |
 *
 * `spoiler` e `invites_paused` são superfície a mais do servidor do Vortex —
 * clientes Stoat os ignoram, e o SDK os descarta na leitura (quem lê é
 * `superficieVortex.ts`). O `edit` do SDK repassa o corpo, então escrever não
 * precisou de nada além do campo.
 *
 * ⚠ **Os três de voz deixaram de ser pendência** quando o serviço `api` deste
 * repositório os ganhou — ver `sdk/vozDoCanal.ts`. O que ainda for desenhado
 * sem back-end tem entrada em `pendente/pendencias.ts`, que é o que troca "não faz
 * nada" por "diz o que fará e do que depende".
 *
 * ⚠ **`slowmode` merece uma nota própria, e ela mudou de sinal.** O texto
 * anterior dizia que o campo NÃO estava em `DataEditChannel` e que ler sem
 * poder escrever era pior que não ter. A primeira metade era falsa, e foi
 * conferida contra as três camadas:
 *
 * - `vortex-api`, `crates/core/models/src/v0/channels.rs`: `DataEditChannel`
 *   tem `slowmode: Option<u64>`, com `validate(range(min = 0, max = 21600))`.
 * - `stoat-api`, `lib/schema.d.ts`: `DataEditChannel.slowmode?: number | null`.
 * - `stoat.js`, `Channel.edit(data)`: repassa o corpo direto ao `PATCH`.
 *
 * Ele não precisava de fork nenhum — estava classificado como pendência de
 * backend e era trabalho de cliente. O `depende` de um registro é escrito de
 * um lado só, e nada o confere contra o outro; foi assim que este ficou dois
 * meses errado.
 */

/** O que a Visão geral sabe escrever. Só campos que o protocolo aceita. */
export type EdicaoDeCanal = {
  readonly nome: string;
  readonly assunto: string;
  readonly restritoPorIdade: boolean;
  /** `undefined` fora de canal de voz. `0` é o sentinela da tela para "sem limite". */
  readonly limiteDeUsuarios: number | undefined;
  /** Segundos entre mensagens. `0` é desativado; o teto do protocolo é 21600. */
  readonly modoLentoSegundos: number;
  /** Bitrate, região e modo de vídeo. Só em canal de voz, junto do limite. */
  readonly voz?: Omit<Parameters<typeof corpoDeVoz>[0], "limiteDeUsuarios">;
  /** Toda mídia do canal entra coberta. Exclusivo com `restritoPorIdade` na tela. */
  readonly spoiler: boolean;
};

/**
 * Aplica no estado local o que acabou de ser gravado, sem esperar o
 * `ChannelUpdate` — a tela relê o snapshot logo após o `await`, e o evento pode
 * chegar um quadro depois. Idempotente quando ele chegar.
 */
function gravarLocal(channelId: string, data: Record<string, unknown>): void {
  aplicarSuperficieVortex({ type: "ChannelUpdate", id: channelId, data });
}

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
    /*
      ⚠ **Fixado ao teto do PROTOCOLO, e não ao da lista.** O validador do
      servidor recusa acima de 21600 com um 400 que chega à tela como "não deu
      para salvar" — sem dizer qual campo. A lista de degraus para em 6h, mas
      quem garante isso é este `min`, porque a lista é de exibição e o
      corte é de contrato.
    */
    slowmode: Math.max(0, Math.min(21600, Math.trunc(edicao.modoLentoSegundos))),
    spoiler: edicao.spoiler,
  };
  if (edicao.limiteDeUsuarios !== undefined) {
    /*
      ⚠ **Zero NÃO é "sem limite" no fio.** O slider usa 0 como sentinela de
      tela; o protocolo trata `max_users: 0` como teto de ZERO vagas (admins
      passam, o resto toma 400). Sem limite é ausência do campo — `voice: {}`
      substitui o objeto e apaga o teto sem desligar a voz (`remove: Voice`
      faria isso).
    */
    dados["voice"] = corpoDeVoz({
      limiteDeUsuarios: edicao.limiteDeUsuarios,
      ...(edicao.voz ?? lerConfigDeVozComoEdicao(channelId)),
    });
  }

  try {
    await canal.edit(dados);
    gravarLocal(channelId, { spoiler: edicao.spoiler });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pausa ou retoma TODOS os convites do canal.
 *
 * ⚠ **Não revoga nada.** O convite continua existindo e quem tem o link o
 * mantém; o servidor recusa a entrada com `InvitesPaused` enquanto durar. É a
 * diferença para "Revogar": pausar se desfaz, revogar não.
 */
export async function pausarConvites(channelId: string, pausado: boolean): Promise<boolean> {
  if (!conectado()) return false;
  const canal = client.channels.get(channelId);
  if (!canal) return false;
  try {
    await canal.edit({ invites_paused: pausado } as never);
    gravarLocal(channelId, { invites_paused: pausado });
    return true;
  } catch {
    return false;
  }
}

/**
 * Os nós de voz que o servidor anuncia — as opções de "Região de voz".
 *
 * Os nomes são as chaves de `hosts.livekit` na configuração da instância, e é
 * isso que `voice.rtc_region` precisa conter: o servidor recusa com
 * `UnknownNode` um nome que não esteja lá. Nó marcado `private` não aparece
 * na lista pública e por isso não é oferecido.
 */
export function nosDeVoz(): readonly string[] {
  const nos = (
    client.configuration as
      | { features?: { livekit?: { nodes?: readonly { name?: unknown }[] } } }
      | undefined
  )?.features?.livekit?.nodes;
  return (nos ?? [])
    .map((n) => n.name)
    .filter((n): n is string => typeof n === "string" && n !== "");
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
 * TODAS as permissões de um canal — o padrão e cada cargo — em tipo do app.
 *
 * ⚠ **Existe por causa de "Duplicar canal", e a razão é de segurança.** O
 * snapshot do canal carrega nome, tópico, modo lento, idade e limite; não
 * carrega os overrides. Um canal duplicado a partir do snapshot nasceria
 * PÚBLICO a partir de um restrito, em silêncio — e o dono só descobriria
 * quando alguém lesse o que não devia. Por isso a leitura é própria, e por
 * isso ela devolve `undefined` quando não sabe: duplicar exige saber.
 *
 * Par zerado não entra: `{allow: 0, deny: 0}` é HERDAR, que é o que um canal
 * novo já faz sem escrita nenhuma.
 */
export type PermissoesDeCanal = {
  /** O override de @everyone. `undefined` = herda do servidor. */
  readonly padrao: OverrideDeCanal | undefined;
  readonly porCargo: Readonly<Record<string, OverrideDeCanal>>;
};

export function permissoesDoCanal(
  channelId: string,
): PermissoesDeCanal | undefined {
  const canal = client.channels.get(channelId);
  // Canal fora do cache, ou sem servidor: não há o que ler com certeza.
  if (!canal || !canal.serverId) return undefined;

  const par = (
    bruto: { a?: bigint | number; d?: bigint | number } | undefined,
  ): OverrideDeCanal | undefined => {
    const allow = BigInt(bruto?.a ?? 0);
    const deny = BigInt(bruto?.d ?? 0);
    return allow === 0n && deny === 0n ? undefined : { allow, deny };
  };

  const porCargo: Record<string, OverrideDeCanal> = {};
  for (const [roleId, bruto] of Object.entries(canal.rolePermissions ?? {})) {
    const p = par(bruto);
    if (p) porCargo[roleId] = p;
  }
  return { padrao: par(canal.defaultPermissions), porCargo };
}

/**
 * A ordem das escritas de permissão num canal NOVO.
 *
 * ⚠ **O padrão vem PRIMEIRO**, e é a única ordem segura: é nele que mora o
 * `deny ViewChannel` que torna um canal privado. Escrever os cargos antes
 * deixaria o canal aberto a todo mundo durante as N chamadas de cargo, em vez
 * de durante uma.
 *
 * `roleId` `undefined` é o cargo padrão — a assinatura de `setPermissions`.
 */
export function escritasDePermissao(
  p: PermissoesDeCanal,
): readonly {
  readonly roleId: string | undefined;
  readonly override: OverrideDeCanal;
}[] {
  const escritas: { roleId: string | undefined; override: OverrideDeCanal }[] =
    [];
  if (p.padrao) escritas.push({ roleId: undefined, override: p.padrao });
  for (const [roleId, override] of Object.entries(p.porCargo)) {
    escritas.push({ roleId, override });
  }
  return escritas;
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

/**
 * Fecha o canal para todo mundo, negando `ViewChannel` no cargo PADRÃO.
 *
 * ⚠ **É o que "canal privado" significa no protocolo.** Não existe um campo
 * `private` em `Channel` — privacidade é um override de permissão, e o
 * override que a produz é negar `ViewChannel` para @everyone. Quem tem cargo
 * com o bit ligado continua vendo, que é exatamente o comportamento esperado.
 *
 * ⚠ **`role_id` `undefined` é o cargo PADRÃO**, e essa é a assinatura do SDK:
 * `setPermissions(undefined, …)` escreve o override de todo mundo. Passar uma
 * string vazia não faz o mesmo — escreveria num cargo que não existe.
 *
 * Bit 0 do `Permission` é `ViewChannel`; a máscara é 1.
 */
export async function fecharCanal(channelId: string): Promise<boolean> {
  if (!conectado()) return false;
  const canal = client.channels.get(channelId);
  if (!canal) return false;
  try {
    await canal.setPermissions(undefined, { allow: 0, deny: 1 });
    return true;
  } catch {
    return false;
  }
}
