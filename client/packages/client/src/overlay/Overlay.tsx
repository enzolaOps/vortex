import { useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import {
  Headphones,
  Microphone,
  MicrophoneSlash,
  PhoneX,
  SpeakerHigh,
} from "../components/ui/icones";
import {
  ancoras,
  duracao,
  ponteDeOverlay,
  textoDoAtalho,
  type Ancora,
  type EstadoDoOverlay,
  type MensagemDoOverlay,
} from "./modelo";
import css from "./Overlay.module.css";

const MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/** Sem atividade por 5 s, o widget de voz cai para 40% — do design. */
const OCIOSO_MS = 5000;
/** A mensagem fica o tempo de ser lida de relance, e some. */
const MENSAGEM_MS = 6000;

/**
 * A janela do overlay do jogo, inteira.
 *
 * Tudo chega pela ponte da casca: esta página não tem sessão nem store de
 * entidade (ver `modelo.ts`). É montada por `main.tsx` na rota `/overlay` e
 * em mais nenhum lugar.
 */
export function Overlay() {
  const [estado, setEstado] = useState<EstadoDoOverlay | undefined>(undefined);
  const [mensagem, setMensagem] = useState<MensagemDoOverlay | undefined>(undefined);
  const [interagindo, setInteragindo] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  /** Quando algo aconteceu por último: alguém falou ou chegou mensagem. */
  const [ultimaAtividade, setUltimaAtividade] = useState(() => Date.now());

  useEffect(() => {
    const ponte = ponteDeOverlay();
    if (!ponte) return;
    const soltar = [
      ponte.assinarEstado((e) => {
        setEstado(e);
        if (e.voz?.participantes.some((p) => p.falando)) setUltimaAtividade(Date.now());
      }),
      ponte.assinarMensagens((m) => {
        setMensagem(m);
        setUltimaAtividade(Date.now());
      }),
      ponte.assinarInteracao(setInteragindo),
    ];
    return () => {
      for (const s of soltar) s();
    };
  }, []);

  /* Relógio do cronômetro: só enquanto há chamada a contar. */
  const desde = estado?.voz?.desde ?? 0;
  useEffect(() => {
    if (desde === 0) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [desde]);

  /* Derivado do relógio que já anda a cada segundo — sem estado próprio. */
  const ocioso = !interagindo && agora - ultimaAtividade > OCIOSO_MS;

  useEffect(() => {
    if (!mensagem) return;
    const t = setTimeout(() => setMensagem(undefined), MENSAGEM_MS);
    return () => clearTimeout(t);
  }, [mensagem]);

  if (!estado?.ativo) return null;
  const onde = ancoras(estado.posicao);
  const voz = estado.voz;

  return (
    <div className={css.raiz} data-interagindo={interagindo}>
      {voz ? (
        <section
          className={`${css.widget} ${css.voz}`}
          {...atributos(onde.voz)}
          data-ocioso={ocioso}
          aria-label={`Chamada em ${voz.canal}`}
        >
          <div className={css.cabecalho}>
            <SpeakerHigh aria-hidden />
            <span className={css.canal}>{voz.canal}</span>
            <span className={css.tempo}>{duracao((agora - voz.desde) / 1000)}</span>
          </div>

          <ul className={css.lista}>
            {voz.participantes.map((p) => (
              <li
                key={p.id}
                className={css.pessoa}
                data-falando={p.falando}
                data-mudo={p.mudo}
              >
                <span className={css.avatar}>
                  <Avatar id={p.id} sigla={p.sigla} url={p.avatarUrl} tamanho="xs" />
                </span>
                <span className={css.nome}>{p.nome}</span>
                {p.mudo ? <MicrophoneSlash className={css.mudo} aria-label="mudo" /> : null}
                {p.falando ? <span className={css.pontoDeFala} aria-label="falando" /> : null}
              </li>
            ))}
          </ul>

          <div className={css.controles}>
            <button
              type="button"
              className={css.botao}
              aria-label="Microfone"
              aria-pressed={voz.mudo}
              onClick={() => ponteDeOverlay()?.comando("mutar")}
            >
              {voz.mudo ? <MicrophoneSlash aria-hidden /> : <Microphone aria-hidden />}
            </button>
            <button
              type="button"
              className={css.botao}
              aria-label="Áudio recebido"
              aria-pressed={voz.surdo}
              onClick={() => ponteDeOverlay()?.comando("ensurdecer")}
            >
              <Headphones aria-hidden />
            </button>
            <button
              type="button"
              className={`${css.botao} ${css.sair}`}
              aria-label="Sair da chamada"
              onClick={() => ponteDeOverlay()?.comando("desconectar")}
            >
              <PhoneX aria-hidden />
            </button>
          </div>
        </section>
      ) : null}

      {mensagem ? (
        <section
          className={`${css.widget} ${css.mensagem}`}
          {...atributos(onde.mensagem)}
          aria-live="polite"
        >
          <div className={css.mensagemCabecalho}>
            <span className={css.mensagemCanal}>{mensagem.canal}</span>
          </div>
          <p className={css.mensagemTexto}>
            <span className={css.autor}>{mensagem.autor}:</span> {mensagem.texto}
          </p>
        </section>
      ) : null}

      {estado.atalho ? (
        <div className={`${css.widget} ${css.dica}`} {...atributos(onde.dica)}>
          <span className={css.dicaTecla}>{textoDoAtalho(estado.atalho, MAC)}</span>
          {/*
            ⚠ O design escreve "mover overlay"; o atalho aqui ALTERNA entre
            travado e clicável, e a posição se escolhe em Configurações ·
            Desktop. O texto diz o que a tecla faz.
          */}
          {interagindo ? "voltar ao jogo" : "interagir · travado durante o jogo"}
        </div>
      ) : null}
    </div>
  );
}

function atributos(a: Ancora) {
  return { "data-v": a.v, "data-h": a.h };
}
