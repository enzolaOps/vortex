import {
  ICONE,
  Monitor,
  MusicNotes,
  Power,
  Rows,
  VideoCamera,
} from "../components/ui/icones";
import { useSyncExternalStore } from "react";

import { alternarCamera, alternarTela, sairDaChamada } from "../sdk/chamada";
import { aindaNao } from "../pendente/pendencias";
import { assinarChamada, lerChamada, type QualidadeDeVoz } from "../store/chamada";
import { cn } from "../lib/cn";
import { selecionarCanal } from "../store/navegacao";
import { Tooltip } from "../components/ui/Tooltip";
import { useChannel, useServer } from "../store/hooks";
import css from "./FaixaDeVoz.module.css";

/**
 * O que cada qualidade diz na tela.
 *
 * ⚠ **Sem milissegundos.** O design mostra "Conectado · 42 ms"; o LiveKit
 * expõe uma CLASSIFICAÇÃO, não um número — ver `QualidadeDeVoz`. Derivar "42
 * ms" de "good" seria dado falso numa superfície onde a pessoa decide se sai
 * da chamada ou troca de rede, e um número inventado é pior que um adjetivo
 * verdadeiro.
 *
 * `Record` fechado: variante nova de qualidade não compila até ganhar texto.
 */
const TEXTO_DA_QUALIDADE: Record<QualidadeDeVoz, string> = {
  otima: "conexão ótima",
  boa: "conexão boa",
  ruim: "conexão instável",
  perdida: "conexão perdida",
  desconhecida: "medindo a conexão",
};

/**
 * A faixa de voz conectada — o rodapé da coluna, acima do painel de usuário.
 *
 * ⚠ **Não existia, e o design a tem em toda tela com chamada ativa.** Havia só
 * o `CartaoDeChamada`, que flutua sobre a coluna de conteúdo; a faixa é outra
 * coisa: ela mora na coluna, é permanente enquanto a chamada dura, e responde
 * "estou conectado onde, e como está a linha" sem a pessoa procurar.
 *
 * Assina só o store de chamada — que já compara campo a campo antes de
 * publicar, então uma faixa de áudio mudando de estado no LiveKit não a acorda.
 *
 * ⚠ **`falando` NÃO é assinado aqui.** Ele muda dezenas de vezes por segundo, e
 * é o store que a lei nº 1 nomeia; quem o assina é o avatar de cada pessoa, no
 * cartão. Uma faixa que piscasse a cada sílaba repintaria o rodapé da coluna.
 */
/**
 * Quantas das quatro barras acendem, por qualidade.
 *
 * `Record` fechado sobre `QualidadeDeVoz`: variante nova não compila até
 * alguém decidir a altura dela, que é a mesma mecânica do texto logo acima.
 *
 * ⚠ `desconhecida` acende ZERO e não uma. Ela é o estado antes do primeiro
 * relatório — a sala leva alguns segundos para medir —, e uma barra acesa ali
 * afirmaria "a conexão está péssima" quando o certo é "ainda não sei".
 */
const BARRAS_ACESAS: Record<QualidadeDeVoz, number> = {
  otima: 4,
  boa: 3,
  ruim: 2,
  perdida: 0,
  desconhecida: 0,
};

/**
 * O medidor de qualidade — quatro barras.
 *
 * ⚠ **`aria-hidden`, e é a decisão certa, não um esquecimento.** O texto ao
 * lado já diz "conexão ótima" por extenso; o medidor é a mesma informação
 * numa forma que se lê de relance. Anunciá-lo faria o leitor de tela dizer o
 * estado duas vezes seguidas.
 *
 * ⚠ **As alturas sobem em RAMPA, e o design não faz isso.** Ele escreve
 * `40% · 75% · 100% · 55%` — a quarta MAIS BAIXA que a terceira, o que
 * nenhum medidor de sinal faz e o que lê como defeito de renderização.
 * Reproduzir seria copiar um deslize; a rampa é o que a forma significa.
 */
function Medidor({ acesas }: { acesas: number }) {
  return (
    <span className={css.medidor} aria-hidden>
      {[40, 60, 80, 100].map((altura, i) => (
        <span
          key={altura}
          className={css.barra}
          data-acesa={i < acesas}
          style={{ blockSize: `${String(altura)}%` }}
        />
      ))}
    </span>
  );
}

