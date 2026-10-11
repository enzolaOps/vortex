import {
  BARRAS_DO_MEDIDOR,
  barrasAcesas,
  faixaDaBarra,
  fracaoDoDb,
  textoDoDb,
} from "nucleo/lib/nivelDeAudio";
import { pausarAtalhos } from "nucleo/sdk/atalhosDeVoz";
import {
  acoesEmConflito,
  assinarAtalhosDeVoz,
  combinacaoDoEvento,
  definirAtalho,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
} from "nucleo/store/atalhosDeVoz";
import { useDispositivos } from "nucleo/store/dispositivos";
import {
  assinarPreferenciasDeVoz,
  ATRASO_MAX_MS,
  constraintsDeAudio,
  definirPreferenciasDeVoz,
  FUNDOS_DE_VIDEO,
  LIMIAR_MAX_DB,
  LIMIAR_MIN_DB,
  lerPreferenciasDeVoz,
  NIVEIS_DE_RUIDO,
} from "nucleo/store/preferenciasDeVoz";
import { assinarPushToTalk, lerSegurando } from "nucleo/store/pushToTalk";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { config } from "../../textos";
import { Botao } from "../../ui/ds";
import { juntar } from "../../ui/juntar";
import {
  Bloco,
  Deslizante,
  Divisor,
  estilosDeConfig as ec,
  GrupoDeOpcoes,
  Interruptor,
  LinhaDeAjuste,
  Opcao,
  Pagina,
  Seletor,
} from "./controles";
import { useFaixaDeTeste, useNivelDaFaixa } from "./testeDeMidia";
import css from "./Voz.module.css";

const t = config.vozTela;
const MAC = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

type Opcoes = readonly { readonly valor: string; readonly rotulo: string }[];

/**
 * A lista de um seletor de dispositivo: o padrão do sistema e depois cada um.
 *
 * Sem permissão o navegador entrega os dispositivos com nome vazio; nesse caso
 * eles ganham um nome numerado, para a lista continuar escolhível.
 */
function opcoesDeDispositivo(ds: readonly MediaDeviceInfo[], generico: string): Opcoes {
  return [
    { valor: "", rotulo: t.padraoDoSistema },
    ...ds
      // Sem permissão o navegador entrega dispositivos sem id nem nome: não dá para escolhê-los.
      .filter(escolhivel)
      .map((d, i) => ({ valor: d.deviceId, rotulo: d.label || `${generico} ${i + 1}` })),
  ];
}

const escolhivel = (d: MediaDeviceInfo) =>
  d.deviceId !== "" && d.deviceId !== "default" && d.deviceId !== "communications";

/** O aviso do fim da lista quando não há dispositivo a escolher além do padrão. */
function semDispositivo(ds: readonly MediaDeviceInfo[], aviso: string): string | undefined {
  return ds.some(escolhivel) ? undefined : aviso;
}

