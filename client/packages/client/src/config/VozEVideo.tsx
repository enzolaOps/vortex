import { useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Deslizante } from "../components/ui/Deslizante";
import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Segmentado } from "../components/ui/Segmentado";
import {
  useFaixaLocal,
  useMedirEntrada,
  useTesteDeMicrofone,
} from "./midiaDeTeste";
import { BarrasDoMedidor, LimiarManual, TextoDoNivel } from "./MedidorDeEntrada";
import { Combinacao } from "../components/ui/Tecla";
import {
  assinarAtalhosDeVoz,
  lerAtalhosDeVoz,
  teclasDaCombinacao,
} from "../store/atalhosDeVoz";
import {
  assinarPreferenciasDeVoz,
  definirPreferenciasDeVoz,
  ATRASO_MAX_MS,
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
import { TabelaDeAtalhos, useGravacaoDeAtalho } from "./TabelaDeAtalhos";
import { assinarDesktop, lerDesktop } from "../store/desktop";

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
  const { naCasca } = useSyncExternalStore(assinarDesktop, lerDesktop);
  const entradas = useDispositivos("audioinput");
  const saidas = useDispositivos("audiooutput");
  const cameras = useDispositivos("videoinput");

  /*
    Duas faixas locais, abertas só por estas telas — ver `midiaDeTeste.ts`.

    ⚠ **Separadas e não uma com áudio+vídeo.** Testar o microfone não deve
    acender a luz da câmera, e é exatamente o que uma faixa combinada faria.
  */
  const mic = useFaixaLocal();
  const cam = useFaixaLocal();
  /* Publica no store efêmero do nível — só os medidores assinam. */
  useMedirEntrada(mic.faixa);
  const teste = useTesteDeMicrofone();

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
            {/* O detalhe vira o ESTADO enquanto o teste roda: "Grave 5 s"
                deixa de ser instrução no instante em que ela foi seguida, e
                quem está gravando precisa saber que está. */}
            <p className={pg.detalhe}>
              {teste.fase === "gravando"
                ? "Gravando… fale agora"
                : teste.fase === "tocando"
                  ? "Ouça de volta"
                  : "Grave 5 s e ouça de volta"}
            </p>
          </div>
          <Botao
            tamanho="pequeno"
            /* "Parar teste" em vermelho suave, do design: enquanto grava, o
               botão é a SAÍDA, e ela precisa se distinguir do convite. */
            variante={mic.estado === "ligado" ? "perigoSutil" : "primario"}
            carregando={mic.estado === "abrindo"}
            rotuloCarregando="Abrindo…"
            onClick={() => {
              if (mic.estado === "ligado") {
                teste.encerrar();
                mic.fechar();
                return;
              }
              /*
                ⚠ **Constraints montadas AQUI, a partir das preferências
                LIDAS** — o teste nunca escreve em `preferenciasDeVoz`. O motor
                de voz assina aquele store, e escrever ali trocaria o
                dispositivo de uma chamada viva no meio de uma frase.
              */
              void mic
                .abrir({
                  audio:
                    p.entradaId !== undefined
                      ? { deviceId: { exact: p.entradaId } }
                      : true,
                })
                .then((faixa) => {
                  if (faixa) teste.gravar(faixa);
                });
            }}
          >
            {mic.estado === "ligado" ? "Parar teste" : "Vamos testar"}
          </Botao>
        </div>

        {/*
          O medidor MEDE — `useMedirEntrada` liga um `AnalyserNode` na faixa
          aberta pelo botão acima e publica o dB num store efêmero; as barras e
          o número assinam sozinhos. Sem teste rodando o número vira "— dB",
          que continua sendo a verdade: não há o que medir.
        */}
        <div className={css.medidor}>
          <span className={css.rotuloDoMedidor}>Entrada</span>
          <BarrasDoMedidor medindo={mic.estado === "ligado"} />
          <TextoDoNivel tocando={teste.fase === "tocando"} />
        </div>
        {mic.erro !== undefined ? (
          <p className={css.erroDeMidia} role="alert">
            {mic.erro}
          </p>
        ) : null}
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

      {/*
        ⚠ **Um bloco OU o outro, pelo modo** (D-VOZ-32). Sensibilidade não
        significa nada em push-to-talk — quem abre o microfone é a tecla —, e
        a tecla não significa nada em detecção. Mostrar os dois obrigava a
        pessoa a descobrir qual dos dois estava valendo.
      */}
      {p.modo === "deteccao" ? (
        <CartaoDeAjustes>
          <div className={css.cabecaDoBloco}>
            <div className={pg.titulo}>Sensibilidade automática</div>
            <Interruptor
              ligado={p.sensibilidadeAutomatica}
              rotulo="Sensibilidade automática"
              aoAlternar={(v) =>
                definirPreferenciasDeVoz({ sensibilidadeAutomatica: v })
              }
            />
          </div>
          {/* O limiar só existe com a automática DESLIGADA: com ela ligada
              quem decide é o navegador, e uma marca arrastável ali seria um
              controle sem efeito. */}
          {p.sensibilidadeAutomatica ? null : (
            <LimiarManual limiarDb={p.limiarDb} />
          )}
        </CartaoDeAjustes>
      ) : (
        <BlocoDePushToTalk atrasoMs={p.atrasoAoSoltarMs} />
      )}

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
            /*
              "Agressiva" é o RNNoise (`voz/ruidoForte.ts`), aplicado pelo
              motor de voz na faixa do microfone — carregado só quando esta
              opção vale e há chamada aberta. Falhar cai para "Padrão" e diz.
            */
            aoEscolher={(ruido) => definirPreferenciasDeVoz({ ruido })}
          />
        </LinhaDeAjuste>

        {/*
          ⚠ **Este é o único interruptor desta tela que CONSOME o que guarda.**
          Os vizinhos escrevem preferência que o motor de voz aplica na próxima
          captura; este liga e desliga os cinco sons na hora, e ouvir a
          diferença é a confirmação. Ver `som/sons.ts`.

          Fica em "Processamento de áudio" e não numa seção própria porque uma
          seção com uma linha só é cabeçalho procurando conteúdo.
        */}
        <LinhaDeAjuste
          titulo="Sons do app"
          detalhe="Entrar e sair da sala, silenciar, queda de conexão"
        >
          <Interruptor
            ligado={p.sons}
            rotulo="Sons do app"
            aoAlternar={(sons) => definirPreferenciasDeVoz({ sons })}
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
          detalhe={
            /* O navegador não mexe no volume de outros programas; dizer isso é
               melhor que um interruptor que liga e não faz nada. */
            naCasca
              ? "Baixa o volume dos outros programas em 50% quando alguém fala"
              : "Só no aplicativo de desktop — o navegador não controla outros programas"
          }
        >
          <Interruptor
            ligado={p.atenuarOutrosApps}
            rotulo="Atenuar outros apps"
            aoAlternar={(v) => definirPreferenciasDeVoz({ atenuarOutrosApps: v })}
          />
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Vídeo" />

      <div className={css.video}>
        <div className={css.previa}>
          <div className={css.palco}>
            {cam.faixa !== null ? (
              /*
                ⚠ **`muted` não é opcional.** A faixa é de VÍDEO, mas o
                navegador recusa `autoPlay` sem ele em qualquer `<video>` —
                a prévia ficaria no primeiro quadro, parada, sem erro nenhum.
              */
              <video
                className={css.imagemDaCamera}
                autoPlay
                muted
                playsInline
                ref={(el) => {
                  if (el) el.srcObject = cam.faixa;
                }}
              />
            ) : cam.estado === "abrindo" ? (
              "abrindo a câmera…"
            ) : (
              "prévia da câmera"
            )}
          </div>
          <Botao
            carregando={cam.estado === "abrindo"}
            rotuloCarregando="Abrindo…"
            onClick={() => {
              if (cam.estado === "ligado") {
                cam.fechar();
                return;
              }
              void cam.abrir({
                video:
                  p.cameraId !== undefined
                    ? { deviceId: { exact: p.cameraId } }
                    : true,
              });
            }}
          >
            {cam.estado === "ligado" ? "Parar câmera" : "Testar câmera"}
          </Botao>
          {cam.erro !== undefined ? (
            <p className={css.erroDeMidia} role="alert">
              {cam.erro}
            </p>
          ) : null}
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
              /* Aplicado pelo motor só com a câmera ligada — ver
                 `voz/fundoDeVideo.ts`. */
              aoEscolher={(fundo) => definirPreferenciasDeVoz({ fundo })}
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

      <TabelaDeAtalhos />

      <p className={pg.recado}>
        Conflito é detectado na hora da gravação: a combinação duplicada aparece
        nas duas linhas e nenhuma das duas funciona até resolver. No navegador
        os atalhos valem com a aba em foco; no aplicativo de desktop, também com
        ele em segundo plano.
      </p>
    </PaginaDeAjustes>
  );
}

