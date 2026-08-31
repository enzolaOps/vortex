import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Deslizante } from "../components/ui/Deslizante";
import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Segmentado } from "../components/ui/Segmentado";
import { Selo } from "../components/ui/Selo";
import { Combinacao } from "../components/ui/Tecla";
import { aindaNao } from "../pendente/pendencias";
import {
  assinarPreferenciasDeVoz,
  definirPreferenciasDeVoz,
  FUNDOS_DE_VIDEO,
  lerPreferenciasDeVoz,
  NIVEIS_DE_RUIDO,
  QUALIDADES_DE_VIDEO,
  ROTULO_DA_QUALIDADE,
  ROTULO_DO_FUNDO,
  ROTULO_DO_RUIDO,
} from "../store/preferenciasDeVoz";
import {
  CabecalhoDeSecao,
  CartaoDeAjustes,
  classes as pg,
  GrupoDeAjustes,
  LinhaDeAjuste,
  PaginaDeAjustes,
} from "./Pagina";
import css from "./VozEVideo.module.css";

/**
 * Os dispositivos que o navegador enumera.
 *
 * ⚠ **Sem permissão, `enumerateDevices` devolve entradas com `label` VAZIO** —
 * o navegador esconde o nome do hardware até alguém abrir o microfone uma vez.
 * Por isso a primeira opção é sempre "Padrão do sistema", que é verdade e é o
 * que a maioria quer: com a lista anônima, escolher "Dispositivo 2" é adivinhar.
 *
 * Fora de `sdk/`: `mediaDevices` é API do navegador, não do protocolo, e não
 * arrasta o LiveKit — que é meio megabyte que esta tela não deve baixar.
 */
const PADRAO = "Padrão do sistema";

function useDispositivos(tipo: MediaDeviceKind): readonly MediaDeviceInfo[] {
  const [lista, setLista] = useState<readonly MediaDeviceInfo[]>([]);

  useEffect(() => {
    let vivo = true;
    function ler() {
      void navigator.mediaDevices
        ?.enumerateDevices()
        .then((ds) => {
          if (vivo) setLista(ds.filter((d) => d.kind === tipo));
        })
        .catch(() => {
          /* Sem permissão nem hardware. A lista fica só com o padrão. */
        });
    }
    ler();
    /*
      ⚠ O listener é obrigatório e tem cleanup: plugar um fone durante a
      sessão muda a lista, e sem isto a tela mostraria para sempre os
      dispositivos que existiam quando ela abriu. Listener sem cleanup é o erro
      nº 5 do briefing.
    */
    navigator.mediaDevices?.addEventListener("devicechange", ler);
    return () => {
      vivo = false;
      navigator.mediaDevices?.removeEventListener("devicechange", ler);
    };
  }, [tipo]);

  return lista;
}

/** Rótulos para o seletor: o padrão primeiro, depois o que tiver nome. */
function rotulosDe(ds: readonly MediaDeviceInfo[]): string[] {
  return [PADRAO, ...ds.map((d) => d.label).filter((l) => l.length > 0)];
}

function idDoRotulo(
  ds: readonly MediaDeviceInfo[],
  rotulo: string,
): string | undefined {
  return rotulo === PADRAO
    ? undefined
    : ds.find((d) => d.label === rotulo)?.deviceId;
}

function rotuloDoId(
  ds: readonly MediaDeviceInfo[],
  id: string | undefined,
): string {
  if (id === undefined) return PADRAO;
  return ds.find((d) => d.deviceId === id)?.label ?? PADRAO;
}

function CampoDeDispositivo({
  rotulo,
  dispositivos,
  id,
  aoEscolher,
}: {
  rotulo: string;
  dispositivos: readonly MediaDeviceInfo[];
  id: string | undefined;
  aoEscolher: (id: string | undefined) => void;
}) {
  return (
    <div className={css.campoDeDispositivo}>
      <span className={css.rotuloDoCampo}>{rotulo}</span>
      <Escolha
        rotulo={rotulo}
        rotuloOculto
        className={css.seletorCheio}
        valor={rotuloDoId(dispositivos, id)}
        opcoes={rotulosDe(dispositivos)}
        aoEscolher={(v) => aoEscolher(idDoRotulo(dispositivos, v))}
      />
    </div>
  );
}

