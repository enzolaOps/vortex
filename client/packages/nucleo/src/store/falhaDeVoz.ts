/**
 * Por que a entrada numa sala de voz falhou.
 *
 * ⚠ **Store próprio, e não um campo de `Chamada`.** `encerrarChamada` zera a
 * chamada inteira, e a falha precisa sobreviver a esse zero: a pessoa NÃO está
 * na sala (o motor desconecta antes de publicar a falha), mas a interface
 * ainda tem de dizer por quê e oferecer "Tentar de novo". Misturar os dois
 * faria "não estou dentro" e "tentei e falhei" o mesmo estado.
 *
 * Guarda o canal junto do motivo: "Tentar de novo" precisa saber a qual sala,
 * e o palco já não tem como descobrir depois que a chamada foi zerada.
 */
export type FalhaDeVoz = {
  readonly channelId: string;
  /** Já traduzido para quem usa; vem do motor, nunca da mensagem crua do SDK. */
  readonly motivo: string;
};

type Ouvinte = () => void;
const ouvintes = new Set<Ouvinte>();

/** Referência cacheada — armadilha nº 1 do briefing. */
let falha: FalhaDeVoz | undefined;

export function assinarFalhaDeVoz(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerFalhaDeVoz(): FalhaDeVoz | undefined {
  return falha;
}

export function definirFalhaDeVoz(proxima: FalhaDeVoz | undefined): void {
  if (falha === proxima) return;
  if (falha && proxima && falha.channelId === proxima.channelId && falha.motivo === proxima.motivo) return;
  falha = proxima;
  for (const o of ouvintes) o();
}

export function limparFalhaDeVoz(): void {
  definirFalhaDeVoz(undefined);
}
