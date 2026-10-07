/**
 * Quem está em cada sala de voz, alimentado pelo evento CRU (ADR-003).
 *
 * O `stoat.js` guarda isto num `ReactiveMap` (`canal.voiceParticipants`), mas
 * o handler dele de `VoiceChannelMove` é um `// todo` vazio: quem é movido
 * continua listado na sala de origem — o fantasma — e só um F5 o tira. Em vez
 * de forkar o SDK, o adapter é a fonte: semeia do `Ready.voice_states` e
 * aplica os eventos de voz, e o `ReactiveMap` deixa de ser lido.
 *
 * Módulo PURO (sem `stoat.js`, sem Solid): decide só a mudança de estado.
 * Quem republica o snapshot é o adapter, com os canais que `aplicarEventoDeVoz`
 * devolve.
 *
 * Idempotente de propósito: o `delta` publica `VoiceChannelLeave` na rota
 * `leave_call` e o `voice-ingress` publica outro quando o webhook chega — o
 * segundo tem de ser no-op.
 */

export type EstadoCruDeVoz = {
  readonly desde: number;
  readonly recebendo: boolean;
  readonly publicando: boolean;
  readonly tela: boolean;
  readonly camera: boolean;
};

const salas = new Map<string, Map<string, EstadoCruDeVoz>>();

type Cru = {
  id?: unknown;
  joined_at?: unknown;
  is_receiving?: unknown;
  is_publishing?: unknown;
  screensharing?: unknown;
  camera?: unknown;
};

function lerEstado(cru: Cru | undefined, base?: EstadoCruDeVoz): EstadoCruDeVoz {
  const quando =
    typeof cru?.joined_at === "string" ? Date.parse(cru.joined_at) : Number.NaN;
  const bool = (v: unknown, padrao: boolean) =>
    typeof v === "boolean" ? v : padrao;
  return {
    desde: Number.isNaN(quando) ? (base?.desde ?? Date.now()) : quando,
    recebendo: bool(cru?.is_receiving, base?.recebendo ?? true),
    publicando: bool(cru?.is_publishing, base?.publicando ?? true),
    tela: bool(cru?.screensharing, base?.tela ?? false),
    camera: bool(cru?.camera, base?.camera ?? false),
  };
}

/** Quem está na sala, na ordem de chegada ao store. */
export function participantesDaSala(
  canal: string,
): ReadonlyMap<string, EstadoCruDeVoz> {
  return salas.get(canal) ?? new Map();
}

export function canalDeVozDaPessoa(userId: string): string | undefined {
  for (const [canal, sala] of salas) if (sala.has(userId)) return canal;
  return undefined;
}

/** Põe (ou atualiza) uma pessoa. Devolve se algo mudou. */
export function colocarNaSala(
  canal: string,
  userId: string,
  cru?: Cru,
): boolean {
  let sala = salas.get(canal);
  if (!sala) {
    sala = new Map();
    salas.set(canal, sala);
  }
  sala.set(userId, lerEstado(cru, sala.get(userId)));
  return true;
}

/** Tira uma pessoa. Sair de onde não está é no-op e devolve `false`. */
export function tirarDaSala(canal: string, userId: string): boolean {
  const sala = salas.get(canal);
  if (!sala?.delete(userId)) return false;
  if (sala.size === 0) salas.delete(canal);
  return true;
}

export function limparSalasDeVoz(): void {
  salas.clear();
}

/** `Ready.voice_states`: a verdade do servidor, substitui o que havia. */
function semearDoReady(estados: unknown): string[] {
  /* Ready sem `voice_states` (não pedido) não diz nada: não apaga. */
  if (!Array.isArray(estados)) return [];
  const afetados = new Set(salas.keys());
  salas.clear();
  if (Array.isArray(estados)) {
    for (const s of estados as { id?: unknown; participants?: unknown }[]) {
      if (typeof s.id !== "string" || !Array.isArray(s.participants)) continue;
      afetados.add(s.id);
      for (const p of s.participants as Cru[]) {
        if (typeof p.id === "string") colocarNaSala(s.id, p.id, p);
      }
    }
  }
  return [...afetados];
}

/**
 * Aplica um evento cru de voz. Devolve os canais cuja lista mudou
 * (vazio = nada a republicar). `eu` é o usuário local, para o evento privado
 * `UserMoveVoiceChannel`.
 */
export function aplicarEventoDeVoz(
  evento: unknown,
  eu: string | undefined,
): readonly string[] {
  const e = evento as {
    type?: string;
    id?: unknown;
    user?: unknown;
    from?: unknown;
    to?: unknown;
    channel_id?: unknown;
    state?: Cru;
    data?: Cru;
    voice_states?: unknown;
  };

  switch (e.type) {
    case "Ready":
      return semearDoReady(e.voice_states);

    case "VoiceChannelJoin": {
      const user = e.state?.id;
      if (typeof e.id !== "string" || typeof user !== "string") return [];
      colocarNaSala(e.id, user, e.state);
      return [e.id];
    }

    case "VoiceChannelLeave":
      if (typeof e.id !== "string" || typeof e.user !== "string") return [];
      return tirarDaSala(e.id, e.user) ? [e.id] : [];

    case "VoiceChannelMove": {
      if (
        typeof e.user !== "string" ||
        typeof e.from !== "string" ||
        typeof e.to !== "string"
      ) {
        return [];
      }
      /* O `voice-ingress` suprime o Leave de quem é movido, então a saída da
         origem só acontece AQUI — era o fantasma. */
      tirarDaSala(e.from, e.user);
      colocarNaSala(e.to, e.user, e.state);
      return e.from === e.to ? [e.to] : [e.from, e.to];
    }

    case "UserVoiceStateUpdate": {
      if (typeof e.id !== "string" || typeof e.channel_id !== "string") return [];
      if (!salas.get(e.channel_id)?.has(e.id)) return [];
      colocarNaSala(e.channel_id, e.id, e.data);
      return [e.channel_id];
    }

    case "UserMoveVoiceChannel": {
      /* Privado de quem foi movido: sai da origem agora; a entrada no destino
         chega pelo Join/Move do servidor, com o estado verdadeiro. */
      if (eu === undefined || typeof e.from !== "string") return [];
      return tirarDaSala(e.from, eu) ? [e.from] : [];
    }

    default:
      return [];
  }
}
