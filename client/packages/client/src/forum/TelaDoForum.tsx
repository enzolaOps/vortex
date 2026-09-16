import { memo, useEffect, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { CampoDeBusca } from "../components/ui/CampoDeBusca";
import { MagnifyingGlass } from "../components/ui/icones";
import { cn } from "../lib/cn";
import { quando } from "../lib/quando";
import { pode } from "../sdk/permissoes";
import { carregarTopicos } from "../sdk/topicos";
import type { ForumSnapshot, TagDeForum, TopicoSnapshot } from "../sdk/domain";
import { administrar } from "../store/administracao";
import {
  useChannel,
  useForum,
  usePessoa,
  useTopico,
  useTopicosDoCanal,
} from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import { useAgoraPorMinuto } from "../store/relogio";
import { topicos } from "../sdk/topicos";
import { GradeVirtual } from "./GradeVirtual";
import { Pilulas } from "./Pilulas";
import { recortarForum, type OrdemDoForum } from "./recorte";
import css from "./TelaDoForum.module.css";

/**
 * O canal de fórum: um post por assunto, tags como filtro e metadado.
 *
 * O canal NÃO tem timeline — a conversa mora dentro de cada post, que é um
 * tópico (`sdk/topicos.ts`). Abrir um post é abrir o canal dele.
 *
 * O estado da barra (busca, tag, ordem, disposição) é de ESTA tela e some ao
 * sair: é recorte de leitura, não preferência — um filtro que sobrevivesse à
 * troca de canal esconderia posts da próxima vez sem ninguém lembrar por quê.
 */

type Ordem = OrdemDoForum;
type Disposicao = "lista" | "grade";

/** Card em lista: 14 + 72 (miniatura) + 14 + 10 de margem. */
const ALTURA_EM_LISTA = 122;
/** Card em grade: 132 de miniatura + ~130 de conteúdo. */
const ALTURA_EM_GRADE = 262;

export function TelaDoForum({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const forum = useForum(channelId);
  const ids = useTopicosDoCanal(channelId);

  const [busca, setBusca] = useState("");
  const [tag, setTag] = useState<string | undefined>();
  const [ordem, setOrdem] = useState<Ordem>("recentes");
  const [disposicao, setDisposicao] = useState<Disposicao>("lista");

  /*
    Contagens e aberturas vêm da listagem; sem rede, fica o que o `Ready`
    trouxe. DUAS chamadas, e a segunda não é opcional: o `Ready` e a listagem
    padrão só trazem os ativos, e o post fechado "nunca colapsa" — sem ela o
    fórum esconderia tudo o que já foi decidido.
  */
  useEffect(() => {
    if (!canal?.serverId) return;
    void carregarTopicos(canal.serverId, { canal: channelId });
    void carregarTopicos(canal.serverId, { canal: channelId, arquivados: true });
  }, [canal?.serverId, channelId]);

  /*
    Filtrar lendo o snapshot direto do store, e não por hook: o recorte
    precisa do título e das tags de TODOS os posts antes de saber quais
    renderizar. É a mesma leitura síncrona que o `estimateSize` da lista de
    mensagens faz — um `Map.get`, sem assinatura. A lista do canal ganha
    referência nova quando um post dela muda (`republicar`), então o recorte
    não envelhece quando alguém retaga ou fixa sem mudar a ordem.
  */
  const { ids: visiveis, fixados } = recortarForum(ids, (id) => topicos.getSnapshot(id), {
    busca,
    tag,
    ordem,
  });

  const podePostar = pode(channelId, "enviar");
  const grade = disposicao === "grade";

  return (
    <div className={css.tela}>
      <div className={css.barra}>
        {podePostar ? (
          <Botao
            variante="primario"
            className={css.novo}
            onClick={() => administrar({ tipo: "novoPost", forumId: channelId })}
          >
            Novo post
          </Botao>
        ) : null}

        <CampoDeBusca
          className={css.busca}
          placeholder="Buscar post"
          aria-label={`Buscar posts em ${canal?.name ?? "fórum"}`}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />

        {forum && forum.tags.length > 0 ? (
          <div className={css.tags} role="group" aria-label="Filtrar por tag">
            {forum.tags.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={tag === t.id}
                className={css.filtro}
                style={t.cor ? ({ "--cor-da-tag": t.cor } as React.CSSProperties) : undefined}
                onClick={() => setTag(tag === t.id ? undefined : t.id)}
              >
                {t.nome}
              </button>
            ))}
          </div>
        ) : null}

        <span className={css.espaco} />

        <Pilulas<Ordem>
          rotulo="Ordenação"
          valor={ordem}
          aoEscolher={setOrdem}
          opcoes={[
            { id: "recentes", rotulo: "Recentes" },
            { id: "ativos", rotulo: "Mais ativos" },
            { id: "novos", rotulo: "Novos" },
          ]}
        />

        <Pilulas<Disposicao>
          rotulo="Disposição"
          valor={disposicao}
          aoEscolher={setDisposicao}
          emCaixa
          opcoes={[
            { id: "lista", rotulo: "☰", nome: "Lista" },
            { id: "grade", rotulo: "▦", nome: "Grade" },
          ]}
        />
      </div>

      {visiveis.length === 0 ? (
        <div className={css.corpoVazio}>
          <div className={css.vazio}>
            <span className={css.vazioIcone} aria-hidden>
              <MagnifyingGlass />
            </span>
            <span className={css.vazioTitulo}>
              {ids.length === 0 ? "Nenhum post ainda" : "Nenhum post com esse filtro"}
            </span>
            <span className={css.vazioDetalhe}>
              {ids.length === 0
                ? "Crie o primeiro post do assunto."
                : "Limpe as tags ou crie o primeiro post do assunto."}
            </span>
            {ids.length > 0 ? (
              <Botao
                variante="neutro"
                tamanho="pequeno"
                className={css.vazioAcao}
                onClick={() => {
                  setTag(undefined);
                  setBusca("");
                }}
              >
                Limpar filtros
              </Botao>
            ) : null}
          </div>
        </div>
      ) : (
        <GradeVirtual
          key={disposicao}
          ids={visiveis}
          colunaMinima={grade ? 300 : undefined}
          gap={grade ? 14 : 10}
          estimarLinha={() => (grade ? ALTURA_EM_GRADE : ALTURA_EM_LISTA)}
          rotulo={`Posts de ${canal?.name ?? "fórum"}`}
          className={css.scroll}
          cabecalho={
            fixados > 0 ? (
              <div className={css.grupo}>Fixados</div>
            ) : undefined
          }
        >
          {(id) => (
            <CartaoDePost id={id} forum={forum} grade={grade} aoEscolherTag={setTag} />
          )}
        </GradeVirtual>
      )}
    </div>
  );
}

