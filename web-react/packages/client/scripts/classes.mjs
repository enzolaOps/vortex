/**
 * Verifica que `cn()` resolve conflito na escala DESTE projeto.
 *
 * A escala default do Tailwind foi desativada em `tokens.css` e substituída
 * por uma fechada. O `tailwind-merge` só sabe resolver os grupos que conhece,
 * então cada escala renomeada é uma chance de ele deixar as duas classes
 * passarem — e a falha é silenciosa: nada quebra, o estilo só sai errado
 * conforme a ordem no CSS.
 *
 * Foi assim que `rounded-2 rounded-4` apareceu, e é por isso que este arquivo
 * existe em vez de uma nota no README.
 */
import { cn } from "../src/lib/cn.ts";

const casos = [
  ["p-3 p-5", "p-5", "espaço"],
  ["px-3 px-2", "px-2", "espaço no eixo"],
  ["bg-surface-1 bg-surface-3", "bg-surface-3", "superfície"],
  ["text-text-2 text-text-1", "text-text-1", "cor de texto"],
  ["text-sm text-lg", "text-lg", "tamanho de tipo"],
  ["rounded-2 rounded-4", "rounded-4", "raio — o que motivou o arquivo"],
  ["rounded-1 rounded-2 rounded-3", "rounded-3", "raio, três em sequência"],
  ["border-border-subtle border-border-strong", "border-border-strong", "borda"],
  ["bg-surface-1 text-text-1", "bg-surface-1 text-text-1", "não conflitam"],
  ["gap-2 gap-4", "gap-4", "gap"],
];

let falhas = 0;

for (const [entrada, esperado, nota] of casos) {
  const saida = cn(entrada);
  const ok = saida === esperado;
  if (!ok) falhas += 1;
  console.log(
    `  ${ok ? "ok  " : "FALHA"}  ${entrada.padEnd(42)} -> ${saida.padEnd(26)} ${nota}`,
  );
}

console.log(
  `\n${falhas === 0 ? "PASSA" : "FALHA"} — ${casos.length - falhas}/${casos.length} conflitos resolvidos\n`,
);

process.exit(falhas === 0 ? 0 : 1);
