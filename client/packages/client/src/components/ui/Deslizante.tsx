import css from "./Deslizante.module.css";

/**
 * Deslizante.
 *
 * `<input type="range">` estilizado, e NÃO `@radix-ui/react-slider`. A regra do
 * projeto é "biblioteca resolve o genérico; você escreve o específico", e o que
 * o Radix resolveria aqui — arrastar, teclado, ARIA — o input nativo já entrega
 * de fábrica e correto. O que faltava era só aparência, que é justamente o que
 * nenhuma biblioteca resolve por você.
 *
 * Trazer uma dependência para pintar um trilho seria pagar bundle e uma
 * fronteira de import por CSS.
 *
 * `aria-valuetext` é obrigatório e não decorativo: sem ele o leitor de tela
 * anuncia "295" para um matiz e "1,5" para saturação, que não significam nada
 * fora da cabeça de quem implementou.
 */
export function Deslizante({
  id,
  valor,
  min,
  max,
  passo,
  rotulo,
  texto,
  aoMudar,
}: {
  id: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  rotulo: string;
  texto: string;
  aoMudar: (valor: number) => void;
}) {
  return (
    <input
      id={id}
      type="range"
      className={css.deslizante}
      min={min}
      max={max}
      step={passo}
      value={valor}
      aria-label={rotulo}
      aria-valuetext={texto}
      onChange={(e) => aoMudar(Number(e.target.value))}
    />
  );
}
