/**
 * Bytes em algo que se lê.
 *
 * Base 1000 e não 1024: o rótulo é "KB", e é o que todo sistema operacional
 * de mesa mostra hoje. Usar 1024 e escrever "KB" é o erro que faz um arquivo
 * de 284.000 bytes aparecer como "277 KB" e não bater com o Finder nem com o
 * Explorador.
 *
 * Uma casa decimal só abaixo de 10 — "1,4 MB" ajuda, "284,0 KB" é ruído.
 *
 * ⚠ **Mora em `lib/` porque tem DOIS consumidores em camadas diferentes**, e
 * o segundo chegou com o upload: o rótulo do anexo na linha (`sdk/map.ts`) e a
 * frase de "arquivo grande demais" (`sdk/erros.ts`). O `erros.ts` é folha de
 * propósito — não importa nada —, e fazê-lo importar o `map.ts` arrastaria
 * `stoat.js` e o analisador de markdown para dentro de um tradutor de frases.
 */
export function formatarBytes(
  bytes: number | undefined | null,
): string | undefined {
  if (bytes === undefined || bytes === null || bytes < 0) return undefined;
  if (bytes < 1000) return `${bytes} B`;

  const unidades = ["KB", "MB", "GB", "TB"] as const;
  let valor = bytes / 1000;
  let i = 0;
  while (valor >= 1000 && i < unidades.length - 1) {
    valor /= 1000;
    i += 1;
  }
  const casas = valor < 10 ? 1 : 0;
  return `${valor.toFixed(casas).replace(".", ",")} ${unidades[i]}`;
}
