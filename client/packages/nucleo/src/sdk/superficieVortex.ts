/**
 * A superfície que o servidor do Vortex fala A MAIS que o Stoat — lida do
 * evento CRU.
 *
 * ⚠ **O SDK descarta tudo que não conhece, e não há como pedir que não
 * descarte.** A hidratação de `stoat.js` percorre as chaves do payload e pula
 * as que não têm função de mapeamento (`Skipping key … during hydration!`).
 * `spoiler` e `invites_paused` no canal, e `mentionable` no cargo, chegam pelo
 * fio e morrem ali. Patchar o submodule criaria um fork do SDK para manter;
 * buscar por REST ficaria velho no evento seguinte. Resta o que o adapter já
 * faz para `can_publish`: ler o `"event"` cru, que é exatamente a fronteira
 * onde protocolo vira domínio.
 *
 * Módulo PURO na parte que decide (`aplicarEventoCru`), para ser testado sem
 * socket; o adapter só liga o ouvinte e republica o que mudou.
 *
 * ⚠ **O ouvinte do SDK roda ANTES deste.** Os dois escutam o mesmo `"event"`, e
 * o do `Client` foi registrado no construtor. Consequência: quando um
 * `ChannelUpdate` chega, o snapshot do canal já foi republicado uma vez com o
 * valor velho, e a republicação daqui é a segunda. Duas passagens num evento
 * humano (alguém salvou uma configuração) é custo que não aparece; inverter a
 * ordem exigiria mexer no SDK.
 */

export type CamposDeCanal = {
  /** Toda mídia do canal entra coberta, com clique para revelar. */
  readonly spoiler: boolean;
  /** Entrar pelos convites deste canal está suspenso. */
  readonly convitesPausados: boolean;
};

/** Referência ÚNICA para o caso comum — snapshot estável, armadilha nº 1. */
export const CAMPOS_PADRAO: CamposDeCanal = Object.freeze({
  spoiler: false,
  convitesPausados: false,
});

export type EstadoDaSuperficie = {
  /** Só canais com algum campo ligado. Ausência é `CAMPOS_PADRAO`. */
  readonly canais: Map<string, CamposDeCanal>;
  /** Cargos mencionáveis, por servidor. */
  readonly mencionaveis: Map<string, Set<string>>;
};

export type Mudancas = {
  readonly canais: readonly string[];
  readonly servidores: readonly string[];
};

export function criarEstado(): EstadoDaSuperficie {
  return { canais: new Map(), mencionaveis: new Map() };
}

type Bruto = Record<string, unknown>;

