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

/*
  O atraso ao soltar — "Atraso ao soltar 120 ms" do design.

  ⚠ **Mora AQUI e não no motor**, e é o que o faz valer de verdade: o motor
  assina `segurando` e fecha o microfone quando ele vira `false`, então segurar
  o `false` por N ms segura o microfone aberto por N ms, venha a tecla do
  listener da janela ou do hook global da casca. Um atraso no motor teria de
  ser repetido para cada caminho que escreve aqui.
*/
let soltura: ReturnType<typeof setTimeout> | undefined;

/** A tecla desceu. Cancela uma soltura pendente — reapertar não pisca. */
export function apertarTecla(): void {
  if (soltura !== undefined) {
    clearTimeout(soltura);
    soltura = undefined;
  }
  definirSegurando(true);
}

/** A tecla subiu. O microfone fecha depois de `atrasoMs`. */
export function soltarTecla(atrasoMs: number): void {
  if (soltura !== undefined) clearTimeout(soltura);
  soltura = undefined;
  if (atrasoMs <= 0) {
    definirSegurando(false);
    return;
  }
  soltura = setTimeout(() => {
    soltura = undefined;
    definirSegurando(false);
  }, atrasoMs);
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
