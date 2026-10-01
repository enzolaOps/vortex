import { memo, useEffect, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import { cn } from "../lib/cn";
import { pessoas } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import { carregarTopicos, topicos } from "../sdk/topicos";
import { administrar } from "../store/administracao";
import {
  assinarGaleria,
  definirDensidadeDaGaleria,
  lerDensidadeDaGaleria,
  type DensidadeDaGaleria,
} from "../store/galeria";
import { useChannel, usePessoa, useTopico, useTopicosDoCanal } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import { useAgoraPorMinuto } from "../store/relogio";
import {
  duracaoConhecida,
  lembrarDuracao,
  recortarGaleria,
  seloDaMidia,
  totalDaGaleria,
  type FiltroDaGaleria,
} from "./galeria";
import { GradeVirtual } from "./GradeVirtual";
import { Pilulas } from "./Pilulas";
import css from "./GaleriaDeMidia.module.css";

/**
 * O canal de mídia: cada item é um post cuja primeira mensagem é a mídia.
 *
 * ⚠ **Grade de proporção FIXA 4:3 com `object-fit: cover`, e não masonry** —
 * é instrução do design: "a varredura por data exige linhas alinhadas". No
 * modo denso a legenda sai do card e vira overlay no hover; a contagem de
 * respostas fica, porque cada item é um tópico.
 */

export function GaleriaDeMidia({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const ids = useTopicosDoCanal(channelId);
  const densidade = useSyncExternalStore(assinarGaleria, lerDensidadeDaGaleria);
  const [filtro, setFiltro] = useState<FiltroDaGaleria>("tudo");
  const agora = useAgoraPorMinuto();
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!canal?.serverId) return;
    /*
      Os ARQUIVADOS também, como no fórum: o `Ready` e a listagem padrão só
      trazem ativos, e arquivar fecha a CONVERSA de um item — não tira a mídia
      do acervo. Sem esta chamada o item sumiria da grade no F5, e ficaria nela
      enquanto a sessão durasse: a mesma galeria com dois tamanhos.
    */
    void carregarTopicos(canal.serverId, { canal: channelId });
    void carregarTopicos(canal.serverId, { canal: channelId, arquivados: true });
  }, [canal?.serverId, channelId]);

  const denso = densidade === "denso";
  // Leitura síncrona dos snapshots, como no fórum — o recorte precisa de todos.
  const ler = (id: string) => topicos.getSnapshot(id);
  const { grupos, visiveis } = recortarGaleria(
    ids,
    ler,
    (id) => pessoas.getSnapshot(id)?.displayName,
    { filtro, busca, agora },
  );

  const podeEnviar = pode(channelId, "enviar");
  const soltar = (arquivo: File | undefined) =>
    administrar({ tipo: "enviarMidia", forumId: channelId, arquivo });

  const faixaDeSoltar = podeEnviar ? (
    <button
      type="button"
      className={css.soltar}
      onClick={() => soltar(undefined)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        soltar(e.dataTransfer.files[0]);
      }}
    >
      Arraste arquivos aqui para publicar · legenda obrigatória, alt recomendado
    </button>
  ) : null;

  return (
    <div className={css.tela}>
      <div className={css.barra}>
        <CampoDeBusca
          className={css.busca}
          placeholder="Buscar por legenda ou autor"
          aria-label={`Buscar em ${canal?.name ?? "galeria"}`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Pilulas<FiltroDaGaleria>
          rotulo="Tipo de mídia"
          valor={filtro}
          aoEscolher={setFiltro}
          redonda
          opcoes={[
            { id: "tudo", rotulo: "Tudo" },
            { id: "imagens", rotulo: "Imagens" },
            { id: "videos", rotulo: "Vídeos" },
            { id: "gifs", rotulo: "GIFs" },
          ]}
        />
        <span className={css.espaco} />
        <span className={css.total}>{totalDaGaleria(ids, ler)}</span>
      </div>

      {visiveis === 0 ? (
        <div className={css.corpoVazio}>
          <p className={css.vazio}>
            {ids.length === 0 ? "Nada publicado ainda." : "Nenhum item com esse filtro."}
          </p>
          {faixaDeSoltar}
        </div>
      ) : (
        <GradeVirtual
          key={densidade}
          grupos={grupos}
          rotuloDeGrupo={(rotulo) => <div className={css.grupo}>{rotulo}</div>}
          colunaMinima={denso ? 150 : 230}
          gap={denso ? 6 : 12}
          // 4:3 da largura, mais a legenda de 52px no confortável.
          estimarLinha={(w) => Math.round((w * 3) / 4) + (denso ? 2 : 54)}
          rotulo={`Itens de ${canal?.name ?? "galeria"}`}
          className={css.scroll}
          rodape={faixaDeSoltar}
        >
          {(id) => <Item id={id} denso={denso} />}
        </GradeVirtual>
      )}
    </div>
  );
}

