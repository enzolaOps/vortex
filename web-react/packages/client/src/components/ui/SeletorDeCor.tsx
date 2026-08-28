import css from "./SeletorDeCor.module.css";

/**
 * Seletor de cor.
 *
 * O ÚNICO lugar do projeto onde `<input type="color">` pode aparecer, e a
 * exceção é justificada: o que ele abre é o seletor de cor do SISTEMA
 * OPERACIONAL. Reimplementar isso significaria escrever um color picker
 * inteiro — roda de matiz, campo de saturação, entrada por hex, gestão de
 * foco — que é a definição de "genérico que a biblioteca resolve", e nenhuma
 * biblioteca resolve melhor que o SO na máquina de quem usa.
 *
 * O que NÃO é insubstituível é o gatilho. Cru, ele chega com moldura e padding
 * do sistema, e a identidade do produto termina naquele retângulo. Aqui ele é
 * uma amostra da nossa cor com a nossa borda; o diálogo do SO só aparece
 * depois do clique, que é onde ele deve estar.
 *
 * Esta separação — "o que o SO faz melhor fica com o SO, o que é nosso fica
 * nosso" — é a mesma régua que manteve o `Deslizante` sem dependência: o range
 * nativo já entrega arrastar, teclado e ARIA corretos, e só faltava aparência.
 */
export function SeletorDeCor({
  id,
  valor,
  rotulo,
  aoMudar,
}: {
  id: string;
  valor: string;
  rotulo: string;
  aoMudar: (hex: string) => void;
}) {
  return (
    <input
      id={id}
      type="color"
      className={css.seletor}
      value={valor}
      aria-label={rotulo}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );
}
