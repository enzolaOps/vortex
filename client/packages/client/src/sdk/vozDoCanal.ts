import { useSyncExternalStore } from "react";

/**
 * A voz de um canal: bitrate, região e modo de vídeo.
 *
 * ⚠ **São campos do FORK, não do Stoat.** `VoiceInformation` ganhou
 * `bitrate` (kbps), `rtc_region` e `video_quality` no serviço `api` deste
 * repositório. Clientes Stoat antigos ignoram os três; servidores Stoat
 * antigos nunca os mandam, e a ausência é o comportamento de antes.
 *
 * ⚠ **Por que um store próprio e não um campo em `ChannelSnapshot`.** A
 * hidratação do `stoat.js` reduz o objeto `voice` a `{ maxUsers }` e joga o
 * resto fora — nenhum getter do SDK alcança os campos novos. O caminho é o
 * mesmo do `can_publish` em `adapter.ts`: ler o evento CRU (`Ready`,
 * `ChannelCreate`, `ChannelUpdate`) antes da hidratação. E pendurar isto no
 * snapshot do canal republicaria a coluna inteira por uma configuração que só
 * duas telas leem: esta página e o motor de voz ao entrar.
 */

export const MODOS_DE_VIDEO = ["auto", "720p30", "1080p60"] as const;
export type ModoDeVideo = (typeof MODOS_DE_VIDEO)[number];

export const ROTULO_DO_MODO: Record<ModoDeVideo, string> = {
  auto: "Automático",
  "720p30": "720p 30fps",
  "1080p60": "1080p 60fps",
};

/** Faixa do deslizante — a do design. O servidor aceita até 384. */
export const BITRATE_MIN = 8;
export const BITRATE_MAX = 128;
export const BITRATE_PASSO = 8;
/**
 * O que a tela mostra quando o canal nunca escolheu.
 *
 * É o valor que o design desenha, e é também próximo do que o LiveKit publica
 * por padrão para voz (`AudioPresets.music`, 48 kbps) — a tela não afirma uma
 * qualidade muito diferente da que está no ar.
 */
export const BITRATE_PADRAO = 64;

export type ConfigDeVoz = {
  /** `undefined` = o canal nunca escolheu; vale o padrão do cliente. */
  readonly bitrateKbps: number | undefined;
  /** Nome do nó LiveKit. `undefined` = automática. */
  readonly regiao: string | undefined;
  readonly modoDeVideo: ModoDeVideo;
};

export const VOZ_PADRAO: ConfigDeVoz = {
  bitrateKbps: undefined,
  regiao: undefined,
  modoDeVideo: "auto",
};

/**
 * Traduz o `voice` cru do protocolo.
 *
 * Tudo que não bate com o contrato vira ausência, e não um valor aparado: um
 * bitrate de 0 ou de 10 000 não é uma escolha, é lixo, e a tela não pode
 * afirmar "8 kbps" para um canal que ninguém configurou assim.
 */
export function lerVozBruta(voice: unknown): ConfigDeVoz {
  if (typeof voice !== "object" || voice === null) return VOZ_PADRAO;
  const v = voice as {
    bitrate?: unknown;
    rtc_region?: unknown;
    video_quality?: unknown;
  };
  const bitrate =
    typeof v.bitrate === "number" &&
    Number.isInteger(v.bitrate) &&
    v.bitrate >= 8 &&
    v.bitrate <= 384
      ? v.bitrate
      : undefined;
  const regiao =
    typeof v.rtc_region === "string" && v.rtc_region !== "" ? v.rtc_region : undefined;
  const modo = MODOS_DE_VIDEO.includes(v.video_quality as ModoDeVideo)
    ? (v.video_quality as ModoDeVideo)
    : "auto";
  if (bitrate === undefined && regiao === undefined && modo === "auto") {
    return VOZ_PADRAO;
  }
  return { bitrateKbps: bitrate, regiao, modoDeVideo: modo };
}

/**
 * O objeto `voice` que vai no `PATCH`.
 *
 * ⚠ **O servidor SUBSTITUI o objeto inteiro**, não mescla: mandar só o
 * bitrate apagaria o limite de usuários. Por isso os quatro campos saem
 * sempre juntos daqui, e quem chama não tem como montar um corpo parcial.
 *
 * Ausência é "sem limite", "automática" e "padrão" — zero no fio era o defeito
 * de `max_users` que o `#212` já consertou uma vez.
 */
export function corpoDeVoz(edicao: {
  readonly limiteDeUsuarios: number;
  readonly bitrateKbps: number | undefined;
  readonly regiao: string | undefined;
  readonly modoDeVideo: ModoDeVideo;
}): Record<string, unknown> {
  const corpo: Record<string, unknown> = {};
  if (edicao.limiteDeUsuarios > 0) corpo["max_users"] = edicao.limiteDeUsuarios;
  if (edicao.bitrateKbps !== undefined) {
    corpo["bitrate"] = Math.max(
      BITRATE_MIN,
      Math.min(BITRATE_MAX, Math.round(edicao.bitrateKbps)),
    );
  }
  if (edicao.regiao) corpo["rtc_region"] = edicao.regiao;
  if (edicao.modoDeVideo !== "auto") corpo["video_quality"] = edicao.modoDeVideo;
  return corpo;
}

