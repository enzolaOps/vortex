import { LockSimple } from "@phosphor-icons/react";
import { useState } from "react";

import { aindaNao } from "../pendente/pendencias";
import { CascaDeSeletor, SecaoDeSeletor } from "./CascaDeSeletor";
import { CATEGORIAS, buscar, type Emoji } from "./emojis";
import css from "./Seletores.module.css";

/**
 * O seletor de emoji — e ele FUNCIONA.
 *
 * É o único dos quatro que não depende de nada que o app não tenha: emoji
 * Unicode é texto, e inserir texto no rascunho é o que o composer já faz a
 * cada tecla. Os outros três dependem de rede externa (GIF) ou de conceitos
 * que o protocolo não tem (figurinha, som).
 *
 * ⚠ **Os emojis do SERVIDOR ficam de fora, e o design os desenha** — a fileira
 * "Vortex Core · 24 emojis" com os ladrilhos `vtx`, `ship`, `wip`. O protocolo
 * tem `Emoji` e o servidor os entrega no `Ready`; o que falta é o servidor de
 * mídia servi-los, que é a mesma dependência de `anexar` e da tela de emojis
 * em configurações. A seção aparece com o estado de bloqueio que o próprio
 * design desenha para o caso sem permissão — que é a verdade aqui.
 */
export function SeletorDeEmoji({
  aoEscolher,
}: {
  /** Chamado com o glifo. Quem abriu decide o que fazer — inserir ou reagir. */
  aoEscolher: (glifo: string) => void;
}) {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]!.id);
  /*
    O emoji sob o ponteiro, para o rodapé.

    Estado local e não um `:hover` em CSS porque o rodapé mostra o NOME, que o
    CSS não alcança. É o mesmo padrão do design, que chama esta faixa de
    "rodapé de prévia".
  */
  const [sobre, setSobre] = useState<Emoji | null>(null);

  const encontrados = buscar(busca);
  const buscando = busca.trim().length > 0;

  return (
    <CascaDeSeletor
      rotulo="Emoji"
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar emoji" }}
      acaoDaBusca={
        /*
          O tom de pele. Desenhado e pendente: aplicá-lo exige o modificador
          Fitzpatrick por emoji, e a lista curada não os carrega — mudar o
          seletor sem mudar os dados daria um controle que não muda nada.
        */
        <button
          type="button"
          className={css.tomDePele}
          aria-label="Tom de pele"
          onClick={aindaNao("tomDePele")}
        />
      }
      rail={
        <>
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={css.categoria}
              aria-label={c.titulo}
              aria-pressed={c.id === categoria && !buscando}
              onClick={() => {
                setBusca("");
                setCategoria(c.id);
              }}
            >
              <span aria-hidden>{c.icone}</span>
            </button>
          ))}
        </>
      }
      rodape={
        sobre ? (
          <>
            <span className={css.previaGlifo} aria-hidden>
              {sobre.glifo}
            </span>
            <div className={css.previaTexto}>
              <span className={css.previaNome}>:{sobre.nome}:</span>
              <span className={css.previaOrigem}>Unicode</span>
            </div>
          </>
        ) : (
          <span className={css.previaOrigem}>
            Escolha um emoji — Enter envia, Esc fecha
          </span>
        )
      }
    >
      {buscando ? (
        <SecaoDeSeletor
          titulo={
            encontrados.length > 0
              ? `${encontrados.length} resultados`
              : "Nada encontrado"
          }
          grude
        >
          <Grade emojis={encontrados} aoEscolher={aoEscolher} aoPassar={setSobre} />
        </SecaoDeSeletor>
      ) : (
        CATEGORIAS.filter((c) => c.id === categoria).map((c) => (
          <SecaoDeSeletor key={c.id} titulo={c.titulo} grude>
            <Grade emojis={c.emojis} aoEscolher={aoEscolher} aoPassar={setSobre} />
          </SecaoDeSeletor>
        ))
      )}

      {/*
        A seção de emojis do servidor, no estado que ela realmente tem.

        O design desenha um ladrilho `🔒` esmaecido para o caso sem permissão,
        e escreve a regra por extenso: *"emoji, figurinha e som sem permissão
        aparecem esmaecidos e clicáveis (com tooltip do motivo), não removidos
        — assim o usuário entende que existe"*. É exatamente o tratamento certo
        aqui, porque a razão é a mesma do ponto de vista de quem usa: existe, e
        você não pode usar ainda.
      */}
      {!buscando ? (
        <SecaoDeSeletor titulo="Emojis do servidor">
          <button
            type="button"
            className={css.bloqueado}
            onClick={aindaNao("emojiDoServidor")}
          >
            <LockSimple aria-hidden />
            Emojis do servidor ainda não carregam
          </button>
        </SecaoDeSeletor>
      ) : null}
    </CascaDeSeletor>
  );
}

function Grade({
  emojis,
  aoEscolher,
  aoPassar,
}: {
  emojis: readonly Emoji[];
  aoEscolher: (glifo: string) => void;
  aoPassar: (e: Emoji | null) => void;
}) {
  return (
    <div className={css.grade}>
      {emojis.map((e) => (
        <button
          key={e.glifo}
          type="button"
          className={css.emoji}
          aria-label={e.nome}
          onClick={() => aoEscolher(e.glifo)}
          onPointerEnter={() => aoPassar(e)}
          /* Foco também alimenta a prévia: quem navega por seta precisa da
             mesma informação que quem navega com o ponteiro. */
          onFocus={() => aoPassar(e)}
        >
          <span aria-hidden>{e.glifo}</span>
        </button>
      ))}
    </div>
  );
}
