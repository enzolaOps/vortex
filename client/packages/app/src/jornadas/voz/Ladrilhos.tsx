import { useFaixaDeVideo, useFalantes } from "nucleo/store/hooks";
import { assinarQualidadeDaTela, qualidadeEscolhida } from "nucleo/store/qualidadeDaTela";
import { assinarChamada, lerChamada } from "nucleo/store/chamada";
import {
  VOLUME_DA_TRANSMISSAO_MAXIMO,
  VOLUME_DA_TRANSMISSAO_PADRAO,
  VOLUME_DA_TRANSMISSAO_PASSO,
  assinarVolumeDaTransmissao,
  definirVolumeDaTransmissao,
  lerVolumeDaTransmissao,
} from "nucleo/store/volumesDeTransmissao";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { salas, voz } from "../../textos";
import { Avatar, Botao, Pilula } from "../../ui/ds";
import { Maximizar, MicrofoneDesligado, Tela } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { Deslizante } from "../config/controles";
import { useAssinaturaDeVideo, type PapelDoVideo } from "./hooks";
import css from "./Palco.module.css";
import { VideoDaFaixa } from "./VideoDaFaixa";

export interface PessoaDoPalco {
  readonly id: string;
  readonly nome: string;
  /** A foto, quando há; cobre o gradiente do avatar. */
  readonly avatarUrl?: string | undefined;
  readonly mudo: boolean;
  readonly surdo: boolean;
  readonly camera: boolean;
  readonly proprio: boolean;
}

/**
 * Quem está falando AGORA, lido do store efêmero e keyed por esta pessoa.
 *
 * ⚠ Cada ladrilho assina só a si mesmo. O palco, a grade e a cápsula não
 * acordam quando alguém começa a falar — é a lei nº 1 na granularidade mais
 * fina que o app tem, e a razão de o anel de fala nunca passar pelo store de
 * salas.
 */
function useFalando(id: string): boolean {
  return useFalantes([id]).length > 0;
}

/** O tile de uma pessoa: avatar (ou a câmera, se ela estiver ligada), nome, estado. */
export function LadrilhoDePessoa({
  pessoa,
  papel = "grade",
}: {
  pessoa: PessoaDoPalco;
  papel?: PapelDoVideo;
}) {
  const falandoBruto = useFalando(pessoa.id);
  const faixa = useFaixaDeVideo(pessoa.id, "camera");
  const alvo = useRef<HTMLDivElement>(null);
  useAssinaturaDeVideo(alvo, pessoa.id, "camera", papel, pessoa.proprio || !pessoa.camera);

  const nome = pessoa.proprio ? voz.palco.voce : pessoa.nome || salas.alguem;
  const semAudio = pessoa.mudo || pessoa.surdo;
  // Microfone cortado vence a fala: um sinal atrasado do store não pode pintar o anel nem o texto.
  const falando = falandoBruto && !semAudio;
  const comVideo = pessoa.camera && faixa !== undefined;
  const estado = semAudio ? voz.estado.mudo : falando ? voz.estado.falando : undefined;

  return (
    <div
      ref={alvo}
      role="group"
      aria-label={estado ? `${nome}, ${estado.toLowerCase()}` : nome}
      className={css.ladrilho}
      data-falando={falando}
      data-testid="ladrilho-de-pessoa"
      data-pessoa={pessoa.id}
    >
      {comVideo ? (
        <VideoDaFaixa faixa={faixa} rotulo={nome} />
      ) : (
        <Avatar nome={pessoa.nome || salas.alguem} id={pessoa.id} tamanho={44} imagem={pessoa.avatarUrl} />
      )}
      {semAudio && (
        <span className={css.mudo} role="img" aria-label={voz.palco.mudoDe(nome)}>
          <MicrofoneDesligado tamanho={14} />
        </span>
      )}
      <span className={juntar(css.rotuloDoLadrilho, comVideo && css.rotuloSobreVideo)} aria-hidden="true">
        {estado ? `${nome} · ${estado.toLowerCase()}` : nome}
      </span>
    </div>
  );
}

