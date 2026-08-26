import type { ReactNode } from "react";

import css from "./Shell.module.css";

/**
 * O shell de quatro colunas.
 *
 * Existe desde a fase 1, porque retrofitar layout raiz é reescrever tela — a
 * mesma razão pela qual a virtualização veio antes de tudo na fase 0.
 *
 * As colunas laterais deixaram de ser placeholders na fase 3, e o shell
 * ganhou a forma que a fase 4 precisa: ele não SABE o que vai em cada coluna,
 * só onde as colunas ficam. Rail, canais e membros entram como slots.
 *
 * Isso não é abstração antecipada — é o que a lei nº 6 pede em troca de nada:
 * o shell já não podia assumir o conteúdo dos painéis, e ter os componentes
 * importados aqui dentro seria exatamente a premissa de irmão que a lei
 * proíbe. Trocar dois slots de lugar vira mudar duas props.
 */
export function Shell({
  rail,
  canais,
  ferramentas,
  conteudo,
  composer,
  membros,
}: {
  rail: ReactNode;
  canais: ReactNode;
  ferramentas: ReactNode;
  conteudo: ReactNode;
  composer?: ReactNode;
  membros: ReactNode;
}) {
  return (
    <div className={css.shell}>
      <div className={`${css.coluna} ${css.rail}`}>{rail}</div>

      <div className={`${css.coluna} ${css.canais}`}>{canais}</div>

      <main className={`${css.coluna} ${css.conteudo}`}>
        {ferramentas}
        {/* minmax(0,1fr) na linha: sem isto o conteúdo empurra e o grid estoura. */}
        <div className="min-h-0">{conteudo}</div>
        {/* Terceira linha `auto`: o composer cresce e a lista encolhe, nunca o
            contrário. Sem a linha própria, um campo de dez linhas empurraria a
            lista para fora do grid em vez de tomar espaço dela. */}
        {composer}
      </main>

      <aside className={`${css.coluna} ${css.membros}`}>{membros}</aside>
    </div>
  );
}
