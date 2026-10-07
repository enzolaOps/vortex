import { BarraDeTitulo, Shell } from "../../shell";
import { sessao } from "../../textos";
import { PainelVidro } from "../../ui/ds";
import { juntar } from "../../ui/juntar";
import css from "./Restauracao.module.css";
import { Marca } from "./Marca";

type Largura = "p" | "m" | "g" | "gg";
const LARGURA = { p: css.larguraP, m: css.larguraM, g: css.larguraG, gg: css.larguraGG } as const;

function Bloco({ forma, largura }: { forma: "linha" | "circulo" | "icone"; largura?: Largura }) {
  return (
    <span
      className={juntar(
        css.bloco,
        forma === "circulo" && css.circulo,
        forma === "icone" && css.icone,
        forma === "linha" && css.linha,
        largura && LARGURA[largura],
      )}
    />
  );
}

const MENSAGENS: readonly Largura[][] = [["p", "m"], ["p", "gg", "g"], ["p", "m"], ["p", "g", "gg", "m"]];

/**
 * O esqueleto do shell, mostrado enquanto a sessão é restaurada.
 *
 * Usa o `Shell` de verdade, com as mesmas regiões e a mesma grade: quando a sessão
 * vale, o conteúdo real aparece no lugar exato do esqueleto, sem salto. Existe para
 * que abrir o app com sessão guardada nunca pisque a tela de entrada: o estado
 * "ainda não sei" tem desenho próprio, e este é ele. Decorativo para o leitor de
 * tela, exceto o aviso de estado.
 */
export function TelaDeRestauracao() {
  return (
    <div className={css.raiz} aria-busy="true" data-testid="restaurando">
      <Shell
        testId="shell-esqueleto"
        barraDeTitulo={<BarraDeTitulo />}
        dock={
          <PainelVidro raio="xl" className={juntar(css.painel, css.dock)} aria-hidden="true">
            <Bloco forma="circulo" />
            <Bloco forma="circulo" />
            <Bloco forma="circulo" />
            <Bloco forma="circulo" />
          </PainelVidro>
        }
        salas={
          <PainelVidro raio="xl" className={css.painel} aria-hidden="true">
            <Bloco forma="linha" largura="m" />
            {(["g", "m", "m", "p", "g", "m"] as const).map((l, i) => (
              <div key={`${l}-${String(i)}`} className={css.itemDeSala}>
                <Bloco forma="icone" />
                <Bloco forma="linha" largura={l} />
              </div>
            ))}
          </PainelVidro>
        }
        principal={
          <PainelVidro como="div" variante="leitura" raio="xl" className={css.painel} aria-hidden="true">
            <div className={css.cabecaDaConversa}>
              <Bloco forma="linha" largura="g" />
            </div>
            <div className={css.mensagens}>
              {MENSAGENS.map((linhas, i) => (
                <div key={linhas.join("-") + String(i)} className={css.mensagem}>
                  <Bloco forma="circulo" />
                  <div className={css.textoDaMensagem}>
                    {linhas.map((l, j) => (
                      <Bloco key={`${l}-${String(j)}`} forma="linha" largura={l} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className={css.composer}>
              <Bloco forma="circulo" />
              <Bloco forma="linha" largura="g" />
            </div>
          </PainelVidro>
        }
        gaveta={
          <PainelVidro raio="xl" className={css.painel} aria-hidden="true">
            <Bloco forma="linha" largura="m" />
            {(["g", "m", "g", "p"] as const).map((l, i) => (
              <div key={`${l}-${String(i)}`} className={css.itemDeSala}>
                <Bloco forma="circulo" />
                <Bloco forma="linha" largura={l} />
              </div>
            ))}
          </PainelVidro>
        }
      />
      <div role="status" aria-live="polite" className={css.estado}>
        <Marca tamanho={40} className={css.pulso} />
        <span className={css.mensagemDeEstado}>{sessao.restaurando.mensagem}</span>
      </div>
    </div>
  );
}
