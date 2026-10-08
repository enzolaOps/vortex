import {
  capacidadeDeCaptura,
  ponteDeTela,
  RESOLUCOES,
  TAXAS,
  type FonteDeTela,
  type Resolucao,
  type Taxa,
} from "nucleo/sdk/seletorDeTela";
import { useChamada, usePode, useSeletorDeTela } from "nucleo/store/hooks";
import { QUALIDADE_PADRAO } from "nucleo/store/qualidadeDaTela";
import { ponteDoMixer, type AppDeAudio } from "nucleo/sdk/mixerDeApps";
import {
  responderEscolhaDeTela,
  type ModoDoSeletor,
} from "nucleo/store/seletorDeTela";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { voz } from "../../textos";
import { Botao } from "../../ui/ds";
import {
  Alerta,
  CompartilharTela,
  Janela,
  Marcar,
  Tela,
} from "../../ui/icones";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Transmitir.module.css";

/**
 * Lista de fontes de captura.
 *
 * ⚠ **Ponto de extensão do Electron.** No navegador a lista não existe: quem
 * mostra telas, janelas e abas é o `getDisplayMedia`, depois do clique em
 * "Transmitir" (modo `sistema`). Na casca, `window.vortexTela.fontes()` — o
 * `desktopCapturer` do processo principal — devolve as fontes com miniatura, e
 * o painel as mostra (modo `casca`). Esta função é o único lugar que sabe disso;
 * o painel desenha o que ela devolver, e a casca ainda não precisa existir
 * para o painel funcionar na web.
 */
export async function listarFontes(
  modo: ModoDoSeletor,
): Promise<readonly FonteDeTela[]> {
  if (modo !== "casca") return [];
  const ponte = ponteDeTela();
  return ponte ? ponte.fontes() : [];
}

type Fontes =
  | { readonly estado: "carregando" }
  | { readonly estado: "pronto"; readonly lista: readonly FonteDeTela[] }
  | { readonly estado: "falhou" };

/** Setas movem a seleção de um grupo de rádios e levam o foco junto. */
function moverComSetas<T>(
  e: KeyboardEvent<HTMLElement>,
  valores: readonly T[],
  atual: T,
  escolher: (v: T) => void,
) {
  const passo =
    e.key === "ArrowRight" || e.key === "ArrowDown"
      ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowUp"
        ? -1
        : 0;
  if (passo === 0) return;
  e.preventDefault();
  const i = valores.indexOf(atual);
  const proximo = valores[(i + passo + valores.length) % valores.length];
  if (proximo === undefined) return;
  escolher(proximo);
  const grupo = e.currentTarget.closest('[role="radiogroup"]');
  const radios = grupo?.querySelectorAll<HTMLElement>('[role="radio"]');
  radios?.[(i + passo + valores.length) % valores.length]?.focus();
}

function Segmentado<T extends string | number>({
  rotuloId,
  valores,
  atual,
  aoEscolher,
  desabilitado,
}: {
  rotuloId: string;
  valores: readonly T[];
  atual: T;
  aoEscolher: (v: T) => void;
  desabilitado: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-labelledby={rotuloId}
      className={css.segmentado}
    >
      {valores.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === atual}
          tabIndex={v === atual ? 0 : -1}
          disabled={desabilitado}
          className={css.opcao}
          onClick={() => {
            aoEscolher(v);
          }}
          onKeyDown={(e) => {
            moverComSetas(e, valores, atual, aoEscolher);
          }}
        >
          {String(v)}
        </button>
      ))}
    </div>
  );
}

