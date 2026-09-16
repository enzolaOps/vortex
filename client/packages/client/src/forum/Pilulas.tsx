import { cn } from "../lib/cn";
import css from "./Pilulas.module.css";

/**
 * As pílulas de escolha do fórum e da galeria — ordenação, densidade, tipo.
 *
 * ⚠ **Não é o `Segmentado`**, e a diferença está medida no design: o
 * segmentado é um trilho afundado com o escolhido em acento SÓLIDO; estas são
 * soltas (`gap:4px`), com o escolhido em acento a 16% e texto `accent-text`.
 * `emCaixa` é o seletor lista/grade, que o design põe dentro de uma caixa em
 * `surface-3` com 2px de respiro.
 *
 * Mora aqui e não em `components/ui/` porque tem três consumidores, todos
 * nestas duas telas.
 */
export function Pilulas<T extends string>({
  rotulo,
  valor,
  opcoes,
  aoEscolher,
  emCaixa = false,
  redonda = false,
}: {
  /** O filtro de tipo da galeria: pílula de raio cheio e repouso em `surface-3`. */
  redonda?: boolean;
  rotulo: string;
  valor: T;
  /** `nome` é o nome acessível quando o rótulo é um glifo (☰ ▦). */
  opcoes: readonly { id: T; rotulo: string; nome?: string }[];
  aoEscolher: (id: T) => void;
  emCaixa?: boolean;
}) {
  return (
    <div className={cn(css.grupo, emCaixa && css.caixa)} role="group" aria-label={rotulo}>
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={valor === o.id}
          aria-label={o.nome}
          className={cn(css.pilula, emCaixa && css.quadrada, redonda && css.redonda)}
          onClick={() => aoEscolher(o.id)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