/** Voz e vídeo (PRD 4.6). Cada controle escreve num store que o motor da chamada já lê. */
export function VozEVideo() {
  const p = useSyncExternalStore(assinarPreferenciasDeVoz, lerPreferenciasDeVoz);
  const microfones = useDispositivos("audioinput");
  const saidas = useDispositivos("audiooutput");
  const cameras = useDispositivos("videoinput");

  return (
    <Pagina larga>
      {/* Largura suficiente: áudio à esquerda, entrada e câmera à direita; abaixo disso, uma coluna. */}
      <div className={css.contexto}>
      <div className={css.colunas}>
      <div className={css.coluna}>
      <Bloco>
        <h3 className={ec.titulo}>{t.audio}</h3>
        <Seletor
          rotulo={t.microfone}
          valor={p.entradaId ?? ""}
          opcoes={opcoesDeDispositivo(microfones, t.microfone)}
          semOpcoes={semDispositivo(microfones, t.semMicrofone)}
          aoMudar={(v) => {
            definirPreferenciasDeVoz({ entradaId: v === "" ? undefined : v });
          }}
        />
        <Seletor
          rotulo={t.saida}
          valor={p.saidaId ?? ""}
          opcoes={opcoesDeDispositivo(saidas, t.saida)}
          semOpcoes={semDispositivo(saidas, t.semSaida)}
          aoMudar={(v) => {
            definirPreferenciasDeVoz({ saidaId: v === "" ? undefined : v });
          }}
        />
        <Deslizante
          rotulo={t.volumeDoMicrofone}
          valor={p.volumeDeEntrada}
          min={0}
          max={100}
          texto={config.aparenciaTela.valorPorcento(p.volumeDeEntrada)}
          aoMudar={(v) => {
            definirPreferenciasDeVoz({ volumeDeEntrada: v });
          }}
        />
        <Deslizante
          rotulo={t.volumeDeSaida}
          valor={p.volumeDeSaida}
          min={0}
          max={100}
          texto={config.aparenciaTela.valorPorcento(p.volumeDeSaida)}
          aoMudar={(v) => {
            definirPreferenciasDeVoz({ volumeDeSaida: v });
          }}
        />
        <TesteDeMicrofone limiarDb={p.modo === "deteccao" && !p.sensibilidadeAutomatica ? p.limiarDb : undefined} />
      </Bloco>

      <div className={css.divisorEmUmaColuna}>
        <Divisor />
      </div>

      <Bloco>
        <h3 className={ec.titulo}>{t.ruido}</h3>
        <GrupoDeOpcoes rotulo={t.ruido}>
          {NIVEIS_DE_RUIDO.map((n) => (
            <Opcao
              key={n}
              marcada={p.ruido === n}
              aoEscolher={() => {
                definirPreferenciasDeVoz({ ruido: n });
              }}
            >
              {t.ruidoNiveis[n]}
            </Opcao>
          ))}
        </GrupoDeOpcoes>
        <p className={ec.dica}>{t.ruidoAjuda[p.ruido]}</p>
      </Bloco>

      <div className={css.divisorEmUmaColuna}>
        <Divisor />
      </div>
      </div>

      <div className={css.coluna}>
      <ModoDeEntrada />

      <div className={css.divisorEmUmaColuna}>
        <Divisor />
      </div>

      <Bloco>
        <h3 className={ec.titulo}>{t.camera}</h3>
        <Seletor
          rotulo={t.cameraNome}
          valor={p.cameraId ?? ""}
          opcoes={opcoesDeDispositivo(cameras, t.camera)}
          semOpcoes={semDispositivo(cameras, t.semCamera)}
          aoMudar={(v) => {
            definirPreferenciasDeVoz({ cameraId: v === "" ? undefined : v });
          }}
        />
        <PreviaDaCamera cameraId={p.cameraId} />
        <p className={ec.rotuloDaSecao}>{t.fundo}</p>
        <GrupoDeOpcoes rotulo={t.fundo}>
          {FUNDOS_DE_VIDEO.map((f) => (
            <Opcao
              key={f}
              marcada={p.fundo === f}
              aoEscolher={() => {
                definirPreferenciasDeVoz({ fundo: f });
              }}
            >
              {t.fundos[f]}
            </Opcao>
          ))}
        </GrupoDeOpcoes>
        <p className={ec.dica}>{t.fundoDica}</p>
      </Bloco>
      </div>
      </div>
      </div>
    </Pagina>
  );
}

/* ------------------------------------------------------------- medidor */

const BARRAS = Array.from({ length: BARRAS_DO_MEDIDOR }, (_, i) => ({
  id: `barra-${String(i).padStart(2, "0")}`,
  faixa: faixaDaBarra(i),
}));
const CLASSE_DA_FAIXA = { ok: css.barraOk, alto: css.barraAlto, pico: css.barraPico } as const;

