/**
 * Preferências de voz e vídeo.
 *
 * ⚠ **Separado de `store/voz.ts`, e a separação é a lei nº 1 de novo.** Aquele
 * carrega o ESTADO da chamada — quem está na sala, quem fala, qualidade da
 * conexão —, e o de fala muda dezenas de vezes por segundo. Este muda por
 * clique humano e é lido no momento em que o microfone abre. Juntá-los faria a
 * tela de configurações acordar a cada sílaba de quem estivesse falando.
 *
 * **Três destas preferências são REAIS e chegam ao WebRTC**: supressão de
 * ruído, cancelamento de eco e controle de ganho são constraints de
 * `getUserMedia`, aplicadas quando o motor abre o microfone. O dispositivo de
 * entrada também — é o `deviceId`. O resto é preferência guardada esperando
 * quem a consuma, e cada uma diz na tela do que depende.
 */

/** Como a voz é transmitida. */
export const MODOS_DE_ENTRADA = ["deteccao", "pressionar"] as const;
export type ModoDeEntrada = (typeof MODOS_DE_ENTRADA)[number];

/**
 * Supressão de ruído.
 *
 * Três níveis na tela, dois no navegador: `noiseSuppression` é booleano em
 * `getUserMedia`. "Agressiva" precisa de RNNoise ou do add-on do LiveKit —
 * está registrada como pendência e o rótulo não mente sobre isso.
 */
export const NIVEIS_DE_RUIDO = ["desligada", "padrao", "agressiva"] as const;
export type NivelDeRuido = (typeof NIVEIS_DE_RUIDO)[number];

export const ROTULO_DO_RUIDO: Record<NivelDeRuido, string> = {
  desligada: "Desligada",
  padrao: "Padrão",
  agressiva: "Agressiva",
};

export const QUALIDADES_DE_VIDEO = ["auto", "720p30", "1080p60"] as const;
export type QualidadeDeVideo = (typeof QUALIDADES_DE_VIDEO)[number];

export const ROTULO_DA_QUALIDADE: Record<QualidadeDeVideo, string> = {
  auto: "Automática",
  "720p30": "720p 30",
  "1080p60": "1080p 60",
};

export const FUNDOS_DE_VIDEO = ["nenhum", "desfoque", "imagem"] as const;
export type FundoDeVideo = (typeof FUNDOS_DE_VIDEO)[number];

export const ROTULO_DO_FUNDO: Record<FundoDeVideo, string> = {
  nenhum: "Nenhum",
  desfoque: "Desfoque",
  imagem: "Imagem",
};

export type PreferenciasDeVoz = {
  /** `undefined` = o padrão do sistema, que é o que a maioria quer. */
  readonly entradaId: string | undefined;
  readonly saidaId: string | undefined;
  /** 0 a 100. */
  readonly volumeDeEntrada: number;
  readonly volumeDeSaida: number;
  readonly modo: ModoDeEntrada;
  readonly sensibilidadeAutomatica: boolean;
  readonly ruido: NivelDeRuido;
  readonly eco: boolean;
  readonly ganho: boolean;
  readonly atenuarOutrosApps: boolean;
  readonly cameraId: string | undefined;
  readonly qualidade: QualidadeDeVideo;
  readonly fundo: FundoDeVideo;
  readonly espelhar: boolean;
};

let prefs: PreferenciasDeVoz = {
  entradaId: undefined,
  saidaId: undefined,
  volumeDeEntrada: 85,
  volumeDeSaida: 60,
  modo: "deteccao",
  sensibilidadeAutomatica: true,
  ruido: "padrao",
  eco: true,
  ganho: true,
  atenuarOutrosApps: false,
  cameraId: undefined,
  qualidade: "auto",
  fundo: "nenhum",
  /* Espelhar é o default de todo cliente de vídeo, e por um motivo bom: quem
     se vê espelhado se reconhece; quem se vê "correto" acha que a câmera está
     invertida. Os outros veem sem espelho de qualquer forma. */
  espelhar: true,
};

const ouvintes = new Set<() => void>();

export function assinarPreferenciasDeVoz(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

/** Referência estável — trocada só quando algo muda de verdade. */
export function lerPreferenciasDeVoz(): PreferenciasDeVoz {
  return prefs;
}

export function definirPreferenciasDeVoz(
  mudanca: Partial<PreferenciasDeVoz>,
): void {
  prefs = { ...prefs, ...mudanca };
  for (const o of ouvintes) o();
}

/**
 * As constraints de áudio, prontas para `getUserMedia`.
 *
 * ⚠ Tipo PRÓPRIO e não `MediaTrackConstraints`: aquele deixa `echoCancellation`
 * ser string, o LiveKit só aceita booleano, e o erro apareceria como falha de
 * tipo no motor em vez de aqui. Estreitar na origem é a mesma regra que faz os
 * tipos de domínio serem declarados pelo app.
 *
 * ⚠ Fica AQUI e não no componente: é a tradução de preferência para protocolo
 * do navegador, e o motor de voz é quem a consome — o mesmo papel que a camada
 * anticorrupção faz para o SDK. Sem isto, o dia em que o motor abrir o
 * microfone ele teria de conhecer a forma deste store.
 */
export type CapturaDeAudio = {
  readonly deviceId?: { readonly exact: string };
  readonly noiseSuppression: boolean;
  readonly echoCancellation: boolean;
  readonly autoGainControl: boolean;
};

export function constraintsDeAudio(): CapturaDeAudio {
  return {
    ...(prefs.entradaId !== undefined
      ? { deviceId: { exact: prefs.entradaId } }
      : {}),
    noiseSuppression: prefs.ruido !== "desligada",
    echoCancellation: prefs.eco,
    autoGainControl: prefs.ganho,
  };
}