function Formulario({
  modo,
  iniciando,
}: {
  modo: ModoDoSeletor;
  iniciando: boolean;
}) {
  const ids = { som: useId(), res: useId(), fps: useId(), aviso: useId() };
  const captura = capacidadeDeCaptura();
  const [fontes, setFontes] = useState<Fontes>(
    modo === "casca"
      ? { estado: "carregando" }
      : { estado: "pronto", lista: [] },
  );
  const [aba, setAba] = useState<FonteDeTela["tipo"]>("tela");
  const [escolhida, setEscolhida] = useState<string | undefined>();
  const [audio, setAudio] = useState(modo === "casca" || captura.audio);
  const [apps, setApps] = useState<readonly AppDeAudio[]>([]);
  const [fora, setFora] = useState<ReadonlySet<string>>(() => new Set());
  const [resolucao, setResolucao] = useState<Resolucao>(
    QUALIDADE_PADRAO.resolucao,
  );
  const [taxa, setTaxa] = useState<Taxa>(QUALIDADE_PADRAO.taxa);

  useEffect(() => {
    if (modo !== "casca") return;
    let vivo = true;
    listarFontes(modo).then(
      (lista) => {
        if (vivo) setFontes({ estado: "pronto", lista });
      },
      () => {
        if (vivo) setFontes({ estado: "falhou" });
      },
    );
    return () => {
      vivo = false;
    };
  }, [modo]);

  useEffect(() => {
    const ponte = ponteDoMixer();
    if (!ponte) return;
    let vivo = true;
    void ponte.listar().then((lista) => {
      if (vivo) setApps(lista);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const lista =
    fontes.estado === "pronto"
      ? fontes.lista.filter((f) => f.tipo === aba)
      : [];
  const temJanelas =
    fontes.estado === "pronto" && fontes.lista.some((f) => f.tipo === "janela");
  const fonteId = lista.find((f) => f.id === escolhida)?.id ?? lista[0]?.id;

  const semCaptura = modo === "sistema" && !captura.captura;
  const semFonte = modo === "casca" && fonteId === undefined;
  const audioDisponivel = modo === "casca" || captura.audio;
  const podeTransmitir = !semCaptura && !semFonte && !iniciando;
  const pesado = resolucao === "1440p" && taxa === 60;

  return (
    <form
      className={css.formulario}
      onSubmit={(e) => {
        e.preventDefault();
        if (!podeTransmitir) return;
        const excluir = [...fora];
        void ponteDoMixer()?.definir(excluir);
        responderEscolhaDeTela({
          fonteId,
          audio: audioDisponivel && audio,
          resolucao,
          taxa,
          ...(excluir.length > 0 ? { excluir } : {}),
        });
      }}
    >
      {modo === "casca" && temJanelas && (
        <div
          role="tablist"
          aria-label={voz.transmitir.abas}
          className={css.abas}
        >
          {(["tela", "janela"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              role="tab"
              aria-selected={aba === tipo}
              className={css.aba}
              onClick={() => {
                setAba(tipo);
                setEscolhida(undefined);
              }}
            >
              {tipo === "tela" ? voz.transmitir.telas : voz.transmitir.janelas}
            </button>
          ))}
        </div>
      )}

      {modo === "casca" && fontes.estado === "carregando" && (
        <p role="status" className={css.aviso}>
          {voz.transmitir.carregandoFontes}
        </p>
      )}
      {modo === "casca" && fontes.estado === "falhou" && (
        <p role="alert" className={css.aviso}>
          {voz.transmitir.falhaAoListar}
        </p>
      )}
      {modo === "casca" && fontes.estado === "pronto" && lista.length === 0 && (
        <p className={css.aviso}>{voz.transmitir.semFontes}</p>
      )}
      {modo === "casca" && lista.length > 0 && (
        <div
          role="radiogroup"
          aria-label={voz.transmitir.fontes}
          className={css.fontes}
        >
          {lista.map((f) => {
            const marcada = f.id === fonteId;
            const idsDasFontes = lista.map((x) => x.id);
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={marcada}
                aria-label={
                  f.meta
                    ? `${f.nome}, ${f.meta}${marcada ? voz.transmitir.escolhida : ""}`
                    : `${f.nome}${marcada ? voz.transmitir.escolhida : ""}`
                }
                tabIndex={marcada ? 0 : -1}
                className={css.fonte}
                onClick={() => {
                  setEscolhida(f.id);
                }}
                onKeyDown={(e) => {
                  moverComSetas(e, idsDasFontes, f.id, setEscolhida);
                }}
              >
                <span className={css.miniatura}>
                  {f.miniatura !== "" && <img src={f.miniatura} alt="" />}
                  {marcada && (
                    <span className={css.marca} aria-hidden="true">
                      <Marcar tamanho={14} />
                    </span>
                  )}
                </span>
                <span className={css.rotuloDaFonte}>
                  {f.tipo === "tela" ? (
                    <Tela tamanho={14} />
                  ) : (
                    <Janela tamanho={14} />
                  )}{" "}
                  {f.nome}
                  {f.meta ? ` · ${f.meta}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {modo === "sistema" && !semCaptura && (
        <p className={css.aviso}>{voz.transmitir.seletorDoSistema}</p>
      )}
      {semCaptura && (
        <p role="alert" className={css.aviso}>
          {voz.transmitir.semCaptura}
        </p>
      )}

      <div className={css.divisor} />

      <div className={css.linha}>
        <div className={css.rotulo}>
          <span id={ids.som} className={css.rotuloTitulo}>
            {voz.transmitir.som}
          </span>
          <span className={css.rotuloTexto}>
            {audioDisponivel
              ? voz.transmitir.somDescricao
              : voz.transmitir.somIndisponivel}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={audioDisponivel && audio}
          aria-disabled={!audioDisponivel || undefined}
          aria-labelledby={ids.som}
          className={css.interruptor}
          onClick={() => {
            if (audioDisponivel) setAudio((a) => !a);
          }}
        >
          <span className={css.botao} aria-hidden="true" />
        </button>
      </div>

      {apps.length > 0 && audio && (
        <fieldset className={css.linha}>
          <legend className={css.rotuloTitulo}>{voz.transmitir.faixas}</legend>
          <span className={css.rotuloTexto}>
            {voz.transmitir.faixasDescricao}
          </span>
          {apps.map((app) => (
            <label key={app.id}>
              <input
                type="checkbox"
                checked={!fora.has(app.id)}
                onChange={() => {
                  setFora((atual) => {
                    const proximo = new Set(atual);
                    if (proximo.has(app.id)) proximo.delete(app.id);
                    else proximo.add(app.id);
                    return proximo;
                  });
                }}
              />
              {app.nome}
            </label>
          ))}
        </fieldset>
      )}

      <div className={css.linha}>
        <span id={ids.res} className={css.rotuloTitulo}>
          {voz.transmitir.resolucao}
        </span>
        <Segmentado
          rotuloId={ids.res}
          valores={RESOLUCOES}
          atual={resolucao}
          aoEscolher={setResolucao}
          desabilitado={iniciando}
        />
      </div>

      <div className={css.linha}>
        <span id={ids.fps} className={css.rotuloTitulo}>
          {voz.transmitir.quadros}
        </span>
        <Segmentado
          rotuloId={ids.fps}
          valores={TAXAS}
          atual={taxa}
          aoEscolher={setTaxa}
          desabilitado={iniciando}
        />
      </div>

      {pesado && (
        <p role="note" className={css.nota}>
          <Alerta tamanho={16} />
          {voz.transmitir.notaDeRede}
        </p>
      )}

      <div className={css.acoes}>
        <Botao
          variante="secundario"
          onClick={() => {
            responderEscolhaDeTela(undefined);
          }}
        >
          {voz.transmitir.cancelar}
        </Botao>
        <Botao
          type="submit"
          icone={<CompartilharTela />}
          carregando={iniciando}
          aria-disabled={!podeTransmitir || undefined}
        >
          {iniciando ? voz.transmitir.iniciando : voz.transmitir.transmitir}
        </Botao>
      </div>
    </form>
  );
}

/**
 * "O que você quer mostrar?" — o painel que o motor de voz pergunta antes de
 * pedir a captura. Montado uma vez na raiz do shell; abre e fecha pelo store do
 * seletor (`pedirEscolhaDeTela` / `concluirEscolhaDeTela`).
 *
 * ⚠ **Não fecha no clique em "Transmitir".** Entre o clique e a faixa no ar
 * há captura, codec e publicação — na web, a superfície inteira do sistema. O
 * painel fica em "Iniciando…" e quem o fecha é o motor, quando a transmissão
 * está no ar ou falhou. Fechar no clique deixaria um segundo de nada, e um
 * erro sobre uma janela que já sumiu.
 */
export function DialogoDeTransmissao() {
  const seletor = useSeletorDeTela();
  const chamada = useChamada();
  const aberto = seletor.fase !== "fechado";
  // Sem `Video` o formulário nem aparece: a pessoa escolheria fonte e qualidade para ser recusada no fim.
  const podeTransmitir = usePode(chamada.channelId, "transmitirVideo");
  return (
    <Dialogo
      open={aberto}
      onOpenChange={(abrir) => {
        if (!abrir) responderEscolhaDeTela(undefined);
      }}
    >
      {aberto && (
        <ConteudoDoDialogo
          titulo={voz.transmitir.titulo}
          className={css.painel}
        >
          {podeTransmitir ? (
            <Formulario
              modo={seletor.modo}
              iniciando={seletor.fase === "iniciando"}
            />
          ) : (
            <p role="note" className={css.nota}>
              <Alerta tamanho={16} />
              {voz.transmitir.semPermissao}
            </p>
          )}
        </ConteudoDoDialogo>
      )}
    </Dialogo>
  );
}
