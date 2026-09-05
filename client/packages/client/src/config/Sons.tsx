import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Deslizante } from "../components/ui/Deslizante";
import { aindaNao } from "../pendente/pendencias";
import css from "./Sons.module.css";

/**
 * Painel de efeitos sonoros.
 *
 * ⚠ **Nem o conceito nem a rota existem no Stoat**, e o consumo dele
 * dependeria de mais uma peça que não temos: tocar um som numa sala de voz é
 * publicar áudio no LiveKit, não enviar mensagem. Duas ausências empilhadas,
 * e a tela é 1:1 com a referência mesmo assim.
 *
 * ⚠ **O volume daqui é o de ORIGEM, e é o que a nota do rodapé existe para
 * dizer.** Ele é o que todo mundo ouve; o volume do painel no cliente de cada
 * pessoa multiplica em cima. Sem a frase, quem baixa aqui acha que baixou só
 * para si.
 */

const EXEMPLOS = [
  { id: "tambor", emoji: "🥁", nome: "tambor", volume: 70, autor: "Rafa" },
  { id: "anuncio", emoji: "📣", nome: "anúncio", volume: 55, autor: "Marina" },
  { id: "fanfarra", emoji: "🎺", nome: "fanfarra", volume: 80, autor: "Téo" },
] as const;

export function Sons({ serverId }: { serverId: string }) {
  /*
    Local e efêmero, como em Tag e Modelo: guardar num store daria um volume
    que só quem o arrastou enxerga, e sala de voz nenhuma aplica.
  */
  const [volumes, setVolumes] = useState<Record<string, number>>({});

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.tela}>
      <Banner tom="aviso" acoes={<Botao variante="neutro" onClick={aindaNao("efeitosSonoros")}>O que falta</Botao>}>
        O protocolo do Stoat não tem painel de efeitos sonoros. Os três abaixo
        são exemplo; nada aqui é guardado.
      </Banner>

      <div className={css.barra}>
        <Botao variante="primario" onClick={aindaNao("efeitosSonoros")}>
          Enviar som
        </Botao>
      </div>

      {/*
        Grade e não tabela `<table>`: as colunas são três e a do meio é um
        controle interativo de largura variável. A semântica de tabela cobraria
        cabeçalho de coluna anunciado a cada célula, para uma lista que se lê
        por linha.
      */}
      <div className={css.grade} role="list">
        <div className={css.cabecalho} aria-hidden>
          <span>Nome</span>
          <span>Volume</span>
          <span>Enviado por</span>
          <span />
        </div>

        {EXEMPLOS.map((s) => {
          const volume = volumes[s.id] ?? s.volume;
          return (
            <div key={s.id} className={css.linha} role="listitem">
              <div className={css.nomeCelula}>
                <span aria-hidden className={css.emoji}>
                  {s.emoji}
                </span>
                <span className={css.nome}>{s.nome}</span>
              </div>

              <Deslizante
                id={`volume-${s.id}`}
                valor={volume}
                min={0}
                max={100}
                passo={5}
                rotulo={`Volume de ${s.nome}`}
                texto={`${String(volume)}%`}
                aoMudar={(v) => {
                  setVolumes((atual) => ({ ...atual, [s.id]: v }));
                }}
              />

              <span className={css.autor}>{s.autor}</span>

              <Botao variante="perigoSutil" onClick={aindaNao("efeitosSonoros")}>
                Excluir
              </Botao>
            </div>
          );
        })}
      </div>

      <p className={css.nota}>
        O volume aqui é o de ORIGEM — o que todo mundo ouve. O volume do painel
        no cliente de cada pessoa multiplica em cima deste.
      </p>
    </div>
  );
}
