import { assinarEmojisRecentes, lerEmojisRecentes } from "nucleo/store/emojisRecentes";
import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";

import { chat } from "../../../textos";
import { Buscar } from "../../../ui/icones";
import { juntar } from "../../../ui/juntar";
import css from "./Emoji.module.css";
import { buscar, CATEGORIAS, TODOS, type Emoji } from "./emojis";

const NOME_POR_GLIFO = new Map(TODOS.map((e) => [e.glifo, e.nome]));

type Secao = { id: string; icone: string; titulo: string; emojis: readonly Emoji[] };

/**
 * O painel do seletor: busca, recentes e categorias. É o conteúdo que o
 * `PainelPreguicoso` carrega sob demanda, junto com a lista de emojis.
 *
 * Foco: a busca recebe o foco ao abrir; a seta para baixo leva à grade, onde
 * as setas andam por geometria (as seções quebram a conta de "oito por linha").
 * A grade é UMA parada de tabulação, não cento e setenta.
 */
export default function PainelDeEmoji({ aoEscolher }: { aoEscolher: (glifo: string) => void }) {
  const [busca, setBusca] = useState("");
  const [ativa, setAtiva] = useState<string | undefined>(undefined);
  const recentes = useSyncExternalStore(assinarEmojisRecentes, lerEmojisRecentes);
  const rolagem = useRef<HTMLDivElement | null>(null);
  const campo = useRef<HTMLInputElement | null>(null);

  const procurando = busca.trim() !== "";
  const secoes: readonly Secao[] = procurando
    ? [{ id: "resultados", icone: "🔎", titulo: chat.emoji.resultados, emojis: buscar(busca) }]
    : [
        ...(recentes.length > 0
          ? [
              {
                id: "recentes",
                icone: "🕘",
                titulo: chat.emoji.recentes,
                emojis: recentes.map((glifo) => ({ glifo, nome: NOME_POR_GLIFO.get(glifo) ?? glifo })),
              },
            ]
          : []),
        ...CATEGORIAS,
      ];
  const vazio = procurando && secoes[0]?.emojis.length === 0;
  const secaoAtiva = ativa ?? secoes[0]?.id;

  const botoes = () => Array.from(rolagem.current?.querySelectorAll<HTMLButtonElement>("[data-emoji]") ?? []);

  const aoTeclarNaGrade = (e: KeyboardEvent<HTMLDivElement>) => {
    const lista = botoes();
    const i = lista.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    const atual = lista[i]!;
    let alvo: HTMLButtonElement | undefined;
    if (e.key === "ArrowRight") alvo = lista[i + 1];
    else if (e.key === "ArrowLeft") alvo = lista[i - 1];
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const r = atual.getBoundingClientRect();
      const baixo = e.key === "ArrowDown";
      let melhor = Infinity;
      for (const b of lista) {
        const o = b.getBoundingClientRect();
        const dy = baixo ? o.top - r.top : r.top - o.top;
        if (dy <= 1) continue;
        // A linha mais próxima na vertical e, nela, a coluna mais próxima.
        const custo = dy * 1000 + Math.abs(o.left - r.left);
        if (custo < melhor) {
          melhor = custo;
          alvo = b;
        }
      }
      if (alvo === undefined && !baixo) {
        e.preventDefault();
        campo.current?.focus();
        return;
      }
    } else return;
    if (alvo === undefined) return;
    e.preventDefault();
    atual.tabIndex = -1;
    alvo.tabIndex = 0;
    alvo.focus();
  };

  return (
    <div className={css.painel}>
      <label className={css.busca}>
        <Buscar tamanho={16} />
        <input
          ref={campo}
          type="search"
          className={css.campo}
          value={busca}
          placeholder={chat.emoji.buscar}
          aria-label={chat.emoji.buscar}
          // O seletor abre para escolher: o foco é da busca.
          autoFocus
          onChange={(e) => {
            setBusca(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown") return;
            e.preventDefault();
            const primeiro = botoes()[0];
            if (primeiro) {
              primeiro.tabIndex = 0;
              primeiro.focus();
            }
          }}
        />
      </label>

      {!procurando && (
        <div className={css.categorias} role="group" aria-label={chat.emoji.categorias}>
          {secoes.map((s) => (
            <button
              key={s.id}
              type="button"
              className={juntar(css.categoria, secaoAtiva === s.id && css.categoriaAtiva)}
              aria-label={s.titulo}
              title={s.titulo}
              aria-pressed={secaoAtiva === s.id}
              onClick={() => {
                setAtiva(s.id);
                rolagem.current
                  ?.querySelector<HTMLElement>(`[data-secao="${s.id}"]`)
                  ?.scrollIntoView({ block: "start" });
              }}
            >
              {s.icone}
            </button>
          ))}
        </div>
      )}

      <div ref={rolagem} className={css.rolagem} onKeyDown={aoTeclarNaGrade}>
        {vazio ? (
          <p className={css.vazio} role="status">
            {chat.emoji.semResultado(busca.trim())}
          </p>
        ) : (
          secoes.map((s, n) => (
            <section key={s.id} data-secao={s.id} aria-label={s.titulo} className={css.secao}>
              <h3 className={css.tituloDaSecao}>{s.titulo}</h3>
              <div className={css.grade}>
                {s.emojis.map((em, i) => (
                  <button
                    key={em.glifo}
                    type="button"
                    data-emoji
                    className={css.emoji}
                    // Uma parada de tabulação na grade inteira: o primeiro emoji.
                    tabIndex={n === 0 && i === 0 ? 0 : -1}
                    aria-label={em.nome}
                    title={em.nome}
                    onClick={() => {
                      aoEscolher(em.glifo);
                    }}
                  >
                    {em.glifo}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