export function FaixaDeVoz() {
  const chamada = useSyncExternalStore(assinarChamada, lerChamada);
  const canal = useChannel(chamada.channelId);
  const servidor = useServer(canal?.serverId ?? "");

  if (chamada.estado === "fora") return null;

  /*
    O estado da CONEXÃO ganha do da qualidade.

    Enquanto está entrando ou reconectando, a qualidade anterior é história —
    dizer "conexão ótima" durante uma reconexão é exatamente o contrário do que
    está acontecendo.
  */
  const estado =
    chamada.estado === "conectando"
      ? "entrando…"
      : chamada.estado === "reconectando"
        ? "reconectando…"
        : TEXTO_DA_QUALIDADE[chamada.qualidade];

  /*
    Três níveis, como o design — e não dois.

    ⚠ `ruim` caía na mesma tinta vermelha de `perdida` e de `reconectando`.
    "A conexão está ruim mas você continua na sala" e "você caiu" pedem
    reações diferentes de quem está falando; com uma cor só, a primeira
    parecia a segunda.
  */
  const perdida =
    chamada.estado === "reconectando" || chamada.qualidade === "perdida";
  const instavel = !perdida && chamada.qualidade === "ruim";

  return (
    <div
      className={cn(
        css.faixa,
        instavel && css.faixaInstavel,
        perdida && css.faixaRuim,
      )}
    >
      <div className={css.topo}>
        {/*
          O destino é um BOTÃO: clicar leva ao canal da chamada.

          É o que a pessoa tenta quando volta de outro canal e quer ver quem está
          falando — e sem ele o único caminho de volta seria procurar o canal na
          lista, que é justamente o que a faixa existe para evitar.
        */}
        <button
          type="button"
          className={css.destino}
          onClick={() => selecionarCanal(chamada.channelId)}
        >
          <span className={css.estado}>
            {/* Ponto + TEXTO, nunca só o ponto: qualidade de conexão comunicada
                só por cor some para quem não distingue verde de vermelho, e é
                justamente quem mais precisa saber que a linha caiu. */}
            <span className={css.ponto} aria-hidden />
            {estado}
          </span>

          <span className={css.lugar}>
            {canal?.name ?? "voz"}
            {servidor ? ` / ${servidor.name}` : null}
          </span>
        </button>

        <div className={css.controles}>
          <Medidor acesas={BARRAS_ACESAS[chamada.qualidade]} />

          {/*
            Desligar mora na LINHA DE CIMA, ao lado do estado — do design, e a
            razão é a hierarquia: os quatro de baixo mudam COMO você participa,
            e este decide SE você participa. Misturá-lo entre eles o torna o
            quinto de uma fileira de iguais.
          */}
          <Tooltip texto="Sair da chamada">
            <button
              type="button"
              className={cn(css.controle, css.desligar)}
              aria-label="Sair da chamada"
              onClick={() => void sairDaChamada()}
            >
              <Power size={ICONE.calha} />
            </button>
          </Tooltip>
        </div>
      </div>

      {/*
        A fileira de quatro, cada um em `flex: 1` — do design.

        Largura igual e não conteúdo: são quatro alvos do mesmo peso, e um
        deles crescer porque o glifo é mais largo faria a fileira parecer
        ordenada por importância.
      */}
      <div className={css.acoes}>
        <Tooltip texto={chamada.camera ? "Desligar câmera" : "Ligar câmera"}>
          <button
            type="button"
            /* O estado vem do `aria-pressed`, que o CSS já mira: uma classe
               paralela poderia discordar do ARIA, e discordar aqui significa a
               tela dizer uma coisa e o leitor de tela outra. */
            className={css.acao}
            aria-pressed={chamada.camera}
            aria-label="Câmera"
            onClick={() => void alternarCamera()}
          >
            <VideoCamera size={ICONE.calha} />
          </button>
        </Tooltip>

        <Tooltip
          texto={chamada.tela ? "Parar de transmitir" : "Compartilhar tela"}
        >
          <button
            type="button"
            className={css.acao}
            aria-pressed={chamada.tela}
            /* Nome estável, estado no `aria-pressed` — a regra que o lint
               deste projeto guarda. A ação vai no tooltip. */
            aria-label="Compartilhamento de tela"
            onClick={() => void alternarTela()}
          >
            <Monitor size={ICONE.calha} />
          </button>
        </Tooltip>

        {/* Desenhados sem implementação — ver `pendente/pendencias.ts`. */}
        <Tooltip texto="Atividades">
          <button
            type="button"
            className={css.acao}
            aria-label="Atividades"
            onClick={aindaNao("atividades")}
          >
            <Rows size={ICONE.calha} />
          </button>
        </Tooltip>

        <Tooltip texto="Soundboard">
          <button
            type="button"
            className={css.acao}
            aria-label="Soundboard"
            onClick={aindaNao("soundboard")}
          >
            <MusicNotes size={ICONE.calha} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