function CampoDeVolume({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (v: number) => void;
}) {
  return (
    <div className={css.volume}>
      <div className={css.linhaDoVolume}>
        <span className={css.rotuloDoCampo}>{rotulo}</span>
        <span className={css.valor}>{valor}%</span>
      </div>
      <Deslizante
        id={`volume-${rotulo}`}
        valor={valor}
        min={0}
        max={100}
        passo={1}
        rotulo={rotulo}
        texto={`${String(valor)} por cento`}
        aoMudar={aoMudar}
      />
    </div>
  );
}

/**
 * Os atalhos que funcionam com o app em segundo plano.
 *
 * ⚠ **Eles são só do DESIGN hoje, e o conflito é a razão de estarem aqui
 * mesmo assim.** Gravar combinação global é `globalShortcut` do Electron — o
 * navegador não vê tecla fora da aba. Mas a tabela ensina a regra que vai valer
 * quando existir: combinação repetida derruba as DUAS linhas, e as duas se
 * acusam. Marcar só uma faria a pessoa consertar a errada.
 */
const ATALHOS_GLOBAIS = [
  { acao: "Push-to-talk", teclas: ["alt", "Espaço"] },
  { acao: "Mutar microfone", teclas: ["shift", "mod", "M"] },
  { acao: "Ensurdecer", teclas: ["shift", "mod", "D"] },
  { acao: "Desconectar da voz", teclas: ["shift", "mod", "backspace"] },
  { acao: "Alternar overlay", teclas: ["shift", "mod", "M"] },
] as const;

/** Uma combinação repetida marca TODAS as linhas que a usam. */
const REPETIDAS = new Set(
  ATALHOS_GLOBAIS.map((a) => a.teclas.join("+")).filter(
    (c, i, todas) => todas.indexOf(c) !== i,
  ),
);

/**
 * Voz e vídeo.
 *
 * ⚠ **Quatro destas preferências chegam ao WebRTC de verdade** — dispositivo
 * de entrada, supressão de ruído, cancelamento de eco e controle de ganho são
 * lidos por `constraintsDeAudio()` quando o motor abre o microfone, e trocar
 * de dispositivo com a chamada aberta troca ao vivo. O resto é preferência
 * guardada; o que depende de algo que o navegador não dá está no registro de
 * pendências, e clicar diz o quê.
 *
 * A tela NÃO importa `motorDeVoz`: ele carrega meio megabyte de WebRTC, e a
 * página de configuração de voz é justamente onde se está sem estar em
 * chamada. O motor lê o store; o store não conhece o motor.
 */
