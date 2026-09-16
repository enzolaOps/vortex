import { useFigurinha } from "../expressoes/hooks";
import css from "./FigurinhaNaLinha.module.css";

/**
 * A figurinha dentro da linha de mensagem.
 *
 * ⚠ **O design não desenha a figurinha na timeline** — só o seletor e a página
 * de configurações. 160×160 é a medida dos clientes da categoria, e é FIXA:
 * a caixa existe antes de o arquivo chegar, e é isso que `ALTURA_DE_FIGURINHA`
 * soma na estimativa sem mover a âncora.
 *
 * Três estados sem layout shift: carregando (xadrez), achada (imagem contida)
 * e removida (texto dentro da mesma caixa) — a figurinha apagada deixa de ter
 * nome e URL, e a linha continua dizendo que ali houve uma.
 */
export function FigurinhaNaLinha({ id }: { id: string }) {
  const figurinha = useFigurinha(id);
  return (
    <div className={css.caixa}>
      {figurinha?.url ? (
        <img
          className={css.imagem}
          src={figurinha.url}
          alt={`Figurinha: ${figurinha.nome}`}
          title={figurinha.nome}
          loading="lazy"
          draggable={false}
        />
      ) : figurinha ? (
        <span className={css.aviso} role="img" aria-label={`Figurinha: ${figurinha.nome}`}>
          {figurinha.emoji ?? figurinha.nome}
        </span>
      ) : (
        <span className={css.aviso}>figurinha</span>
      )}
    </div>
  );
}
