import { chat, ds } from "../../textos";
import { juntar } from "../juntar";
import css from "./Digitando.module.css";

export interface DigitandoProps {
  /** Quem está digitando; vazio não renderiza texto. */
  nomes: readonly string[];
  className?: string;
}

function frase(nomes: readonly string[]): string {
  const [a, b] = nomes;
  if (a === undefined) return "";
  if (nomes.length === 1) return chat.digitando(a);
  if (nomes.length === 2 && b !== undefined) return ds.digitando.dois(`${a} ${ds.digitando.e} ${b}`);
  return ds.digitando.varios;
}

/**
 * Região viva e educada: a região fica sempre montada (leitor de tela só anuncia
 * mudança numa região que já existia) e o texto entra e sai dela. Os pontos
 * animam só opacidade.
 */
export function Digitando({ nomes, className }: DigitandoProps) {
  const texto = frase(nomes);
  return (
    <div role="status" aria-live="polite" className={juntar(css.digitando, className)}>
      {texto && (
        <>
          <span className={css.pontos} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{texto}</span>
        </>
      )}
    </div>
  );
}