/**
 * Uma transmissão de tela.
 *
 * `foco` é a grande do palco; `miniatura` é um botão ("Assistir") que troca o
 * foco. As duas pedem a faixa pela mesma assinatura contada, só com camadas
 * diferentes, e a mesma `MediaStreamTrack` serve aos dois `<video>`.
 */
export function LadrilhoDeTela({
  pessoa,
  papel,
  aoAssistir,
  telaCheia,
}: {
  pessoa: PessoaDoPalco;
  papel: PapelDoVideo;
  /** Só na miniatura. */
  aoAssistir?: () => void;
  /** Só no foco: o botão de tela cheia do canto. */
  telaCheia?: { readonly ativa: boolean; readonly alternar: () => void };
}) {
  const faixa = useFaixaDeVideo(pessoa.id, "tela");
  const alvo = useRef<HTMLDivElement>(null);
  useAssinaturaDeVideo(alvo, pessoa.id, "tela", papel, pessoa.proprio);
  const nome = pessoa.nome || salas.alguem;
  const rotulo = pessoa.proprio ? voz.palco.suaTela : voz.palco.telaDe(nome);
  const qualidade = useQualidadeDaTela(faixa, pessoa.proprio, papel === "foco");

  // Miniatura/grade da PRÓPRIA tela: um cartão, nunca o vídeo. Espelhar a própria
  // captura dentro dela mesma gera o corredor infinito, e a faixa própria nem é
  // assinada (`proprio` desliga a assinatura).
  const cartaoProprio = pessoa.proprio && aoAssistir !== undefined;

  const conteudo = cartaoProprio ? (
    <>
      <div className={css.aguardando} data-testid="cartao-voce-transmite">
        <Tela tamanho={20} />
        <span className={css.aguardandoTitulo}>{voz.palco.vocePassaTransmitindo}</span>
      </div>
      <span className={css.aoVivo}>
        <Pilula tipo="aoVivo" />
      </span>
    </>
  ) : (
    <>
      {faixa ? (
        <VideoDaFaixa faixa={faixa} rotulo={rotulo} />
      ) : (
        <div className={css.aguardando} role="status">
          <Tela tamanho={papel === "foco" ? 20 : 16} />
          {papel === "foco" && <span className={css.aguardandoTitulo}>{rotulo}</span>}
          {papel === "foco" && !pessoa.proprio && <span>{voz.palco.recebendoQuadro}</span>}
        </div>
      )}
      <span className={css.aoVivo}>
        <Pilula tipo="aoVivo" />
      </span>
      {/* Sem quadro ainda, o rótulo é o do centro: repeti-lo embaixo diria a mesma coisa duas vezes. */}
      {faixa && (
        <span className={juntar(css.rotuloDoLadrilho, css.rotuloSobreVideo)} aria-hidden="true">
          {pessoa.proprio ? voz.palco.suaTela : voz.palco.emTransmissao(nome)}
        </span>
      )}
      {papel === "foco" && (qualidade !== undefined || telaCheia || !pessoa.proprio) && (
        <span className={css.cantoDoFoco}>
          {!pessoa.proprio && <VolumeDaTransmissao userId={pessoa.id} nome={nome} />}
          {qualidade !== undefined && (
            <span className={css.seloDeQualidade} data-testid="selo-de-qualidade">
              {qualidade}
            </span>
          )}
          {telaCheia && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              icone={<Maximizar />}
              aria-label={voz.palco.telaCheia}
              aria-pressed={telaCheia.ativa}
              data-testid="tela-cheia"
              onClick={telaCheia.alternar}
            />
          )}
        </span>
      )}
    </>
  );

  if (aoAssistir) {
    return (
      <button
        type="button"
        className={css.ladrilho}
        aria-label={voz.palco.assistir(nome)}
        onClick={aoAssistir}
        data-testid="ladrilho-de-tela"
        data-pessoa={pessoa.id}
      >
        <div ref={alvo} className={css.internoDoBotao}>
          {conteudo}
        </div>
      </button>
    );
  }
  return (
    <div
      ref={alvo}
      className={css.telaDoFoco}
      role="group"
      aria-label={rotulo}
      data-testid="foco-do-palco"
      data-pessoa={pessoa.id}
    >
      {conteudo}
    </div>
  );
}

