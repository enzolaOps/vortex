import { Avatar } from "../components/ui/Avatar";
import type { AlvoDeMencao } from "../sdk/completarMencao";
import css from "./SugestoesDeMencao.module.css";

export function SugestoesDeMencao({
  alvos,
  ativo,
  aoEscolher,
  aoAtivo,
}: {
  alvos: readonly AlvoDeMencao[];
  ativo: number;
  aoEscolher: (alvo: AlvoDeMencao) => void;
  aoAtivo: (i: number) => void;
}) {
  if (alvos.length === 0) return null;

  return (
    <ul
      className={css.lista}
      role="listbox"
      aria-label="Mencionar"
      onMouseDown={(e) => e.preventDefault()}
    >
      {alvos.map((alvo, i) => (
        <li key={alvo.id} role="presentation">
          <button
            type="button"
            role="option"
            aria-selected={i === ativo}
            className={css.item}
            onMouseEnter={() => aoAtivo(i)}
            onClick={() => aoEscolher(alvo)}
          >
            <Avatar id={alvo.id} sigla={alvo.sigla} tamanho="xs" />
            <span className={css.nome}>{alvo.nome}</span>
            {alvo.username !== alvo.nome ? (
              <span className={css.username}>{alvo.username}</span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
