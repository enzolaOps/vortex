import { useState, useSyncExternalStore } from "react";

import { Deslizante } from "../components/ui/Deslizante";
import { aindaNao } from "../pendente/pendencias";
import { assinarChamada, lerChamada } from "../store/chamada";
import { CascaDeSeletor } from "./CascaDeSeletor";
import css from "./Seletores.module.css";

/**
 * Os sons do design, com a tecla que cada um dispara.
 *
 * A numeração é a informação que faz o painel deixar de ser necessário: o
 * design escreve *"teclas 1–9 disparam os sons sem abrir o painel"*, e um
 * painel que ensina a não precisar dele é o certo para um gesto que se repete.
 */
const SONS = [
  { glifo: "🥁", nome: "tambor", tecla: "1" },
  { glifo: "📣", nome: "anúncio", tecla: "2" },
  { glifo: "🎺", nome: "fanfarra", tecla: "3" },
  { glifo: "💥", nome: "explosão", tecla: "4" },
  { glifo: "🦆", nome: "pato", tecla: "5" },
] as const;

/**
 * O painel de sons.
 *
 * ⚠ **Soundboard não existe no protocolo**, como a figurinha. E ele tem uma
 * dependência a mais que as outras três: tocar um som numa sala de voz é
 * publicar uma faixa de áudio no LiveKit, não mandar uma mensagem — então nem
 * o transporte que o app já tem serve sem trabalho.
 *
 * O que a casca acerta é a regra de contexto: o painel só faz sentido DENTRO
 * de uma chamada, e o design marca isso com o selo "EM VOZ" no cabeçalho.
 * Fora dela ele diz que não há onde tocar, em vez de mostrar nove botões que
 * não teriam para onde mandar o áudio.
 */
export function Soundboard() {
  const [busca, setBusca] = useState("");
  const [volume, setVolume] = useState(70);
  const naSala = useSyncExternalStore(
    assinarChamada,
    () => lerChamada().estado === "dentro",
  );

  const filtro = busca.trim().toLowerCase();
  const visiveis = SONS.filter((s) => s.nome.includes(filtro));

  return (
    <CascaDeSeletor
      estreita
      rotulo="Painel de sons"
      busca={{ valor: busca, aoMudar: setBusca, placeholder: "Buscar som" }}
      acaoDaBusca={
        naSala ? (
          <span className={css.selo}>EM VOZ</span>
        ) : (
          <span className={css.seloApagado}>FORA DE VOZ</span>
        )
      }
      rodape={
        <div className={css.volume}>
          <div className={css.volumeCabecalho}>
            <span>Volume do painel</span>
            <span className={css.volumeValor}>{volume}%</span>
          </div>
          <Deslizante
            id="vx-volume-soundboard"
            rotulo="Volume do painel"
            texto={`${volume} por cento`}
            valor={volume}
            min={0}
            max={100}
            passo={5}
            aoMudar={setVolume}
          />
          <p className={css.volumeDica}>
            Teclas 1–9 disparam os sons sem abrir o painel.
          </p>
        </div>
      }
    >
      <div className={css.gradeDeSons}>
        {visiveis.map((s) => (
          <button
            key={s.nome}
            type="button"
            className={css.som}
            onClick={aindaNao("soundboard")}
            /*
              Fora da chamada o botão fica desabilitado, e não escondido.

              É a regra que o design escreve para os seletores: sem permissão
              (ou sem contexto) o item aparece esmaecido, porque some-lo faria
              parecer que o servidor não tem som nenhum.
            */
            disabled={!naSala}
          >
            <span className={css.somGlifo} aria-hidden>
              {s.glifo}
            </span>
            <span className={css.somNome}>{s.nome}</span>
            <span className={css.somTecla}>{s.tecla}</span>
          </button>
        ))}
      </div>
    </CascaDeSeletor>
  );
}
