/**
 * Fila de sync de preferências. Sem SDK aqui — o adapter é quem envia.
 *
 * `eco` bloqueia o eco do UserSettingsUpdate: aplicar o que o servidor
 * mandou não pode virar outro POST.
 */

export const CHAVES_SYNC = [
  "vortex:preset",
  "vortex:privacidade",
  "vortex:voz",
  "vortex:notificacoes",
  "vortex:privacidadeDoServidor",
  "vortex:densidade",
] as const;

export type ChaveSync = (typeof CHAVES_SYNC)[number];

type Enviar = (chave: ChaveSync, valor: string) => void;

let enviar: Enviar = () => {};
let eco = false;

export function ligarEnvio(fn: Enviar): void {
  enviar = fn;
}

export function avisarSync(chave: ChaveSync, valor: string): void {
  if (eco) return;
  enviar(chave, valor);
}

export function aplicarRemoto(fn: () => void): void {
  eco = true;
  try {
    fn();
  } finally {
    eco = false;
  }
}

/** Last-write-wins do protocolo: `[timestamp, json]`. */
export function decisao(
  ts: number,
  local: number,
): "aplicar" | "enviar" | "ignorar" {
  if (ts < local) return "enviar";
  if (ts === local) return "ignorar";
  return "aplicar";
}
