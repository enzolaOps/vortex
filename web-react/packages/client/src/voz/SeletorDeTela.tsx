import { useEffect, useState } from "react";

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
import { responderEscolhaDeTela } from "../store/seletorDeTela";
import css from "./SeletorDeTela.module.css";

type Aba = "tela" | "janela";

/**
 * Escolher o que transmitir — o painel do design, só na casca.
 *
 * ⚠ **Ele NÃO substitui o seletor do navegador; ele existe onde o navegador
 * não tem um que sirva.** Na web, `getDisplayMedia` abre a superfície do
 * sistema e nenhuma página pode desenhá-la — este painel nunca aparece ali. Na
 * casca Electron o `desktopCapturer` entrega a lista, e aí a escolha volta a
 * ser do produto.
 *
 * ⚠ **A escolha acontece ANTES da captura.** Ver
 * `desktop/src/native/telaCompartilhada.ts`: resolução e taxa de quadros são
 * constraints de `getDisplayMedia`, fixadas no momento da chamada. Um seletor
 * que respondesse a um pedido em voo — que é como o upstream faz — só
 * conseguiria escolher a fonte, e as outras duas colunas do design ficariam
 * decorativas.
 *
 * ⚠ **Sem a aba "Abas" do design.** Capturar uma aba é conceito de navegador;
 * a casca enumera telas e janelas do sistema. Uma terceira aba vazia seria
 * pior que a ausência — é a mesma regra que manteve a etiqueta FÓRUM fora.
 */
export function SeletorDeTela({ aoFechar }: { aoFechar: () => void }) {
  const [fontes, setFontes] = useState<readonly FonteDeTela[] | "carregando">(
    "carregando",
  );
  const [aba, setAba] = useState<Aba>("tela");
  const [escolhida, setEscolhida] = useState<string | undefined>(undefined);
  const [audio, setAudio] = useState(false);
  const [resolucao, setResolucao] = useState<Resolucao>("1080p");
  const [taxa, setTaxa] = useState<Taxa>(30);

  useEffect(() => {
    let vivo = true;
    void ponteDeTela()
      ?.fontes()
      .then((f) => {
        if (!vivo) return;
        setFontes(f);
        /* A primeira TELA já vem escolhida: é o caso comum, e um painel que
           abre sem nada marcado obriga um clique a mais para a ação que
           quase todo mundo quer. */
        setEscolhida(f.find((x) => x.tipo === "tela")?.id ?? f[0]?.id);
      });
    return () => {
      vivo = false;
    };
  }, []);

  /*
    ⚠ Cancelar por `Esc`, pelo véu ou pelo botão passa TODO pelo mesmo lugar.
    O motor está esperando a promessa; um caminho de fechamento que não
    respondesse deixaria `alternarTela` pendurada para sempre, e o botão de
    compartilhar mudo pelo resto da sessão.
  */
  function cancelar(): void {
    void ponteDeTela()?.cancelar();
    responderEscolhaDeTela(undefined);
    aoFechar();
  }

  const lista = fontes === "carregando" ? [] : fontes;
  const daAba = lista.filter((f) => f.tipo === aba);
  const telas = lista.filter((f) => f.tipo === "tela").length;
  const janelas = lista.length - telas;

  return (
    <Dialog open onOpenChange={(v) => !v && cancelar()}>
      <DialogContent
        titulo="Compartilhar tela"
        descricao="Escolha o que as pessoas da sala vão ver."
        className={css.painel}
        rodape={
          <>
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
              Transmitir
            </Botao>
          </>
        }
      >
        <div
          className={css.abas}
          role="tablist"
          aria-label="Tipo de fonte"
        >
          {(["tela", "janela"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={aba === t}
              className={css.aba}
              onClick={() => setAba(t)}
            >
              {t === "tela" ? "Telas" : "Janelas"}
              <span className={css.contagem}>
                {t === "tela" ? telas : janelas}
              </span>
            </button>
          ))}
        </div>

        {fontes === "carregando" ? (
          <div className={css.vazio}>
            <EstadoVazio compacto titulo="Procurando telas e janelas…" />
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
          <div
            className={css.grade}
            role="radiogroup"
            aria-label="O que transmitir"
          >
            {daAba.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={escolhida === f.id}
                className={css.fonte}
                onClick={() => setEscolhida(f.id)}
              >
                {/* `alt=""`: o nome está no rótulo logo abaixo, e repeti-lo
                    faria o leitor de tela anunciar duas vezes. */}
                <img className={css.miniatura} src={f.miniatura} alt="" />
                <span className={css.rotulo}>
                  {f.icone !== undefined ? (
                    <img className={css.icone} src={f.icone} alt="" />
                  ) : null}
                  <span className={css.nome}>{f.nome}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        <div className={css.opcoes}>
          <div className={css.linha}>
            <span className={css.rotuloDaLinha}>Áudio</span>
            <Interruptor
              ligado={audio}
              rotulo="Compartilhar áudio da fonte"
              aoAlternar={setAudio}
            />
            <span className={css.dicaDeAudio}>
              {/*
                ⚠ A dica muda com a ABA, e não é enfeite: o áudio de loopback
                pega o som do SISTEMA, não o da janela escolhida. Quem
                compartilha uma janela achando que só o som dela vai junto
                transmite a chamada inteira de volta.
              */}
              {aba === "tela"
                ? "Envia o som do sistema junto com a imagem."
                : "O som capturado é o do sistema inteiro, não só o desta janela."}
            </span>
          </div>

          <div className={css.linha}>
            <span className={css.rotuloDaLinha}>Resolução</span>
            {/* O rótulo visível é a sobrancelha à esquerda; o `rotulo` aqui
                nomeia o grupo para quem ouve a tela. */}
            <Segmentado
              rotulo="Resolução"
              valor={resolucao}
              opcoes={RESOLUCOES.map((r) => ({ id: r, rotulo: r }))}
              aoEscolher={setResolucao}
            />
          </div>

          <div className={css.linha}>
            <span className={css.rotuloDaLinha}>Quadros</span>
            <Segmentado
              rotulo="Taxa de quadros"
              valor={String(taxa)}
              opcoes={TAXAS.map((t) => ({
                id: String(t),
                rotulo: String(t),
              }))}
              aoEscolher={(id) => setTaxa(Number(id) as Taxa)}
            />
            <span className={css.troca}>{trocaDe(resolucao, taxa)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
