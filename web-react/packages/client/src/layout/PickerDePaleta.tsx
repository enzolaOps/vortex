import {
  CaretDown,
  ICONE,
} from "../components/ui/icones";
import { useState, useSyncExternalStore } from "react";

import { Deslizante } from "../components/ui/Deslizante";
import { SeletorDeCor } from "../components/ui/SeletorDeCor";
import { Segmentado } from "../components/ui/Segmentado";
import { assinarLayout, definirSemente, lerSemente } from "../store/layout";
import { paletaFinal } from "../tema/aplicar";
import { LIMITES_DA_SEMENTE, SEMENTE_PADRAO, type Modo } from "../tema/derivar";
import { PALETAS, paletaDe } from "../tema/paletas";
import { verificar } from "../tema/pares";
import css from "./PickerDePaleta.module.css";

const MODOS = [
  { id: "escuro" as Modo, rotulo: "escuro" },
  { id: "claro" as Modo, rotulo: "claro" },
];

/**
 * Miniatura do shell, com a paleta aplicada.
 *
 * Substitui oito quadradinhos de cor, que era a versão anterior. A diferença
 * não é enfeite: quadradinho mostra a cor, miniatura mostra a RELAÇÃO — quanto
 * a lista de canais se separa do fundo, se o texto apagado ainda se lê, se o
 * acento aparece ou some. Ninguém escolhe paleta olhando para um `#16151c`.
 *
 * Cinco retângulos e três linhas de texto falso. Custo de pintura irrisório, e
 * comunica o que a paleta faz na tela em que ela vai viver.
 */
function Miniatura({ paleta }: { paleta: Record<string, string> }) {
  const cor = (t: string) => paleta[t] ?? "transparent";

  return (
    <div
      className={css.miniatura}
      style={{ background: cor("--vx-surface-0") }}
      aria-hidden
    >
      <span className={css.miniRail} style={{ background: cor("--vx-surface-1") }}>
        <span className={css.miniMarca} style={{ background: cor("--vx-accent") }} />
        <span className={css.miniMarca} style={{ background: cor("--vx-surface-3") }} />
      </span>

      <span className={css.miniCanais} style={{ background: cor("--vx-surface-1") }}>
        <span className={css.miniLinha} style={{ background: cor("--vx-text-3") }} />
        <span
          className={css.miniLinhaAtiva}
          style={{ background: cor("--vx-accent-soft"), color: cor("--vx-accent") }}
        />
        <span className={css.miniLinha} style={{ background: cor("--vx-text-3") }} />
      </span>

      <span className={css.miniConteudo}>
        <span className={css.miniNome} style={{ background: cor("--vx-text-1") }} />
        <span className={css.miniTexto} style={{ background: cor("--vx-text-2") }} />
        <span className={css.miniTextoCurto} style={{ background: cor("--vx-text-2") }} />
        <span className={css.miniMeta} style={{ background: cor("--vx-text-3") }} />
      </span>

      <span className={css.miniMembros} style={{ background: cor("--vx-surface-1") }}>
        <span className={css.miniPonto} style={{ background: cor("--vx-status-online") }} />
        <span className={css.miniPonto} style={{ background: cor("--vx-status-idle") }} />
        <span className={css.miniPonto} style={{ background: cor("--vx-status-dnd") }} />
      </span>
    </div>
  );
}

/**
 * O picker de paleta.
 *
 * Reescrito. A primeira versão expunha matiz e croma como controles de topo —
 * os parâmetros da derivação virando interface. Agora o topo é escolha de
 * paleta com preview, e os parâmetros ficam atrás de "ajuste fino", onde
 * pertencem: são a escotilha de quem quer sair das seis, não o caminho normal.
 *
 * A garantia de contraste não mudou e continua sendo o ponto: o usuário escolhe
 * matiz e croma, o app decide toda a luminosidade, e a varredura em teste prova
 * que nenhuma combinação reprova. Por isso a folga aparece como informação, e
 * não como alerta.
 */