/**
 * O bloco do push-to-talk: a tecla, o "Regravar" e o atraso ao soltar.
 *
 * "Regravar" é a MESMA gravação do "Editar" da tabela de atalhos — o hook é
 * compartilhado, e a combinação gravada aqui aparece lá, porque o atalho é um
 * só. O atraso é real: `soltarTecla` segura o microfone aberto por ele.
 */
function BlocoDePushToTalk({ atrasoMs }: { atrasoMs: number }) {
  const atalhos = useSyncExternalStore(assinarAtalhosDeVoz, lerAtalhosDeVoz);
  const [gravando, setGravando] = useGravacaoDeAtalho();
  const tecla = atalhos.pushToTalk;
  const estaGravando = gravando === "pushToTalk";

  return (
    <CartaoDeAjustes>
      <div className={css.cabecaDoBloco}>
        <div className={pg.texto}>
          <div className={pg.titulo}>Tecla de push-to-talk</div>
          <p className={pg.detalhe}>
            Funciona também com o app em segundo plano
          </p>
        </div>
        <div className={css.teclaDoBloco}>
          {estaGravando ? (
            <span className={css.gravando} aria-live="polite">
              Pressione a combinação… (Esc cancela)
            </span>
          ) : tecla ? (
            <Combinacao teclas={teclasDaCombinacao(tecla)} />
          ) : (
            <span className={css.semAtalho}>sem atalho</span>
          )}
          <Botao
            variante="sutil"
            tamanho="pequeno"
            aria-pressed={estaGravando}
            onClick={() => setGravando(estaGravando ? undefined : "pushToTalk")}
          >
            {estaGravando ? "Cancelar" : "Regravar"}
          </Botao>
        </div>
      </div>
      <div className={css.linhaDoVolume}>
        <span className={css.rotuloDoLimiar}>Atraso ao soltar</span>
        <span className={css.valor}>{atrasoMs} ms</span>
      </div>
      <Deslizante
        id="atraso-ao-soltar"
        valor={atrasoMs}
        min={0}
        max={ATRASO_MAX_MS}
        passo={10}
        rotulo="Atraso ao soltar"
        texto={`${String(atrasoMs)} milissegundos`}
        aoMudar={(atrasoAoSoltarMs) =>
          definirPreferenciasDeVoz({ atrasoAoSoltarMs })
        }
      />
    </CartaoDeAjustes>
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
