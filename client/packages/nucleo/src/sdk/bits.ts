/**
 * `ViewChannel` — o bit que torna um canal PRIVADO quando negado a @everyone.
 *
 * ⚠ **É o bit 20, e três lugares deste repositório escreviam o bit 0.** Um
 * comentário repetido em `map.ts`, `fecharCanal` e no arnês afirmava "bit 0
 * do `Permission` é `ViewChannel`" — o bit 0 é `ManageChannel`. Consequência,
 * sem erro nenhum: "criar canal privado" gravava `deny: 1`, ou seja um canal
 * ABERTO a todo mundo em que ninguém podia gerenciá-lo, e o cadeado da coluna
 * acendia sobre ele. O diff da fatia 2 de #295 denunciou mostrando
 * "✕ Gerenciar canais" onde o arnês dizia "privado".
 *
 * Constante própria, num módulo sem dependência, porque `map.ts` e `canal.ts`
 * a leem dos dois lados de um ciclo de import (`canal.ts` importa o adapter,
 * que importa `map.ts`). O teste a confere contra a tabela do `stoat.js`.
 */
export const BIT_VER_CANAL = 1n << 20n;
