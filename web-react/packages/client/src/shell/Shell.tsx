import type { ReactNode } from "react";

import css from "./Shell.module.css";

/**
 * O shell de quatro colunas.
 *
 * Existe agora, na fase 1, porque retrofitar layout raiz é reescrever tela —
 * a mesma razão pela qual a virtualização veio antes de tudo na fase 0.
 *
 * As colunas laterais são propositalmente burras aqui: a fase 3 traz rail,
 * lista de canais e member list de verdade. O que a fase 1 precisa provar é a
 * geometria — que a coluna de conteúdo não estoura, que o texto não estica em
 * ultrawide, e que os painéis reagem ao próprio tamanho.
 */
export function Shell({
  ferramentas,
  conteudo,
  composer,
}: {
  ferramentas: ReactNode;
  conteudo: ReactNode;
  composer?: ReactNode;
}) {
  return (
    <div className={css.shell}>
      <nav className={`${css.coluna} ${css.rail}`} aria-label="Servidores">
        <div className="flex flex-col items-center gap-2 py-3">
          {["alfa", "beta", "gama"].map((servidor) => (
            <div key={servidor} className="size-5 rounded-4 bg-surface-3" />
          ))}
        </div>
      </nav>

      <nav className={`${css.coluna} ${css.canais}`} aria-label="Canais">
        <div className="flex flex-col gap-1 p-3">
          <span className={`${css.rotulo} text-xs text-text-3`}>canais</span>
          {["spike", "geral", "voz"].map((nome) => (
            <span key={nome} className="truncate text-md text-text-2">
              # {nome}
            </span>
          ))}
        </div>
      </nav>

      <main className={`${css.coluna} ${css.conteudo}`}>
        {ferramentas}
        {/* minmax(0,1fr) na linha: sem isto o conteúdo empurra e o grid estoura. */}
        <div className="min-h-0">{conteudo}</div>
        {/* Terceira linha `auto`: o composer cresce e a lista encolhe, nunca o
            contrário. Sem a linha própria, um campo de dez linhas empurraria a
            lista para fora do grid em vez de tomar espaço dela. */}
        {composer}
      </main>

      <aside className={`${css.coluna} ${css.membros}`} aria-label="Membros">
        <div className="flex flex-col gap-2 p-3">
          <span className={`${css.rotulo} text-xs text-text-3`}>membros</span>
          {["user0", "user1", "user2"].map((nome) => (
            <span key={nome} className="truncate text-md text-text-2">
              {nome}
            </span>
          ))}
        </div>
      </aside>
    </div>
  );
}
