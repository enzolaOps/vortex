import { ponteDeNotificacoes } from "nucleo/notificacao/notificador";
import { usuarioLocalId } from "nucleo/sdk/adapter";
import { alternarMudo, alternarSurdo } from "nucleo/sdk/chamada";
import { pode } from "nucleo/sdk/permissoes";
import { useChamada, useChannel, useFalantes, usePessoasDaSala } from "nucleo/store/hooks";
import { useEffect, useRef } from "react";

import { salas, voz } from "../../textos";
import { Avatar, PainelVidro, Pilula } from "../../ui/ds";
import { useExpansao } from "../../ui/ds/useExpansao";
import {
  EncerrarChamada,
  Fone,
  FoneDesligado,
  Maximizar,
  Microfone,
  MicrofoneDesligado,
  Volume,
} from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { sairDaSala } from "./acoes";
import { escolherFoco } from "./foco";
import css from "./OverlayDaChamada.module.css";
import { VideoEmFoco } from "./VideoEmFoco";

/** Quantas pessoas a coluna mostra antes de resumir o resto: a janela não cresce sem teto. */
export const MAXIMO_DE_PESSOAS = 8;

function Pessoa({ id, nome, mudo, imagem }: { id: string; nome: string; mudo: boolean; imagem?: string | undefined }) {
  // Cada linha assina só a si mesma: o overlay inteiro não acorda a cada sílaba.
  const falando = useFalantes([id]).length > 0;
  return (
    <li className={juntar(css.pessoa, falando && css.pessoaFalando)} data-pessoa={id} data-falando={falando}>
      <Avatar nome={nome} id={id} tamanho={28} imagem={imagem} falando={falando} />
      <span className={css.nome}>{nome}</span>
      {mudo && (
        <span className={css.semAudio} role="img" aria-label={voz.estado.mudo}>
          <MicrofoneDesligado tamanho={14} />
        </span>
      )}
    </li>
  );
}

/**
 * O overlay mínimo da chamada: o que cabe sobre um jogo.
 *
 * Em repouso, só quem está na sala — avatar, nome, anel de quem fala — sobre
 * o fundo transparente da janela, com sombra no texto para ler sobre qualquer
 * imagem. Com o ponteiro (ou o foco do teclado) em cima, o vidro aparece com os
 * controles. A transmissão, se houver, abre ao lado.
 *
 * ⚠ **Vidro só quando expandido, e por troca de elemento.** `backdrop-filter`
 * borra o que está atrás mesmo com o fundo transparente; em repouso isso
 * desfocaria o jogo inteiro atrás de uma janela vazia. O repouso é um `div`
 * sem vidro.
 *
 * ⚠ **Mesmos stores e mesmas ações da janela principal**, porque ele é
 * desenhado POR ela (portal): nenhuma conexão, nenhuma cópia de estado.
 */