/**
 * Um post. Lista e grade são o MESMO card em dois modos, como o design diz —
 * miniatura 96×72 à esquerda na lista, topo de 132 na grade.
 */
const CartaoDePost = memo(function CartaoDePost({
  id,
  forum,
  grade,
  aoEscolherTag,
}: {
  id: string;
  forum: ForumSnapshot | null;
  grade: boolean;
  aoEscolherTag: (tag: string) => void;
}) {
  const t = useTopico(id);
  const canal = useChannel(id);
  const autor = usePessoa(t?.abertura?.autorId ?? t?.donoId ?? "");
  const agora = useAgoraPorMinuto();

  // Nunca `null`: linha que mede zero realimenta o virtualizador.
  if (!t) return <div className={cn(css.card, grade && css.cardEmGrade)} aria-hidden />;

  const tags = t.tags
    .map((tid) => forum?.tags.find((x) => x.id === tid))
    .filter((x): x is TagDeForum => x !== undefined);
  const naoLidas = canal?.naoLidas ?? 0;

  return (
    /*
      O card é um `article` com um BOTÃO de título que o abre, e não um botão
      inteiro: as tags dentro dele são alvos próprios (clicar filtra), e botão
      dentro de botão é HTML inválido. O clique no resto do card também abre —
      é o que o design faz —, delegado ao título.
    */
    <article
      className={cn(css.card, grade && css.cardEmGrade)}
      onClick={(e) => {
        if ((e.target as Element).closest("button")) return;
        selecionarCanal(id);
      }}
    >
      <Miniatura topico={t} grade={grade} />

      <div className={cn(css.conteudo, grade && css.conteudoEmGrade)}>
        {t.fixado || t.arquivado || tags.length > 0 ? (
          <div className={css.selos}>
            {t.fixado ? (
              // O glifo é o do design, como o 💬 do rodapé deste card.
              <span className={css.fixado}>📌 fixado</span>
            ) : null}
            {t.arquivado ? <span className={css.fechado}>fechado</span> : null}
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                className={css.tag}
                style={tag.cor ? ({ "--cor-da-tag": tag.cor } as React.CSSProperties) : undefined}
                onClick={() => aoEscolherTag(tag.id)}
              >
                {tag.nome}
              </button>
            ))}
          </div>
        ) : null}

        <h3 className={css.titulo}>
          <button type="button" className={css.abrir} onClick={() => selecionarCanal(id)}>
            {t.nome}
          </button>
        </h3>
        {t.abertura?.texto ? <p className={css.resumo}>{t.abertura.texto}</p> : null}

        <div className={css.rodape}>
          <span className={css.autor}>
            <Avatar id={t.abertura?.autorId ?? t.donoId} tamanho="xxs" className={css.avatar} />
            <span className={css.nomeDoAutor}>{autor?.displayName ?? ""}</span>
          </span>
          <span className={css.meta}>{quando(t.ultimaEm, agora, "detalhado")}</span>
          <span className={css.espaco} />
          <span className={css.numeros}>
            {t.respostas !== undefined ? <span>💬 {t.respostas}</span> : null}
            {t.abertura?.reacao ? (
              <span>
                {t.abertura.reacao.emoji} {t.abertura.reacao.total}
              </span>
            ) : null}
            {naoLidas > 0 ? <span className={css.novas}>{naoLidas} novas</span> : null}
          </span>
        </div>
      </div>
    </article>
  );
});

function Miniatura({ topico, grade }: { topico: TopicoSnapshot; grade: boolean }) {
  const m = topico.abertura?.midia;
  return (
    <div className={cn(css.miniatura, grade && css.miniaturaEmGrade)} aria-hidden>
      {m?.url && !m.spoiler ? (
        m.tipo === "video" ? (
          <video src={m.url} className={css.midia} preload="metadata" muted />
        ) : (
          <img src={m.url} alt="" className={css.midia} loading="lazy" />
        )
      ) : (
        <span className={css.semMidia}>{m ? (m.spoiler ? "spoiler" : m.nome) : "sem mídia"}</span>
      )}
    </div>
  );
}
