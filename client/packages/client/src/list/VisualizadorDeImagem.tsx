import {
  ArrowBendUpLeft,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  Minus,
  Plus,
  WarningCircle,
  X,
} from "../components/ui/icones";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Girador } from "../components/ui/Girador";
import { toast } from "../components/ui/toastStore";
import { NomeDoAutor } from "../presenca/NomeDoAutor";
import { baixarAnexo } from "../sdk/baixar";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { fecharModal } from "../store/modais";
import { useChannel, useMessage } from "../store/hooks";
import { responderA } from "../store/resposta";
import css from "./VisualizadorDeImagem.module.css";

/**
 * Os degraus de zoom.
 *
 * Lista fechada e não um multiplicador contínuo: com passo livre a pessoa
 * nunca volta ao 100% exato, e "voltar ao tamanho real" é o gesto mais comum
 * depois de ampliar. Aqui 100% é um degrau, então ele é alcançável sempre.
 */
const ZOOMS = [50, 75, 100, 150, 200, 300, 400] as const;
const CEM = ZOOMS.indexOf(100);

/**
 * O visualizador de mídia — o lightbox do design.
 *
 * ⚠ **Ele deixou de mostrar UMA imagem e passou a mostrar o ANEXO DE UMA
 * MENSAGEM.** A diferença é o que destrava metade do design: com o alvo sendo
 * a mensagem, o cabeçalho sabe quem mandou e em que canal, as setas sabem qual
 * é o próximo anexo, e a tira de miniaturas sabe quantos são. Com uma URL
 * solta, nada disso é derivável.
 *
 * As miniaturas só aparecem com mais de um anexo, como o design manda — uma
 * tira com um único quadrado não é navegação, é decoração que rouba altura da
 * imagem.
 */