export function OverlayDaChamada({
  documento,
  aoMedir,
}: {
  documento: Document;
  /** O tamanho do conteúdo mudou — a janela se ajusta a ele. */
  aoMedir?: (largura: number, altura: number) => void;
}) {
  const chamada = useChamada();
  const canal = useChannel(chamada.channelId);
  const pessoas = usePessoasDaSala(canal?.serverId ?? "", chamada.channelId);
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const eu = usuarioLocalId();
  const { aberto, props } = useExpansao({});
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = raiz.current;
    const Observador = documento.defaultView?.ResizeObserver;
    if (!el || !Observador || !aoMedir) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      aoMedir(Math.ceil(r.width), Math.ceil(r.height));
    };
    const ro = new Observador(medir);
    ro.observe(el);
    medir();
    return () => {
      ro.disconnect();
    };
  }, [documento, aoMedir]);

  if (chamada.estado === "fora" || !canal) return null;

  const nomeDe = (id: string) => pessoas.find((p) => p.id === id)?.nome || salas.alguem;
  const foco = escolherFoco(
    pessoas.map((p) => ({
      id: p.id,
      transmitindo: p.estado === "tela",
      camera: p.id === eu ? chamada.camera : chamada.comCamera.includes(p.id),
    })),
    falantes,
    eu,
  );
  const transmissor = foco?.tipo === "tela" ? foco : undefined;
  const visiveis = pessoas.slice(0, MAXIMO_DE_PESSOAS);
  const escondidas = pessoas.length - visiveis.length;
  const microfoneLigado = !chamada.mudo && !chamada.surdo;
  // Sem `Speak` o microfone não aparece: um botão que não faz a pessoa ser ouvida é pior que a ausência.
  const podeFalar = pode(chamada.channelId, "falarNaVoz");

  const conteudo = (
    <>
      <div className={css.cabeca}>
        <Volume tamanho={14} />
        <span className={css.sala}>{canal.name}</span>
        {transmissor && <Pilula tipo="aoVivo" />}
      </div>

      {pessoas.length === 0 ? (
        <p className={css.vazia}>{voz.destacar.ninguem}</p>
      ) : (
        <ul className={css.lista} aria-label={voz.pessoasNaChamada}>
          {visiveis.map((p) => (
            <Pessoa key={p.id} id={p.id} nome={p.nome || salas.alguem} mudo={p.mudo || p.surdo} imagem={p.avatarUrl} />
          ))}
          {escondidas > 0 && <li className={css.resto}>{`+${String(escondidas)}`}</li>}
        </ul>
      )}

      {aberto && (
        <>
          <div role="group" aria-label={voz.destacar.controles} className={css.controles}>
            {podeFalar && (
              <button
                type="button"
                className={juntar(css.controle, microfoneLigado && css.ligado)}
                aria-label={voz.microfone}
                aria-pressed={microfoneLigado}
                onClick={() => void alternarMudo()}
              >
                {microfoneLigado ? <Microfone tamanho={14} /> : <MicrofoneDesligado tamanho={14} />}
              </button>
            )}
            <button
              type="button"
              className={juntar(css.controle, !chamada.surdo && css.ligado)}
              aria-label={voz.audioRecebido}
              aria-pressed={!chamada.surdo}
              onClick={() => void alternarSurdo()}
            >
              {chamada.surdo ? <FoneDesligado tamanho={14} /> : <Fone tamanho={14} />}
            </button>
            <button
              type="button"
              className={juntar(css.controle, css.sair)}
              aria-label={voz.sairDaChamada}
              onClick={() => void sairDaSala()}
            >
              <EncerrarChamada tamanho={14} />
            </button>
          </div>
          <button
            type="button"
            className={css.abrir}
            onClick={() => {
              // A principal pode estar minimizada atrás do jogo: foco pela casca, quando há.
              ponteDeNotificacoes()?.focar();
              window.focus();
            }}
          >
            <Maximizar tamanho={14} />
            {voz.destacar.abrirVortex}
          </button>
        </>
      )}
    </>
  );

  return (
    <div ref={raiz} className={css.raiz} {...props}>
      <div className={css.coluna}>
        {aberto ? (
          <PainelVidro
            role="group"
            aria-label={voz.destacar.salaRotulo(canal.name)}
            elevacao={2}
            raio="lg"
            className={juntar(css.painel, css.painelAberto)}
          >
            {conteudo}
          </PainelVidro>
        ) : (
          <div role="group" aria-label={voz.destacar.salaRotulo(canal.name)} className={css.painel} tabIndex={0}>
            {conteudo}
          </div>
        )}
        {transmissor && (
          <div
            role="region"
            aria-label={voz.destacar.transmissao(nomeDe(transmissor.userId))}
            className={css.transmissao}
          >
            <VideoEmFoco
              foco={transmissor}
              nome={nomeDe(transmissor.userId)}
              imagem={pessoas.find((p) => p.id === transmissor.userId)?.avatarUrl}
              proprio={transmissor.userId === eu}
              documento={documento}
            />
          </div>
        )}
      </div>
    </div>
  );
}
