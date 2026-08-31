import { Check, SpeakerHigh } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Interruptor } from "../components/ui/Interruptor";
import { Segmentado } from "../components/ui/Segmentado";
import {
  ponteDeTela,
  RESOLUCOES,
  TAXAS,
  trocaDe,
  type FonteDeTela,
  type Resolucao,
  type Taxa,
} from "../sdk/seletorDeTela";
import { lerChamada } from "../store/chamada";
import { useChannel } from "../store/hooks";
import { responderEscolhaDeTela } from "../store/seletorDeTela";
import css from "./SeletorDeTela.module.css";

/** As três abas da referência. */
const ABAS = ["tela", "janela", "aba"] as const;
type Aba = (typeof ABAS)[number];

const NOME_DA_ABA: Record<Aba, string> = {
  tela: "Telas",
  janela: "Janelas",
  aba: "Abas",
};

/**
 * O que o áudio pega em cada categoria — e é o que separa as duas.
 *
 * ⚠ **A categoria é "a tela toda" ou "um aplicativo específico"**, e o áudio é
 * onde essa diferença aparece: tela inteira leva o som do sistema, com
 * notificação junto; aplicativo leva só o dele. As frases são as da
 * referência.
 */
const DICA_DE_AUDIO: Record<Aba, string> = {
  tela: "Captura o áudio do sistema — pode incluir notificações",
  janela: "Só o áudio do app selecionado",
  aba: "Áudio da aba disponível neste navegador",
};

/**
 * Escolher o que transmitir.
 *
 * ⚠ **A estrutura é a da REFERÊNCIA, não a do `.dc.html`.** A primeira versão
 * saiu só do design e divergiu em oito pontos — grade fluida em vez de três
 * colunas, cartão sem segunda linha nem selo de conferido, resolução e quadros
 * empilhados, rodapé sem a frase de consequência, botão de rótulo fixo, aba
 * "Abas" ausente e subtítulo sem o canal. A referência decide o que EXISTE; o
 * design decide os VALORES.
 *
 * ⚠ **Ele não substitui o seletor do navegador; existe onde o navegador não
 * tem um que sirva.** Na web, `getDisplayMedia` abre a superfície do sistema e
 * nenhuma página a desenha. Na casca, o `desktopCapturer` entrega a lista e a
 * escolha volta a ser do produto.
 *
 * ⚠ **A escolha acontece ANTES da captura.** Resolução e taxa são constraints
 * fixadas na chamada de `getDisplayMedia`; um seletor que respondesse a um
 * pedido em voo — como o upstream faz — só escolheria a fonte, e as outras
 * duas colunas ficariam decorativas. Ver `desktop/src/native/telaCompartilhada.ts`.
 *
 * ⚠ **O banner de permissão é REAL.** Ele vem de
 * `systemPreferences.getMediaAccessStatus("screen")` na casca, que só existe
 * no macOS — Windows não pede permissão para capturar, e no Linux quem decide
 * é o portal do Wayland no momento da captura. Nos dois a casca devolve
 * `concedida`, e o banner não aparece.
 */
