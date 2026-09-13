import type { ModoDeEntrada } from "./preferenciasDeVoz";

/**
 * A tecla de push-to-talk está sendo segurada?
 *
 * Estado EFÊMERO e de uma pessoa só: nunca vai para `localStorage` nem para o
 * servidor. Quem escreve é quem ouve a tecla — o listener da janela no
 * navegador, ou o hook da casca no desktop.
 */
let segurando = false;
const ouvintes = new Set<() => void>();

export function assinarPushToTalk(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}

export function lerSegurando(): boolean {
  return segurando;
}

export function definirSegurando(v: boolean): void {
  if (segurando === v) return;
  segurando = v;
  for (const o of ouvintes) o();
}

/**
 * O microfone deve estar transmitindo?
 *
 * ⚠ **A regra num lugar só.** Mudo, surdo e push-to-talk decidem juntos, e o
 * motor tinha três `setMicrophoneEnabled` calculando cada um a sua parte. Com o
 * modo "pressionar" entrando, a quarta cópia seria a que diverge.
 *
 * Mudo GANHA da tecla: quem se mutou de propósito não volta a transmitir por
 * esbarrar no atalho.
 */
export function microfoneAberto(s: {
  mudo: boolean;
  surdo: boolean;
  modo: ModoDeEntrada;
  segurando: boolean;
}): boolean {
  if (s.mudo || s.surdo) return false;
  return s.modo === "pressionar" ? s.segurando : true;
}