export function VisualizadorDeImagem({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const img = alvo?.tipo === "verImagem" ? alvo : undefined;

  const message = useMessage(img?.messageId ?? "");
  const canal = useChannel(message?.channelId ?? "");

  /*
    Só imagem e vídeo entram na navegação.

    Um PDF no meio da tira faria a seta pular para um quadro que o lightbox não
    sabe desenhar — e o design desenha uma galeria de mídia, não de arquivos.
  */
  const midias = (message?.anexos ?? []).filter(
    (a) => a.tipo === "imagem" || a.tipo === "video",
  );

  const inicial = Math.max(
    0,
    midias.findIndex((a) => a.id === img?.anexoId),
  );
  const [i, setI] = useState(inicial);
  const [zoom, setZoom] = useState(CEM);

  const atual = midias[i] ?? midias[0];

  /*
    Setas do teclado navegam — é o que o design escreve por extenso.

    No `document` e não no painel: o Radix devolve o foco ao gatilho ao fechar,
    e enquanto aberto o foco pode estar em qualquer um dos alvos do cabeçalho.
    Um handler no painel perderia a tecla sempre que o foco não estivesse nele.
  */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setI((v) => Math.min(v + 1, midias.length - 1));
      else if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
      else return;
      e.preventDefault();
      /* Trocar de mídia volta ao tamanho real: o zoom de uma imagem não diz
         nada sobre a próxima, e herdá-lo abre a seguinte cortada. */
      setZoom(CEM);
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [midias.length]);

  if (!img || !atual) return null;

  const proporcao =
    atual.largura && atual.altura ? atual.largura / atual.altura : undefined;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo={atual.nome} tituloOculto className={css.painel}>
        {/* -------------------------------------------------- cabeçalho */}
        <div className={css.barraSuperior}>
          {message?.authorId ? (
            <>
              <Avatar id={message.authorId} tamanho="xs" />
              <div className={css.identidade}>
                <span className={css.autor}>
                  <NomeDoAutor userId={message.authorId} denso />
                </span>
                <span className={css.contexto}>
                  {canal ? `#${canal.name}` : ""}
                  {canal && message ? " · " : ""}
                  {/*
                    A hora CURTA — o design escreve "hoje 14:22".

                    `createdAtText` traz os segundos, e segundo numa legenda de
                    galeria não responde pergunta nenhuma: "01:44:14" rouba
                    três caracteres para dizer o mesmo que "01:44".
                  */}
                  {message?.createdAtCurto ?? ""}
                </span>
              </div>
            </>
          ) : (
            <div className={css.identidade}>
              <span className={css.autor}>{atual.nome}</span>
            </div>
          )}

          <div className={css.acoesDoTopo}>
            {/*
              Baixar é REAL: `fetch` → blob → `<a download>` desta origem. O
              `<a download>` direto para o `autumn` é de origem cruzada, e o
              navegador ignora o atributo — ver `sdk/baixar.ts`.
            */}
            <BotaoDeBaixar key={atual.id} url={atual.url} nome={atual.nome} />
            <button
              type="button"
              className={css.acaoDoTopo}
              aria-label="Abrir em nova aba"
              onClick={() =>
                window.open(atual.url, "_blank", "noopener,noreferrer")
              }
            >
              <ArrowSquareOut aria-hidden />
            </button>
            {message ? (
              <button
                type="button"
                className={css.acaoDoTopo}
                aria-label="Responder"
                onClick={() => {
                  responderA(message.channelId, message.id);
                  fecharModal();
                }}
              >
                <ArrowBendUpLeft aria-hidden />
              </button>
            ) : null}
            <button
              type="button"
              className={css.acaoDoTopo}
              aria-label="Fechar"
              onClick={aoFechar}
            >
              <X aria-hidden />
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------- a mídia */}
        <div className={css.palco}>
          <img
            className={css.imagem}
            src={atual.url}
            alt={atual.nome}
            /*
              `width`/`height` como ATRIBUTOS, não só CSS: é o que dá ao
              navegador a proporção antes do primeiro byte, e o que impede o
              palco de saltar quando a imagem chega.
            */
            width={atual.largura}
            height={atual.altura}
            style={{
              ...(proporcao !== undefined
                ? { aspectRatio: String(proporcao) }
                : {}),
              /*
                Zoom por `scale` e não por `width`: `transform` roda no
                compositor e não relayoutar o palco — a mesma regra de
                movimento que vale no resto do app.
              */
              scale: String((ZOOMS[zoom] ?? 100) / 100),
            }}
          />
        </div>

        {midias.length > 1 ? (
          <>
            <button
              type="button"
              className={css.seta}
              data-lado="inicio"
              aria-label="Anterior"
              disabled={i === 0}
              onClick={() => {
                setI(i - 1);
                setZoom(CEM);
              }}
            >
              <CaretLeft aria-hidden />
            </button>
            <button
              type="button"
              className={css.seta}
              data-lado="fim"
              aria-label="Próxima"
              disabled={i === midias.length - 1}
              onClick={() => {
                setI(i + 1);
                setZoom(CEM);
              }}
            >
              <CaretRight aria-hidden />
            </button>
          </>
        ) : null}

        {/* ----------------------------------------------------- rodapé */}
        <div className={css.barraInferior}>
          {/* Miniaturas só com mais de um anexo — ver o comentário acima. */}
          {midias.length > 1 ? (
            <div className={css.miniaturas}>
              {midias.map((m, j) => (
                <button
                  key={m.id}
                  type="button"
                  className={css.miniatura}
                  data-atual={j === i || undefined}
                  aria-label={`Ver ${m.nome}`}
                  aria-current={j === i}
                  onClick={() => {
                    setI(j);
                    setZoom(CEM);
                  }}
                />
              ))}
            </div>
          ) : null}

          <span className={css.legenda}>
            {midias.length > 1 ? `${i + 1} de ${midias.length} · ` : ""}
            {atual.tamanhoTexto ? `${atual.tamanhoTexto} · ` : ""}
            {/*
              "alt ausente" é informação, não erro.

              ⚠ **O protocolo NÃO tem descrição de anexo**, e este comentário
              dizia que tinha. Conferido na fonte: `File` em
              `crates/core/models/src/v0/files.rs` não tem campo de descrição,
              e `DataMessageSend.attachments` leva só IDs — não há onde
              escrever nem de onde ler (pendência `textoAlternativo`). Dizer
              isso aqui é o que faz alguém reparar: um rodapé calado sobre
              acessibilidade é como ninguém descobre que ela falta.
            */}
            alt ausente
          </span>

          <div className={css.zoom}>
            <button
              type="button"
              className={css.acaoDoTopo}
              aria-label="Diminuir"
              disabled={zoom === 0}
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
            >
              <Minus aria-hidden />
            </button>
            <span className={css.zoomValor}>{ZOOMS[zoom]}%</span>
            <button
              type="button"
              className={css.acaoDoTopo}
              aria-label="Aumentar"
              disabled={zoom === ZOOMS.length - 1}
              onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
            >
              <Plus aria-hidden />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * O botão de baixar, com os três estados que um download tem.
 *
 * ⚠ **`key` pelo anexo no chamador, e é o que zera o estado ao trocar de
 * mídia.** Sem ela, uma falha na imagem 2 continuaria pintada de erro ao
 * passar para a 3 — e zerar num efeito é o `setState` em cascata que o lint
 * do projeto reprova.
 *
 * O erro fica no botão E vai ao toast: o toast diz o PORQUÊ ("o arquivo não
 * existe mais"), o botão diz ONDE, e o rótulo passa a "Tentar baixar de novo"
 * — um botão vermelho que continua dizendo "Baixar" não conta que o primeiro
 * clique falhou.
 */
function BotaoDeBaixar({ url, nome }: { url: string; nome: string }) {
  const [estado, setEstado] = useState<"parado" | "baixando" | "erro">("parado");

  function baixar() {
    setEstado("baixando");
    baixarAnexo(url, nome).then(
      () => setEstado("parado"),
      (e: unknown) => {
        setEstado("erro");
        toast({
          tipo: "erro",
          titulo: "Não deu para baixar o arquivo.",
          descricao: e instanceof Error ? e.message : "Tente de novo.",
        });
      },
    );
  }

  return (
    <button
      type="button"
      className={css.acaoDoTopo}
      data-estado={estado}
      aria-label={estado === "erro" ? "Tentar baixar de novo" : "Baixar"}
      aria-busy={estado === "baixando" || undefined}
      disabled={estado === "baixando"}
      onClick={baixar}
    >
      {estado === "baixando" ? (
        <Girador tamanho={12} rotulo="Baixando" />
      ) : estado === "erro" ? (
        <WarningCircle aria-hidden />
      ) : (
        <DownloadSimple aria-hidden />
      )}
    </button>
  );
}
