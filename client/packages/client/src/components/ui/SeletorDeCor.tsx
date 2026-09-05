import { cn } from "../../lib/cn";
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
  forma = "amostra",
  aoMudar,
}: {
  id: string;
  valor: string;
  rotulo: string;
  /**
   * `amostra` mostra a cor escolhida; `vaga` é o `+` tracejado.
   *
   * ⚠ **As duas existem porque o design usa as duas, e a diferença é de
   * PAPEL.** Onde o seletor É o controle da cor, ele mostra a cor. Onde ele é
   * a última casa de uma fileira de amostras — cargo, faixa de convite —, o
   * que ele oferece é "uma cor que não está aqui", e mostrar uma cor ali faria
   * parecer a sexta opção fixa em vez do caminho para qualquer outra.
   *
   * A forma mora AQUI e não no consumidor de propósito: sobrescrever a
   * geometria de um primitivo a partir do módulo de quem o usa é o defeito que
   * a largura do `Dialog` já registrou — dois donos do mesmo número, e ganha
   * quem o bundler puser por último.
   */
  forma?: "amostra" | "vaga";
  aoMudar: (hex: string) => void;
}) {
  const entrada = (
    <input
      id={id}
      type="color"
      className={cn(css.seletor, forma === "vaga" && css.escondido)}
      value={valor}
      aria-label={rotulo}
      onChange={(e) => aoMudar(e.target.value)}
    />
  );

  if (forma === "amostra") return entrada;

  return (
    <span className={css.vaga}>
      <span className={css.mais} aria-hidden>
        +
      </span>
      {entrada}
    </span>
  );
}
