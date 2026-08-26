import { Lamina } from "./Lamina";
import css from "./Segmentado.module.css";

/**
 * Controle segmentado — escolha única entre poucas opções visíveis.
 *
 * Existe para substituir os `<select>` e os pares de botão soltos que a fase 4
 * espalhou. Um `<select>` nativo é renderizado pelo SISTEMA, não pelo app: a
 * identidade do produto termina na borda dele, e num app dark no Windows ele
 * chega com cromo claro. Foi o erro mais visível do painel de edição.
 *
 * Segmentado e não dropdown quando as opções cabem: ver as alternativas sem
 * abrir nada é mais rápido, e num painel de configuração a pessoa está
 * justamente comparando.
 *
 * Radiogroup de verdade, com as setas navegando — é o que o leitor de tela e o
 * teclado esperam de escolha única, e é de graça com `role="radio"`.
 */
export function Segmentado<T extends string>({
  valor,
  opcoes,
  aoEscolher,
  rotulo,
}: {
  valor: T;
  opcoes: readonly { readonly id: T; readonly rotulo: string }[];
  aoEscolher: (id: T) => void;
  rotulo: string;
}) {
  function aoTeclar(e: React.KeyboardEvent, i: number) {
    const passo = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (passo === 0) return;
    e.preventDefault();
    const proxima = opcoes[(i + passo + opcoes.length) % opcoes.length];
    if (proxima) aoEscolher(proxima.id);
  }

  return (
    <div className={css.grupo} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o, i) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={o.id === valor}
          tabIndex={o.id === valor ? 0 : -1}
          className={css.opcao}
          onClick={() => aoEscolher(o.id)}
          onKeyDown={(e) => aoTeclar(e, i)}
        >
          <Lamina ativa={o.id === valor} className={css.lamina} />
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
