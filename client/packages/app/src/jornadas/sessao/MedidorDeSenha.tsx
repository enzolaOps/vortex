import { sessao } from "../../textos";
import { forcaDaSenha } from "./regras";
import css from "./Entrada.module.css";

const BARRAS = ["a", "b", "c", "d"] as const;

/** A dica certa para o nível: o que falta, e não só "fraca". */
function dicaDe(senha: string): string {
  const t = sessao.senha;
  const f = forcaDaSenha(senha);
  if (f.nivel === "vazia") return t.dicaVazia;
  if (f.falta > 0) return t.dicaMinimo(f.falta);
  if (f.nivel === "fraca") return t.dicaMisturar;
  if (f.nivel === "media") return t.dicaAumentar;
  if (f.nivel === "boa") return t.dicaQuase;
  return t.dicaForte;
}

/**
 * Quatro barras e uma frase. As barras são decorativas para o leitor de tela (o que
 * importa está no texto), e a região é `aria-live` para anunciar a mudança de nível
 * sem pedir foco. É orientação local: o botão depende do mínimo, nunca do nível.
 */
export function MedidorDeSenha({ senha }: { senha: string }) {
  const forca = forcaDaSenha(senha);
  return (
    <div>
      <div className={css.medidor} aria-hidden="true">
        {BARRAS.map((b, i) => (
          <span key={b} className={css.barra} data-acesa={i < forca.barras} data-nivel={forca.nivel} />
        ))}
      </div>
      <div className={css.apoioDaSenha} aria-live="polite">
        <span className={css.rotuloDaForca}>
          {sessao.senha.forcaRotulo}: {sessao.senha.forca[forca.nivel]}
        </span>
        <span>{dicaDe(senha)}</span>
      </div>
    </div>
  );
}