function Medidor({ db, limiarDb }: { db: number | undefined; limiarDb: number | undefined }) {
  const acesas = barrasAcesas(db);
  return (
    <div
      className={css.medidor}
      role="meter"
      aria-label={t.nivel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fracaoDoDb(db ?? LIMIAR_MIN_DB) * 100)}
      aria-valuetext={db === undefined ? t.testeParado : t.testeMedindo}
      data-testid="medidor-de-entrada"
      data-acesas={acesas}
    >
      {BARRAS.map((b, i) => (
        <span key={b.id} className={juntar(css.barra, CLASSE_DA_FAIXA[b.faixa])} data-acesa={i < acesas} />
      ))}
      {limiarDb !== undefined && (
        <span
          className={css.limiar}
          style={{ insetInlineStart: `${String(fracaoDoDb(limiarDb) * 100)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/**
 * Testar o microfone: abre a faixa e MEDE o nível de verdade. O estado de
 * medição vive aqui dentro, então só este bloco acorda a cada passo do nível.
 */
function TesteDeMicrofone({ limiarDb }: { limiarDb: number | undefined }) {
  const [ativo, setAtivo] = useState(false);
  const { estado, faixa } = useFaixaDeTeste(ativo, { audio: constraintsDeAudio(), video: false }, "microfone");
  const db = useNivelDaFaixa(faixa);

  return (
    <div className={ec.campoComRotulo}>
      <span className={ec.rotulo}>{t.testar}</span>
      <div className={css.linhaDoTeste}>
        <Medidor db={db} limiarDb={limiarDb} />
        <Botao
          variante="secundario"
          tamanho="sm"
          aria-pressed={ativo}
          carregando={estado.estado === "abrindo"}
          onClick={() => {
            setAtivo((a) => !a);
          }}
        >
          {ativo ? t.pararTeste : t.testarBotao}
        </Botao>
      </div>
      {estado.estado === "erro" ? (
        <p className={ec.erro} role="alert">
          {estado.erro}
        </p>
      ) : (
        <p className={ec.dica}>{limiarDb !== undefined ? t.limiarDica : t.testeTexto}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------ modo de entrada */

function ModoDeEntrada() {
  const p = useSyncExternalStore(assinarPreferenciasDeVoz, lerPreferenciasDeVoz);
  return (
    <Bloco>
      <h3 className={ec.titulo}>{t.modoDeEntrada}</h3>
      <GrupoDeOpcoes rotulo={t.modoDeEntrada} emColuna>
        <Opcao
          marcada={p.modo === "deteccao"}
          descricao={t.deteccaoDica}
          aoEscolher={() => {
            definirPreferenciasDeVoz({ modo: "deteccao" });
          }}
        >
          {t.deteccao}
        </Opcao>
        <Opcao
          marcada={p.modo === "pressionar"}
          descricao={t.pressionarDica}
          aoEscolher={() => {
            definirPreferenciasDeVoz({ modo: "pressionar" });
          }}
        >
          {t.pressionar}
        </Opcao>
      </GrupoDeOpcoes>

      {p.modo === "deteccao" ? (
        <div className={css.detalhesDoModo}>
          <LinhaDeAjuste nome={t.limiarAutomatico}>
            <Interruptor
              rotulo={t.limiarAutomatico}
              ligado={p.sensibilidadeAutomatica}
              aoMudar={(v) => {
                definirPreferenciasDeVoz({ sensibilidadeAutomatica: v });
              }}
            />
          </LinhaDeAjuste>
          {!p.sensibilidadeAutomatica && (
            <Deslizante
              rotulo={t.limiar}
              valor={p.limiarDb}
              min={LIMIAR_MIN_DB}
              max={LIMIAR_MAX_DB}
              texto={textoDoDb(p.limiarDb)}
              aoMudar={(v) => {
                definirPreferenciasDeVoz({ limiarDb: v });
              }}
            />
          )}
        </div>
      ) : (
        <div className={css.detalhesDoModo}>
          <TeclaDeFalar />
          <Deslizante
            rotulo={t.atrasoAoSoltar}
            valor={p.atrasoAoSoltarMs}
            min={0}
            max={ATRASO_MAX_MS}
            passo={10}
            texto={`${String(p.atrasoAoSoltarMs)} ms`}
            aoMudar={(v) => {
              definirPreferenciasDeVoz({ atrasoAoSoltarMs: v });
            }}
          />
        </div>
      )}
    </Bloco>
  );
}

/**
 * A tecla de falar: mostra a combinação gravada e grava outra.
 *
 * Gravar PAUSA os atalhos de voz — gravar a combinação de mutar com ela já
 * valendo mutaria no meio da gravação — e a pausa termina em todo caminho de
 * saída: tecla aceita, Esc, perder o foco e desmontar. O indicador "segurando"
 * lê o mesmo store que o motor lê para abrir o microfone, então ele diz a
 * verdade sobre o que a tecla está fazendo agora, com ou sem chamada.
 */
function TeclaDeFalar() {
  const atalhos = useSyncExternalStore(assinarAtalhosDeVoz, lerAtalhosDeVoz);
  const segurando = useSyncExternalStore(assinarPushToTalk, lerSegurando);
  const [gravando, setGravando] = useState(false);
  const atual = atalhos.pushToTalk;
  const emConflito = acoesEmConflito(atalhos).has("pushToTalk");

  useEffect(() => {
    if (!gravando) return;
    pausarAtalhos(true);

    /*
      Escuta na CAPTURA da janela, que vem antes da do documento: o Esc que
      cancela a gravação não pode chegar ao diálogo, que também fecha com Esc —
      e as configurações sumiriam junto com a gravação.
    */
    const aoTeclar = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setGravando(false);
        return;
      }
      const c = combinacaoDoEvento(e, MAC);
      if (!c) return; // só um modificador apertado: falta a tecla principal
      definirAtalho("pushToTalk", c);
      setGravando(false);
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => {
      window.removeEventListener("keydown", aoTeclar, true);
      pausarAtalhos(false);
    };
  }, [gravando]);

  return (
    <div className={ec.campoComRotulo}>
      <span className={ec.rotulo}>{t.tecla}</span>
      <div className={css.linhaDaTecla}>
        <span className={css.teclaAtual} data-testid="tecla-de-falar">
          {gravando
            ? t.gravandoTecla
            : atual
              ? teclasDaCombinacao(atual)
                  .map((k) => (k === "mod" ? (MAC ? "⌘" : "Ctrl") : k === "shift" ? "Shift" : k === "alt" ? "Alt" : k))
                  .join(" + ")
              : t.teclaNaoDefinida}
        </span>
        <Botao
          variante="secundario"
          tamanho="sm"
          onClick={() => {
            setGravando((g) => !g);
          }}
          onBlur={() => {
            setGravando(false);
          }}
        >
          {gravando ? t.cancelarGravacao : t.mudarTecla}
        </Botao>
        {segurando && (
          <span className={css.segurando} role="status">
            {t.teclaSegurando}
          </span>
        )}
      </div>
      {emConflito && (
        <p className={ec.erro} role="alert">
          {t.teclaEmConflito}
        </p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- câmera */

/** A prévia só abre quando a pessoa pede: a câmera não acende por abrir uma página. */
function PreviaDaCamera({ cameraId }: { cameraId: string | undefined }) {
  const [ligada, setLigada] = useState(false);
  const { estado, faixa } = useFaixaDeTeste(
    ligada,
    { video: cameraId === undefined ? true : { deviceId: { exact: cameraId } }, audio: false },
    "camera",
  );
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    el.srcObject = faixa ?? null;
  }, [faixa]);

  return (
    <div className={ec.campoComRotulo}>
      <div className={css.previa} data-testid="previa-da-camera">
        <video ref={video} className={css.previaVideo} autoPlay muted playsInline />
        {faixa === undefined && <span>{t.cameraDesligada}</span>}
        {faixa !== undefined && <span className={css.previaLegenda}>{t.cameraPrevia}</span>}
      </div>
      <div className={ec.acoes}>
        <Botao
          variante="secundario"
          tamanho="sm"
          aria-pressed={ligada}
          carregando={estado.estado === "abrindo"}
          onClick={() => {
            setLigada((l) => !l);
          }}
        >
          {ligada ? t.desligarPrevia : t.ligarPrevia}
        </Botao>
      </div>
      {estado.estado === "erro" && (
        <p className={ec.erro} role="alert">
          {estado.erro}
        </p>
      )}
    </div>
  );
}