function objeto(v: unknown): Bruto | undefined {
  return typeof v === "object" && v !== null ? (v as Bruto) : undefined;
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function camposDe(estado: EstadoDaSuperficie, channelId: string): CamposDeCanal {
  return estado.canais.get(channelId) ?? CAMPOS_PADRAO;
}

export function ehMencionavel(
  estado: EstadoDaSuperficie,
  serverId: string,
  roleId: string,
): boolean {
  return estado.mencionaveis.get(serverId)?.has(roleId) ?? false;
}

/**
 * Aplica um evento. Devolve QUEM mudou, para o adapter republicar só isso.
 *
 * ⚠ **Objeto de canal inteiro SUBSTITUI; parcial MESCLA.** `ChannelCreate` e
 * `Ready` trazem o canal completo, e lá ausência do campo é `false` — o
 * servidor omite booleano falso (`skip_serializing_if = if_false`). Num
 * `ChannelUpdate` a ausência é "não mudou", e tratar do mesmo jeito apagaria o
 * spoiler de um canal toda vez que alguém renomeasse ele.
 */
export function aplicarEventoCru(
  estado: EstadoDaSuperficie,
  evento: unknown,
): Mudancas {
  const canais = new Set<string>();
  const servidores = new Set<string>();
  aplicar(estado, evento, canais, servidores);
  return { canais: [...canais], servidores: [...servidores] };
}

function aplicar(
  estado: EstadoDaSuperficie,
  evento: unknown,
  canais: Set<string>,
  servidores: Set<string>,
): void {
  const e = objeto(evento);
  if (!e) return;

  switch (e["type"]) {
    /* O servidor agrupa eventos; o SDK desembrulha, e aqui também. */
    case "Bulk": {
      if (Array.isArray(e["v"])) {
        for (const item of e["v"]) aplicar(estado, item, canais, servidores);
      }
      return;
    }
    case "Ready": {
      if (Array.isArray(e["channels"])) {
        for (const c of e["channels"]) canalInteiro(estado, c, canais);
      }
      if (Array.isArray(e["servers"])) {
        for (const s of e["servers"]) servidorInteiro(estado, s, servidores);
      }
      return;
    }
    case "ChannelCreate":
      canalInteiro(estado, e, canais);
      return;
    case "ChannelUpdate": {
      const id = texto(e["id"]);
      const data = objeto(e["data"]);
      if (id === undefined || !data) return;
      const atual = camposDe(estado, id);
      gravarCanal(
        estado,
        id,
        {
          spoiler: typeof data["spoiler"] === "boolean" ? data["spoiler"] : atual.spoiler,
          convitesPausados:
            typeof data["invites_paused"] === "boolean"
              ? data["invites_paused"]
              : atual.convitesPausados,
        },
        canais,
      );
      return;
    }
    case "ChannelDelete": {
      const id = texto(e["id"]);
      if (id !== undefined && estado.canais.delete(id)) canais.add(id);
      return;
    }
    case "ServerCreate": {
      servidorInteiro(estado, e["server"], servidores);
      if (Array.isArray(e["channels"])) {
        for (const c of e["channels"]) canalInteiro(estado, c, canais);
      }
      return;
    }
    case "ServerDelete": {
      const id = texto(e["id"]);
      if (id !== undefined && estado.mencionaveis.delete(id)) servidores.add(id);
      return;
    }
    case "ServerRoleUpdate": {
      const serverId = texto(e["id"]);
      const roleId = texto(e["role_id"]);
      const data = objeto(e["data"]);
      if (serverId === undefined || roleId === undefined || !data) return;
      if (typeof data["mentionable"] !== "boolean") return;
      gravarCargo(estado, serverId, roleId, data["mentionable"], servidores);
      return;
    }
    case "ServerRoleDelete": {
      const serverId = texto(e["id"]);
      const roleId = texto(e["role_id"]);
      if (serverId === undefined || roleId === undefined) return;
      gravarCargo(estado, serverId, roleId, false, servidores);
      return;
    }
  }
}

function canalInteiro(estado: EstadoDaSuperficie, bruto: unknown, canais: Set<string>): void {
  const c = objeto(bruto);
  const id = texto(c?.["_id"]);
  if (!c || id === undefined) return;
  gravarCanal(
    estado,
    id,
    { spoiler: c["spoiler"] === true, convitesPausados: c["invites_paused"] === true },
    canais,
  );
}

function gravarCanal(
  estado: EstadoDaSuperficie,
  id: string,
  novo: CamposDeCanal,
  canais: Set<string>,
): void {
  const atual = camposDe(estado, id);
  if (atual.spoiler === novo.spoiler && atual.convitesPausados === novo.convitesPausados) {
    return;
  }
  if (!novo.spoiler && !novo.convitesPausados) estado.canais.delete(id);
  else estado.canais.set(id, Object.freeze({ ...novo }));
  canais.add(id);
}

function servidorInteiro(
  estado: EstadoDaSuperficie,
  bruto: unknown,
  servidores: Set<string>,
): void {
  const s = objeto(bruto);
  const serverId = texto(s?.["_id"]);
  if (!s || serverId === undefined) return;

  const novos = new Set<string>();
  const cargos = objeto(s["roles"]);
  if (cargos) {
    for (const [roleId, cargo] of Object.entries(cargos)) {
      if (objeto(cargo)?.["mentionable"] === true) novos.add(roleId);
    }
  }

  const antes = estado.mencionaveis.get(serverId) ?? new Set<string>();
  const igual = antes.size === novos.size && [...novos].every((r) => antes.has(r));
  if (igual) return;
  if (novos.size === 0) estado.mencionaveis.delete(serverId);
  else estado.mencionaveis.set(serverId, novos);
  servidores.add(serverId);
}

function gravarCargo(
  estado: EstadoDaSuperficie,
  serverId: string,
  roleId: string,
  mencionavel: boolean,
  servidores: Set<string>,
): void {
  if (ehMencionavel(estado, serverId, roleId) === mencionavel) return;
  const conjunto = new Set(estado.mencionaveis.get(serverId));
  if (mencionavel) conjunto.add(roleId);
  else conjunto.delete(roleId);
  if (conjunto.size === 0) estado.mencionaveis.delete(serverId);
  else estado.mencionaveis.set(serverId, conjunto);
  servidores.add(serverId);
}

/* ------------------------------------------------ instância da sessão */

/** O estado da sessão. Módulo-level, como todo store do app. */
export const superficie = criarEstado();

/** Estado limpo entre testes. */
export function limparSuperficie(): void {
  superficie.canais.clear();
  superficie.mencionaveis.clear();
}

/* ------------------------------------------------ assinatura por canal */

/**
 * Quem desenha a partir destes campos sem passar pelo snapshot do canal.
 *
 * O anexo precisa só de `spoiler`, e assinar o CANAL inteiro faria cada anexo
 * acordar a cada não lida, permissão ou silêncio daquele canal. Keyed por
 * canal, e o valor lido é um booleano — estável por natureza.
 */
const ouvintesPorCanal = new Map<string, Set<() => void>>();

export function assinarCanalVortex(channelId: string, ouvinte: () => void): () => void {
  let conjunto = ouvintesPorCanal.get(channelId);
  if (!conjunto) {
    conjunto = new Set();
    ouvintesPorCanal.set(channelId, conjunto);
  }
  const alvo = conjunto;
  alvo.add(ouvinte);
  return () => {
    alvo.delete(ouvinte);
    if (alvo.size === 0) ouvintesPorCanal.delete(channelId);
  };
}

export function avisarCanaisVortex(ids: readonly string[]): void {
  for (const id of ids) {
    const conjunto = ouvintesPorCanal.get(id);
    if (conjunto) for (const o of [...conjunto]) o();
  }
}

/* ------------------------------------------------ mídia revelada */

/**
 * Os anexos que a pessoa já revelou nesta sessão.
 *
 * ⚠ **Module-level e não `useState`**, porque a linha é VIRTUALIZADA: rolar
 * para longe desmonta o anexo, e o estado local voltaria a cobrir a mídia que
 * a pessoa acabou de escolher ver. Por sessão e não persistido: spoiler é
 * "quero decidir antes de ver", e a decisão vale para esta leitura.
 */
const revelados = new Set<string>();
const ouvintesDeRevelados = new Set<() => void>();

export function assinarRevelados(ouvinte: () => void): () => void {
  ouvintesDeRevelados.add(ouvinte);
  return () => {
    ouvintesDeRevelados.delete(ouvinte);
  };
}

export function foiRevelado(anexoId: string): boolean {
  return revelados.has(anexoId);
}

export function revelar(anexoId: string): void {
  if (revelados.has(anexoId)) return;
  revelados.add(anexoId);
  for (const o of [...ouvintesDeRevelados]) o();
}