export function VozEVideo() {
  const p = useSyncExternalStore(
    assinarPreferenciasDeVoz,
    lerPreferenciasDeVoz,
  );
  const entradas = useDispositivos("audioinput");
  const saidas = useDispositivos("audiooutput");
  const cameras = useDispositivos("videoinput");

  return (
    <PaginaDeAjustes>
      <div className={css.dispositivos}>
        <div>
          <CampoDeDispositivo
            rotulo="Dispositivo de entrada"
            dispositivos={entradas}
            id={p.entradaId}
            aoEscolher={(entradaId) => definirPreferenciasDeVoz({ entradaId })}
          />
          <CampoDeVolume
            rotulo="Volume de entrada"
            valor={p.volumeDeEntrada}
            aoMudar={(volumeDeEntrada) =>
              definirPreferenciasDeVoz({ volumeDeEntrada })
            }
          />
        </div>

        <div>
          <CampoDeDispositivo
            rotulo="Dispositivo de saída"
            dispositivos={saidas}
            id={p.saidaId}
            aoEscolher={(saidaId) => definirPreferenciasDeVoz({ saidaId })}
          />
          <CampoDeVolume
            rotulo="Volume de saída"
            valor={p.volumeDeSaida}
            aoMudar={(volumeDeSaida) =>
              definirPreferenciasDeVoz({ volumeDeSaida })
            }
          />
        </div>
      </div>

      <CartaoDeAjustes>
        <div className={css.testeTopo}>
          <div className={pg.texto}>
            <div className={pg.titulo}>Teste de microfone</div>
            <p className={pg.detalhe}>Grave 5 s e ouça de volta</p>
          </div>
          <Botao tamanho="pequeno" onClick={aindaNao("testeDeMicrofone")}>
            Testar
          </Botao>
        </div>

        {/*
          O medidor fica PARADO, e é a verdade — não há analisador ligado (ver
          `medidorDeEntrada`). Barras animadas com número inventado seriam a
          mesma mentira do "Conectado · 42 ms" que a faixa de voz recusou.
        */}
        <div className={css.medidor}>
          <span className={css.rotuloDoMedidor}>Entrada</span>
          <div
            className={css.barras}
            role="meter"
            aria-label="Nível de entrada"
            aria-valuenow={0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext="sem medição — o medidor ao vivo ainda não existe"
          >
            {BARRAS.map((b) => (
              <span key={b} className={css.barra} aria-hidden />
            ))}
          </div>
          <span className={css.db}>— dB</span>
        </div>
      </CartaoDeAjustes>

      <CabecalhoDeSecao titulo="Modo de entrada" />

      {/*
        `CartaoDeOpcao` compartilhado. Esta era uma das quatro cópias do mesmo
        cartão, e a que divergia mais: fundo `surface-1` contra `surface-3` nas
        outras, e hover de FUNDO onde as outras usavam hover de BORDA.
      */}
      <div className={css.modos} role="radiogroup" aria-label="Modo de entrada">
        {MODOS.map((m) => (
          <CartaoDeOpcao
            key={m.id}
            marcado={p.modo === m.id}
            titulo={m.rotulo}
            detalhe={m.detalhe}
            aoEscolher={() => definirPreferenciasDeVoz({ modo: m.id })}
          />
        ))}
      </div>

      <GrupoDeAjustes>
        <LinhaDeAjuste titulo="Sensibilidade automática">
          <Interruptor
            ligado={p.sensibilidadeAutomatica}
            rotulo="Sensibilidade automática"
            aoAlternar={(v) =>
              definirPreferenciasDeVoz({ sensibilidadeAutomatica: v })
            }
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Processamento de áudio" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Supressão de ruído"
          detalhe="Remove teclado e ventilador; custa CPU"
        >
          <Segmentado
            rotulo="Supressão de ruído"
            valor={p.ruido}
            opcoes={NIVEIS_DE_RUIDO.map((n) => ({
              id: n,
              rotulo: ROTULO_DO_RUIDO[n],
            }))}
            aoEscolher={(ruido) => {
              /*
                ⚠ "Agressiva" é a única das três que o navegador não sabe
                fazer: `noiseSuppression` é BOOLEANO. Ela guarda a escolha e
                diz do que depende, em vez de silenciosamente valer o mesmo que
                "Padrão" — que é o defeito de parecer que funcionou.
              */
              definirPreferenciasDeVoz({ ruido });
              if (ruido === "agressiva") aindaNao("ruidoAgressivo")();
            }}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Cancelamento de eco"
          detalhe="Necessário sem fones"
        >
          <Interruptor
            ligado={p.eco}
            rotulo="Cancelamento de eco"
            aoAlternar={(eco) => definirPreferenciasDeVoz({ eco })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Controle automático de ganho"
          detalhe="Nivela o volume da sua voz"
        >
          <Interruptor
            ligado={p.ganho}
            rotulo="Controle automático de ganho"
            aoAlternar={(ganho) => definirPreferenciasDeVoz({ ganho })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Atenuar outros apps"
          detalhe="Baixa o volume do sistema em 50% quando alguém fala"
        >
          <Interruptor
            ligado={p.atenuarOutrosApps}
            rotulo="Atenuar outros apps"
            aoAlternar={(v) => {
              definirPreferenciasDeVoz({ atenuarOutrosApps: v });
              if (v) aindaNao("atenuarOutrosApps")();
            }}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Vídeo" />

      <div className={css.video}>
        <div className={css.previa}>
          <div className={css.palco}>prévia da câmera</div>
          <Botao onClick={aindaNao("previaDaCamera")}>Testar câmera</Botao>
        </div>

        <div className={css.controlesDeVideo}>
          <CampoDeDispositivo
            rotulo="Câmera"
            dispositivos={cameras}
            id={p.cameraId}
            aoEscolher={(cameraId) => definirPreferenciasDeVoz({ cameraId })}
          />

          <div>
            <span className={css.rotuloDoCampo}>Qualidade</span>
            <Segmentado
              rotulo="Qualidade do vídeo"
              valor={p.qualidade}
              opcoes={QUALIDADES_DE_VIDEO.map((q) => ({
                id: q,
                rotulo: ROTULO_DA_QUALIDADE[q],
              }))}
              aoEscolher={(qualidade) =>
                definirPreferenciasDeVoz({ qualidade })
              }
            />
          </div>

          <div>
            <span className={css.rotuloDoCampo}>Fundo</span>
            <Segmentado
              rotulo="Fundo do vídeo"
              valor={p.fundo}
              opcoes={FUNDOS_DE_VIDEO.map((f) => ({
                id: f,
                rotulo: ROTULO_DO_FUNDO[f],
              }))}
              aoEscolher={(fundo) => {
                definirPreferenciasDeVoz({ fundo });
                if (fundo !== "nenhum") aindaNao("fundoDeVideo")();
              }}
            />
          </div>
        </div>
      </div>

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Espelhar meu vídeo"
          detalhe="Só para você; os outros veem sem espelho"
        >
          <Interruptor
            ligado={p.espelhar}
            rotulo="Espelhar meu vídeo"
            aoAlternar={(espelhar) => definirPreferenciasDeVoz({ espelhar })}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Atalhos globais" />

      <div className={css.tabela}>
        <div className={css.cabecalhoDaTabela}>
          <span>Ação</span>
          <span>Combinação</span>
          <span />
        </div>

        {ATALHOS_GLOBAIS.map((a) => {
          const conflito = REPETIDAS.has(a.teclas.join("+"));
          return (
            <div
              key={a.acao}
              className={css.linhaDaTabela}
              data-conflito={conflito}
            >
              <span className={css.acao}>
                {a.acao}
                {conflito ? (
                  <Selo forma="etiqueta" tom="perigo">
                    Conflito
                  </Selo>
                ) : null}
              </span>
              <Combinacao
                teclas={a.teclas}
                className={conflito ? css.conflitoNaTecla : undefined}
              />
              <Botao
                variante="sutil"
                tamanho="pequeno"
                onClick={aindaNao("atalhoGlobal")}
              >
                Editar
              </Botao>
            </div>
          );
        })}
      </div>

      <p className={pg.recado}>
        Conflito é detectado na hora da gravação: a combinação duplicada aparece
        nas duas linhas e nenhuma das duas funciona até resolver. Atalho global
        só vale no aplicativo de desktop — o navegador não vê tecla fora da aba.
      </p>
    </PaginaDeAjustes>
  );
}

const MODOS = [
  {
    id: "deteccao",
    rotulo: "Detecção de voz",
    detalhe: "Transmite quando você fala.",
  },
  {
    id: "pressionar",
    rotulo: "Push-to-talk",
    detalhe: "Transmite só enquanto a tecla estiver pressionada.",
  },
] as const;

/*
  As barras do medidor.

  Array de constantes e não `Array.from`: o `key` do projeto não pode ser
  índice, e a lista é fixa — vinte segmentos, sempre os mesmos.
*/
const BARRAS = [
  "b01", "b02", "b03", "b04", "b05", "b06", "b07", "b08", "b09", "b10",
  "b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20",
] as const;
