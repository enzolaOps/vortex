import { cn } from "../../lib/cn";
import css from "./Girador.module.css";

export type GiradorProps = {
  /** Diâmetro em px. 12 dentro de botão, 14 solto, 20 em tela cheia. */
  tamanho?: number;
  /** Espessura do arco. 2 abaixo de 20px, 3 acima. */
  espessura?: number;
  /**
   * O que está carregando, para quem usa leitor de tela.
   *
   * ⚠ Ele NÃO é opcional dentro de um botão que troca de rótulo: o botão já
   * anuncia "Salvando" pelo texto, e um segundo `role="status"` dizendo
   * "Carregando" faria o leitor ler as duas coisas. Passe `rotulo=""` quando
   * o contexto já disser, e o anel some da árvore de acessibilidade.
   */
  rotulo?: string;
  className?: string;
};

/**
 * Anel indeterminado.
 *
 * A cor vem de `currentColor`, então dentro de um botão ele já sai na cor do
 * texto daquela variante — sem prop de tom e sem uma lista de variantes que
 * precisaria concordar com a do `Botao`.
 */
export function Girador({
  tamanho = 14,
  espessura = 2,
  rotulo = "Carregando",
  className,
}: GiradorProps) {
  return (
    <span
      {...(rotulo ? { role: "status", "aria-label": rotulo } : { "aria-hidden": true })}
      className={cn(css.girador, className)}
      style={{
        inlineSize: tamanho,
        blockSize: tamanho,
        borderWidth: espessura,
      }}
    />
  );
}