/** Marca no trilho: onde está o som como a pessoa transmitiu. */
const MARCAS_DO_VOLUME = [VOLUME_DA_TRANSMISSAO_PADRAO] as const;

/**
 * O volume do SOM da transmissão em foco, de 0% a 300%, só para quem assiste.
 *
 * Lê o valor GUARDADO, não o efetivo: surdo zera o que se ouve sem apagar o
 * ajuste, e o deslizante é o jeito de voltar de um 0 que ficou salvo. A voz
 * da pessoa é outro eixo e não muda aqui.
 *
 * ⚠ **Sem som, o controle fica DESLIGADO com o motivo, e não some.** O som da
 * tela é opcional (a caixa do seletor do sistema), e pode chegar depois do
 * vídeo; sumir e aparecer faria o canto pular sob o ponteiro. E um controle
 * ausente não diz nada — desligado com a frase responde "por que não ouço?".
 */
function VolumeDaTransmissao({ userId, nome }: { userId: string; nome: string }) {
  const valor = useSyncExternalStore(
    (avisar) => assinarVolumeDaTransmissao(userId, avisar),
    () => lerVolumeDaTransmissao(userId),
  );
  /* Booleano: a chamada acorda por muita coisa, e só a troca disto re-renderiza. */
  const comSom = useSyncExternalStore(assinarChamada, () => lerChamada().telaComSom.includes(userId));
  return (
    <span className={css.volumeDoFoco} data-testid="volume-da-transmissao">
      <Deslizante
        rotulo={voz.palco.volumeDaTransmissao(nome)}
        valor={valor}
        min={0}
        max={VOLUME_DA_TRANSMISSAO_MAXIMO}
        passo={VOLUME_DA_TRANSMISSAO_PASSO}
        marcas={MARCAS_DO_VOLUME}
        texto={`${String(valor)}%`}
        disabled={!comSom}
        descricao={comSom ? undefined : voz.palco.transmissaoSemSom}
        aoMudar={(proximo) => {
          definirVolumeDaTransmissao(userId, proximo);
        }}
      />
    </span>
  );
}

/**
 * O selo "1080p60" da transmissão em foco.
 *
 * - Sua: o que você ESCOLHEU (resolução e taxa); "Fonte" não vira número, então fica sem selo.
 * - De outra pessoa: o que a faixa RECEBIDA reporta agora, lido de tempos em tempos —
 *   altura e taxa vêm do navegador, nunca de um valor pedido.
 *
 * Sem dado, sem selo: um número inventado é pior que a ausência.
 */
function useQualidadeDaTela(
  faixa: MediaStreamTrack | undefined,
  proprio: boolean,
  ativo: boolean,
): string | undefined {
  const escolhida = useSyncExternalStore(assinarQualidadeDaTela, qualidadeEscolhida);
  const [medida, setMedida] = useState<string | undefined>();
  useEffect(() => {
    if (!ativo || proprio || !faixa) return;
    const ler = () => {
      const s = faixa.getSettings();
      const altura = s.height ? Math.round(s.height) : 0;
      const fps = s.frameRate ? Math.round(s.frameRate / 5) * 5 : 0;
      setMedida(altura > 0 ? `${String(altura)}p${fps > 0 ? String(fps) : ""}` : undefined);
    };
    ler();
    const t = window.setInterval(ler, 2000);
    return () => {
      window.clearInterval(t);
    };
  }, [faixa, proprio, ativo]);
  if (!ativo) return undefined;
  if (proprio) {
    return escolhida && escolhida.resolucao !== "Fonte"
      ? `${escolhida.resolucao}${String(escolhida.taxa)}`
      : undefined;
  }
  return faixa ? medida : undefined;
}