export function PickerDePaleta() {
  const semente = useSyncExternalStore(assinarLayout, lerSemente);
  const [ajustando, setAjustando] = useState(false);

  const paleta = paletaFinal(semente);
  const veredito = verificar(paleta);
  const apertado = veredito.maisApertado;
  const escolhida = paletaDe(semente.matiz, semente.croma, semente.acento);

  return (
    <section className={css.picker} aria-label="Paleta">
      <div className={css.topo}>
        <Miniatura paleta={paleta} />

        <div className={css.controles}>
          <Segmentado
            rotulo="Modo do tema"
            valor={semente.modo}
            opcoes={MODOS}
            aoEscolher={(modo) =>
              // Trocar de modo troca a RAMPA inteira; matiz e croma seguem,
              // o resto vem do padrão daquele modo.
              definirSemente({
                ...SEMENTE_PADRAO[modo],
                matiz: semente.matiz,
                croma: semente.croma,
                acento: semente.acento,
              })
            }
          />

          <p className={css.veredito} data-ok={veredito.ok}>
            {veredito.ok && apertado ? (
              <>
                contraste ok · mais apertado{" "}
                <strong>{apertado.razao.toFixed(2)}:1</strong> (mín {apertado.par.min})
              </>
            ) : (
              <>{veredito.falhas.length} pares abaixo do mínimo — bug da derivação</>
            )}
          </p>
        </div>
      </div>

      <div className={css.paletas} role="radiogroup" aria-label="Paleta de cores">
        {PALETAS.map((p) => {
          const previa = paletaFinal({ ...semente, ...p });
          const ativa = escolhida === p.id;

          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={ativa}
              className={css.swatch}
              onClick={() => definirSemente({ ...semente, ...p })}
            >
              {/* Cinco barras, como um swatch de tema do Slack: reconhecimento
                  instantâneo, sem abstração nenhuma no caminho. */}
              <span className={css.barras}>
                {[
                  "--vx-surface-0",
                  "--vx-surface-2",
                  "--vx-accent",
                  "--vx-text-2",
                  "--vx-text-1",
                ].map((t) => (
                  <span
                    key={t}
                    className={css.barra}
                    style={{ background: previa[t as keyof typeof previa] }}
                  />
                ))}
              </span>
              <span className={css.nome}>{p.nome}</span>
            </button>
          );
        })}
      </div>

      <div className={css.fino}>
        <button
          type="button"
          className={css.disclosure}
          aria-expanded={ajustando}
          onClick={() => setAjustando((v) => !v)}
        >
          <CaretDown size={ICONE.calha} aria-hidden data-aberto={ajustando} className={css.caret} />
          ajuste fino
        </button>

        {ajustando ? (
          <div className={css.finoCorpo}>
            <div className={css.linha}>
              <label className={css.rotulo} htmlFor="picker-acento">
                ação
              </label>
              <SeletorDeCor
                id="picker-acento"
                rotulo="Cor de ação"
                valor={paleta["--vx-accent"]}
                aoMudar={(acento) => definirSemente({ ...semente, acento })}
              />
              <span className={css.medida}>{paleta["--vx-accent"]}</span>
            </div>

            <div className={css.linha}>
              <label className={css.rotulo} htmlFor="picker-matiz">
                matiz
              </label>
              <Deslizante
                id="picker-matiz"
                rotulo="Matiz do neutro"
                texto={`${Math.round(semente.matiz)} graus`}
                valor={semente.matiz}
                min={LIMITES_DA_SEMENTE.matiz.min}
                max={LIMITES_DA_SEMENTE.matiz.max}
                passo={1}
                aoMudar={(matiz) => definirSemente({ ...semente, matiz })}
              />
              <span className={css.medida}>{Math.round(semente.matiz)}°</span>
            </div>

            <div className={css.linha}>
              <label className={css.rotulo} htmlFor="picker-croma">
                cor no cinza
              </label>
              <Deslizante
                id="picker-croma"
                rotulo="Saturação do neutro"
                texto={`${Math.round(semente.croma * 100)} por cento`}
                valor={semente.croma}
                min={LIMITES_DA_SEMENTE.croma.min}
                max={LIMITES_DA_SEMENTE.croma.max}
                passo={0.05}
                aoMudar={(croma) => definirSemente({ ...semente, croma })}
              />
              <span className={css.medida}>{Math.round(semente.croma * 100)}%</span>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