export function SeletorDeTela({ aoFechar }: { aoFechar: () => void }) {
  const [fontes, setFontes] = useState<readonly FonteDeTela[] | "carregando">(
    "carregando",
  );
  /* Abre em JANELAS, como a referência: compartilhar um app é o caso comum, e
     a tela inteira é a escolha que expõe notificação e o resto da área. */
  const [aba, setAba] = useState<Aba>("janela");
  const [escolhida, setEscolhida] = useState<string | undefined>(undefined);
  const [audio, setAudio] = useState(true);
  const [resolucao, setResolucao] = useState<Resolucao>("1080p");
  const [taxa, setTaxa] = useState<Taxa>(30);
  const [permissao, setPermissao] = useState<"concedida" | "pendente">(
    "concedida",
  );

  const chamada = lerChamada();
  const canal = useChannel(chamada.channelId ?? "");

  useEffect(() => {
    let vivo = true;
    void ponteDeTela()
      ?.fontes()
      .then((f) => {
        if (!vivo) return;
        setFontes(f);
        /* A primeira da aba aberta já vem escolhida: um painel que abre sem
           nada marcado obriga um clique a mais para a ação que quase todo mundo
           quer. */
        setEscolhida(f.find((x) => x.tipo === "janela")?.id ?? f[0]?.id);
      });
    void ponteDeTela()
      ?.permissao()
      .then((p) => {
        if (vivo) setPermissao(p);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
    ⚠ Cancelar por `Esc`, pelo véu ou pelo botão passa TODO pelo mesmo lugar. O
    motor está esperando a promessa; um caminho de fechamento que não
    respondesse deixaria `alternarTela` pendurada para sempre, e o botão de
    compartilhar mudo pelo resto da sessão.
  */
  function cancelar(): void {
    void ponteDeTela()?.cancelar();
    responderEscolhaDeTela(undefined);
    aoFechar();
  }

  const lista = fontes === "carregando" ? [] : fontes;
  const daAba = aba === "aba" ? [] : lista.filter((f) => f.tipo === aba);
  const conta: Record<Aba, number> = {
    tela: lista.filter((f) => f.tipo === "tela").length,
    janela: lista.filter((f) => f.tipo === "janela").length,
    aba: 0,
  };

  /*
    O rótulo diz o que vai acontecer, com os números escolhidos — é a
    referência, e ela está certa: "Transmitir" sozinho não confirma nada, e a
    resolução fica três linhas acima, fora do alcance do olhar de quem já
    decidiu clicar.
  */
  const rotulo =
    escolhida === undefined
      ? "Escolha uma fonte"
      : `Transmitir ${resolucao} · ${String(taxa)} fps`;

  return (
    <Dialog open onOpenChange={(v) => !v && cancelar()}>
      <DialogContent
        titulo="Compartilhar tela"
        descricao={
          canal
            ? `em #${canal.name} · ${String(chamada.participantes.length)} pessoas vão ver`
            : "Escolha o que as pessoas da sala vão ver."
        }
        className={css.painel}
        rodape={
          <>
            <p className={css.consequencia}>{trocaDe(resolucao, taxa)}</p>
            <span className={css.acoes}>
              <Botao variante="sutil" onClick={cancelar}>
                Cancelar
              </Botao>
              <Botao
                variante="primario"
                disabled={escolhida === undefined}
                onClick={() => {
                  if (escolhida === undefined) return;
                  responderEscolhaDeTela({
                    fonteId: escolhida,
                    audio,
                    resolucao,
                    taxa,
                  });
                  aoFechar();
                }}
              >
                {rotulo}
              </Botao>
            </span>
          </>
        }
      >
        <div className={css.abas} role="tablist" aria-label="Tipo de fonte">
          {ABAS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={aba === t}
              className={css.aba}
              onClick={() => {
                setAba(t);
                const primeira = lista.find((f) => f.tipo === t);
                if (primeira) setEscolhida(primeira.id);
              }}
            >
              {NOME_DA_ABA[t]}
              <span className={css.contagem}>{conta[t]}</span>
            </button>
          ))}
        </div>

        {/*
          ⚠ **O banner de permissão VOLTOU, e eu o tinha removido por um
          raciocínio que não é meu para fazer.** Eu argumentei que no macOS o
          Vortex nem abre este painel — verdade —, e concluí que o banner seria
          sobre uma tela invisível. Só que a referência o tem, a regra deste
          projeto é 1:1 com ela, e o estado agora é REAL: vem de
          `systemPreferences.getMediaAccessStatus("screen")` na casca, que
          devolve "concedida" fora do macOS.
        */}
        {permissao === "pendente" ? (
          <Banner
            tom="aviso"
            className={css.permissao}
            titulo="O sistema precisa autorizar a captura"
            acoes={
              <Botao
                variante="sutil"
                tamanho="pequeno"
                onClick={() => void ponteDeTela()?.abrirAjustes()}
              >
                Abrir ajustes
              </Botao>
            }
          >
            Abra as preferências de privacidade e libere o Vortex. O modal fica
            aberto e revalida sozinho quando a permissão é concedida.
          </Banner>
        ) : null}

        {fontes === "carregando" ? (
          <div className={css.vazio}>
            <EstadoVazio compacto titulo="Procurando telas e janelas…" />
          </div>
        ) : aba === "aba" ? (
          /*
            ⚠ **A aba EXISTE e está vazia, com o motivo escrito.** A referência
            a tem, e escondê-la seria divergir dela em silêncio. Mas o
            `desktopCapturer` enumera `screen` e `window` do SISTEMA — aba de
            navegador não é fonte que a casca alcance. Dizer isso, e apontar a
            saída, é melhor que sumir com a aba ou mostrar lista falsa.
          */
          <div className={css.vazio}>
            <EstadoVazio
              compacto
              titulo="A casca não enumera abas"
              detalhe="O sistema entrega telas e janelas. Para mostrar uma aba, compartilhe a janela do navegador."
            />
          </div>
        ) : daAba.length === 0 ? (
          <div className={css.vazio}>
            <EstadoVazio
              compacto
              titulo={aba === "tela" ? "Nenhuma tela" : "Nenhuma janela aberta"}
              detalhe="Abra o que você quer mostrar e volte aqui."
            />
          </div>
        ) : (
          <div className={css.grade}>
            {daAba.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={escolhida === f.id}
                className={css.fonte}
                onClick={() => setEscolhida(f.id)}
              >
                <span className={css.quadro}>
                  {/* `alt=""`: o nome está no rótulo logo abaixo, e repeti-lo
                      faria o leitor de tela anunciar duas vezes. */}
                  <img className={css.miniatura} src={f.miniatura} alt="" />
                  {escolhida === f.id ? (
                    <span className={css.selo} aria-hidden>
                      <Check size={11} weight="bold" />
                    </span>
                  ) : null}
                </span>
                <span className={css.textos}>
                  <span className={css.nome}>{f.nome}</span>
                  {/* Segunda linha só quando há o que dizer — ver `meta` no
                      contrato: janela não tem dimensão conhecida. */}
                  {f.meta !== undefined ? (
                    <span className={css.meta}>{f.meta}</span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className={css.opcoes}>
          <div className={css.audio}>
            <span className={css.audioTexto}>
              <SpeakerHigh size={16} className={css.glifo} aria-hidden />
              <span>
                <span className={css.audioTitulo}>
                  Compartilhar áudio da fonte
                </span>
                {/*
                  ⚠ A dica muda com a ABA, e não é enfeite: o loopback pega o
                  som do SISTEMA, não o da janela escolhida. Quem compartilha
                  uma janela achando que só o som dela vai junto transmite a
                  chamada inteira de volta.
                */}
                {/* As três frases são as da referência. Ela separa por
                    CATEGORIA porque é isso que muda o que o áudio pega: a tela
                    inteira leva o som do sistema, um aplicativo leva só o
                    dele. */}
                <span className={css.audioDica}>{DICA_DE_AUDIO[aba]}</span>
              </span>
            </span>
            <Interruptor
              ligado={audio}
              rotulo="Compartilhar áudio da fonte"
              aoAlternar={setAudio}
            />
          </div>

          <div className={css.duas}>
            <div>
              <div className={css.sobrancelhaDoCampo}>Resolução</div>
              <div className={css.estica}>
                <Segmentado
                  rotulo="Resolução"
                  valor={resolucao}
                  opcoes={RESOLUCOES.map((r) => ({ id: r, rotulo: r }))}
                  aoEscolher={setResolucao}
                />
              </div>
            </div>
            <div>
              <div className={css.sobrancelhaDoCampo}>Taxa de quadros</div>
              <div className={css.estica}>
                <Segmentado
                  rotulo="Taxa de quadros"
                  valor={String(taxa)}
                  opcoes={TAXAS.map((t) => ({
                    id: String(t),
                    rotulo: String(t),
                  }))}
                  aoEscolher={(id) => setTaxa(Number(id) as Taxa)}
                />
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