const Item = memo(function Item({ id, denso }: { id: string; denso: boolean }) {
  const t = useTopico(id);
  const autor = usePessoa(t?.abertura?.autorId ?? t?.donoId ?? "");
  // Estado de UI desta célula: revelar um spoiler é gesto de quem olha, e some ao rolar.
  const [revelado, setRevelado] = useState(false);
  /*
    A duração do vídeo, lida do próprio arquivo pelo `<video>` que já desenha
    o quadro. Parte do que a sessão já mediu, para a célula que remonta ao
    rolar não voltar a "VÍDEO" e piscar.
  */
  const url = t?.abertura?.midia?.url;
  const [duracao, setDuracao] = useState(() => duracaoConhecida(url));

  if (!t) return <div className={css.card} aria-hidden />;

  const m = t.abertura?.midia;
  const escondido = m?.spoiler === true && !revelado;
  const selo = seloDaMidia(m?.tipo, duracao);
  const respostas = t.respostas ?? 0;

  return (
    <article className={cn(css.card, denso && css.cardDenso)}>
      <button
        type="button"
        className={css.abrir}
        aria-label={`Abrir ${t.nome}`}
        onClick={() => selecionarCanal(id)}
      >
        <span className={css.quadro}>
          {m?.url && !escondido ? (
            m.tipo === "video" ? (
              <video
                src={m.url}
                className={css.midia}
                preload="metadata"
                muted
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (m.url) lembrarDuracao(m.url, d);
                  if (Number.isFinite(d) && d > 0) setDuracao(d);
                }}
              />
            ) : (
              <img src={m.url} alt="" className={css.midia} loading="lazy" />
            )
          ) : (
            <span className={css.rotuloDoQuadro}>{m ? m.nome : "sem mídia"}</span>
          )}
          {selo ? <span className={css.selo}>{selo}</span> : null}
          {denso ? (
            <span className={css.sobreposicao} aria-hidden>
              <span className={css.legendaDensa}>{t.nome}</span>
              <span className={css.respostasDensas}>💬 {respostas}</span>
            </span>
          ) : null}
        </span>
      </button>

      {/* Irmão do botão de abrir, e não filho: botão dentro de botão é HTML inválido. */}
      {escondido ? (
        <button type="button" className={css.spoiler} onClick={() => setRevelado(true)}>
          clique para revelar
        </button>
      ) : null}

      {!denso ? (
        <div className={css.pe}>
          <div className={css.textos}>
            <div className={css.legenda}>{t.nome}</div>
            <div className={css.autor}>{autor?.displayName ?? ""}</div>
          </div>
          <span className={css.respostas}>💬 {respostas}</span>
        </div>
      ) : null}
    </article>
  );
});

/** O cabeçalho da galeria: densidade e "Enviar mídia", como o design. */
export function AcoesDaGaleria({ channelId }: { channelId: string }) {
  const densidade = useSyncExternalStore(assinarGaleria, lerDensidadeDaGaleria);
  return (
    <div className={css.acoesDoCabecalho}>
      <Pilulas<DensidadeDaGaleria>
        rotulo="Densidade"
        valor={densidade}
        aoEscolher={definirDensidadeDaGaleria}
        opcoes={[
          { id: "confortavel", rotulo: "Confortável" },
          { id: "denso", rotulo: "Denso" },
        ]}
      />
      {pode(channelId, "enviar") ? (
        <Botao
          variante="primario"
          tamanho="pequeno"
          className={css.enviar}
          onClick={() => administrar({ tipo: "enviarMidia", forumId: channelId })}
        >
          Enviar mídia
        </Botao>
      ) : null}
    </div>
  );
}
