/**
 * A janela destacada da chamada, se houver.
 *
 * ⚠ **Guarda a `Window` e não um booleano**, porque quem desenha nela (o portal)
 * precisa do `document` dela, e quem fecha precisa do objeto. É a referência
 * cacheada de sempre: o `getSnapshot` devolve o mesmo valor até a janela mudar.
 *
 * Do dispositivo e sem persistência — uma janela não sobrevive a recarregar.
 */
type Ouvinte = () => void;

const ouvintes = new Set<Ouvinte>();
let janela: Window | undefined;

export function assinarJanelaDestacada(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function lerJanelaDestacada(): Window | undefined {
  return janela;
}

export function definirJanelaDestacada(proxima: Window | undefined): void {
  if (proxima === janela) return;
  janela = proxima;
  for (const o of ouvintes) o();
}

/** Fecha a janela, se houver, e esquece dela. */
export function fecharJanelaDestacada(): void {
  const atual = janela;
  definirJanelaDestacada(undefined);
  try {
    atual?.close();
  } catch {
    // Já fechada.
  }
}
