import { useFaixaDeVideo, useFalantes } from "nucleo/store/hooks";
import { useRef } from "react";

import { salas, voz } from "../../textos";
import { Avatar, Pilula } from "../../ui/ds";
import { MicrofoneDesligado, Tela } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { useAssinaturaDeVideo, type PapelDoVideo } from "./hooks";
import css from "./Palco.module.css";
import { VideoDaFaixa } from "./VideoDaFaixa";

export interface PessoaDoPalco {
  readonly id: string;
  readonly nome: string;
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
  papel = "miniatura",
}: {
  pessoa: PessoaDoPalco;
  papel?: PapelDoVideo;
}) {
  const falando = useFalando(pessoa.id);
  const faixa = useFaixaDeVideo(pessoa.id, "camera");
  const alvo = useRef<HTMLDivElement>(null);
  useAssinaturaDeVideo(alvo, pessoa.id, "camera", papel, pessoa.proprio || !pessoa.camera);

  const nome = pessoa.proprio ? voz.palco.voce : pessoa.nome || salas.alguem;
  const semAudio = pessoa.mudo || pessoa.surdo;
  const comVideo = pessoa.camera && faixa !== undefined;
  // Falando e sem áudio não coexistem; o texto diz só o que é verdade agora.
  const estado = falando ? voz.estado.falando : semAudio ? voz.estado.mudo : undefined;

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
        <Avatar nome={pessoa.nome || salas.alguem} id={pessoa.id} tamanho={44} />
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
}: {
  pessoa: PessoaDoPalco;
  papel: PapelDoVideo;
  /** Só na miniatura. */
  aoAssistir?: () => void;
}) {
  const faixa = useFaixaDeVideo(pessoa.id, "tela");
  const alvo = useRef<HTMLDivElement>(null);
  useAssinaturaDeVideo(alvo, pessoa.id, "tela", papel, pessoa.proprio);
  const nome = pessoa.nome || salas.alguem;
  const rotulo = pessoa.proprio ? voz.palco.suaTela : voz.palco.telaDe(nome);

  const conteudo = (
    <>
      {faixa ? (
        <VideoDaFaixa faixa={faixa} rotulo={rotulo} />
      ) : (
        <div className={css.aguardando} role="status">
          <Tela tamanho={papel === "foco" ? 20 : 16} />
          {papel === "foco" && <span className={css.aguardandoTitulo}>{rotulo}</span>}
          {papel === "foco" && <span>{voz.palco.recebendoQuadro}</span>}
        </div>
      )}
      <span className={css.aoVivo}>
        <Pilula tipo="aoVivo" />
      </span>
      <span className={juntar(css.rotuloDoLadrilho, css.rotuloSobreVideo)} aria-hidden="true">
        {pessoa.proprio ? voz.palco.suaTela : voz.palco.emTransmissao(nome)}
      </span>
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
