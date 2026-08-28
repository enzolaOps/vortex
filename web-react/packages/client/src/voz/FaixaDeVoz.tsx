import { Monitor, PhoneX } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

import { alternarTela, sairDaChamada } from "../sdk/chamada";
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

  const ruim =
    chamada.estado === "reconectando" ||
    chamada.qualidade === "ruim" ||
    chamada.qualidade === "perdida";

  return (
    <div className={cn(css.faixa, ruim && css.faixaRuim)}>
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
        <Tooltip texto={chamada.tela ? "Parar de compartilhar" : "Compartilhar tela"}>
          <button
            type="button"
            className={cn(css.controle, chamada.tela && css.controleAtivo)}
            aria-pressed={chamada.tela}
            /* Nome estável, estado no `aria-pressed` — a regra que o lint
               deste projeto guarda. A ação vai no tooltip. */
            aria-label="Compartilhamento de tela"
            onClick={() => void alternarTela()}
          >
            <Monitor size={20} />
          </button>
        </Tooltip>

        <Tooltip texto="Sair da chamada">
          <button
            type="button"
            className={cn(css.controle, css.desligar)}
            aria-label="Sair da chamada"
            onClick={() => void sairDaChamada()}
          >
            <PhoneX size={20} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