/** O que o motor pede ao LiveKit para uma configuração — sem tipos dele. */
export type PublicacaoDeVoz = {
  /** bps para o `audioPreset`. `undefined` = o padrão do LiveKit. */
  readonly audioMaxBitrate: number | undefined;
  readonly video:
    | {
        readonly largura: number;
        readonly altura: number;
        readonly fps: number;
        /** bps para o `videoEncoding` da câmera. */
        readonly maxBitrate: number;
      }
    | undefined;
};

/**
 * Os tetos de publicação de um canal.
 *
 * Os bitrates de vídeo são os presets de câmera do próprio LiveKit
 * (`h720` 1,7 Mbps a 30 fps; `h1080` 3 Mbps), dobrados a 60 fps na mesma
 * proporção que `qualidadeDaTela.ts` usa para a transmissão.
 */
export function publicacaoDe(c: ConfigDeVoz): PublicacaoDeVoz {
  const audioMaxBitrate =
    c.bitrateKbps === undefined ? undefined : c.bitrateKbps * 1000;
  switch (c.modoDeVideo) {
    case "auto":
      return { audioMaxBitrate, video: undefined };
    case "720p30":
      return {
        audioMaxBitrate,
        video: { largura: 1280, altura: 720, fps: 30, maxBitrate: 1_700_000 },
      };
    case "1080p60":
      return {
        audioMaxBitrate,
        video: { largura: 1920, altura: 1080, fps: 60, maxBitrate: 6_000_000 },
      };
  }
}

/* ------------------------------------------------------------------ store */

const porCanal = new Map<string, ConfigDeVoz>();
const ouvintes = new Set<() => void>();

function avisar(): void {
  for (const o of ouvintes) o();
}

export function lerConfigDeVoz(channelId: string): ConfigDeVoz {
  return porCanal.get(channelId) ?? VOZ_PADRAO;
}

function gravar(channelId: string, config: ConfigDeVoz): boolean {
  const atual = porCanal.get(channelId) ?? VOZ_PADRAO;
  if (
    atual.bitrateKbps === config.bitrateKbps &&
    atual.regiao === config.regiao &&
    atual.modoDeVideo === config.modoDeVideo
  ) {
    return false;
  }
  if (config === VOZ_PADRAO) porCanal.delete(channelId);
  else porCanal.set(channelId, config);
  return true;
}

type Bruto = {
  type?: string;
  v?: readonly unknown[];
  channels?: readonly { _id?: string; voice?: unknown }[];
  _id?: string;
  voice?: unknown;
  id?: string;
  data?: { voice?: unknown };
  clear?: readonly string[];
};

/**
 * Anota a voz de um evento cru do socket. Devolve se algo mudou.
 *
 * `ChannelUpdate` sem `voice` e sem `clear: ["Voice"]` não toca nada: é outra
 * edição do canal (nome, assunto), e tratá-la como "voz ausente" apagaria a
 * configuração a cada renomeação.
 */
export function anotarEventoDeVoz(evento: unknown): boolean {
  const e = evento as Bruto;
  let mudou = false;
  switch (e.type) {
    case "Bulk":
      for (const item of e.v ?? []) mudou = anotarEventoDeVoz(item) || mudou;
      return mudou;
    case "Ready":
      for (const c of e.channels ?? []) {
        if (c._id) mudou = gravar(c._id, lerVozBruta(c.voice)) || mudou;
      }
      break;
    case "ChannelCreate":
      if (e._id) mudou = gravar(e._id, lerVozBruta(e.voice));
      break;
    case "ChannelUpdate":
      if (!e.id) return false;
      if (e.clear?.includes("Voice")) mudou = gravar(e.id, VOZ_PADRAO);
      else if (e.data && "voice" in e.data) {
        mudou = gravar(e.id, lerVozBruta(e.data.voice));
      }
      break;
    case "ChannelDelete":
      if (e.id && porCanal.delete(e.id)) mudou = true;
      break;
    default:
      return false;
  }
  if (mudou) avisar();
  return mudou;
}

export function assinarConfigDeVoz(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** A configuração de voz de um canal, assinada. Referência estável por canal. */
export function useConfigDeVoz(channelId: string): ConfigDeVoz {
  return useSyncExternalStore(assinarConfigDeVoz, () => lerConfigDeVoz(channelId));
}

/** Estado limpo entre testes. O módulo é global e sobrevive. */
export function limparConfigDeVoz(): void {
  porCanal.clear();
}
