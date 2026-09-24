import {
  BellSimpleSlash,
  ICONE,
  Note,
  Plus,
  PushPin,
  Tray,
  Users,
  X,
} from "../components/ui/icones";
import { memo, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { GatilhoDeBusca } from "../components/ui/CampoDeBusca";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import {
  useCanalAtivo,
  useChannel,
  useConversas,
  useMessage,
  usePessoa,
  useRelacao,
  useTotaisNaoLidos,
} from "../store/hooks";
import { abrirConversa, irParaAmigos } from "../store/navegacao";
import { useLocal } from "../store/hooks";
import { Selo } from "../components/ui/Selo";
import css from "./ListaDeConversas.module.css";
import { MenuDeContexto } from "../components/ui/MenuDeContexto";
import { ItensDaConversa } from "../menus/ItensDaConversa";
import { Tooltip } from "../components/ui/Tooltip";
import { administrar } from "../store/administracao";
import { assinarFavoritos, lerFavoritos } from "../store/favoritos";
import { abrirPaletaCom } from "../store/paleta";
import { prefixoDe } from "../paleta/indice";
import { assinarLayout, painelVisivel } from "../store/layout";
import {
  alternarSuperficie,
  assinarDrawer,
  superficieAberta,
} from "../store/drawer";
import { sairDaConversa } from "../sdk/social";
import { usuarioLocalId } from "../sdk/adapter";
import { detalheDaConversa } from "./detalheDaConversa";

/**
 * A coluna da casa: conversas diretas, grupos e as notas.
 *
 * ⚠ **Não é um `PainelId` novo, e a decisão é do plano de paridade.** No
 * Discord a segunda coluna é canais-ou-conversas conforme o rail; painel
 * separado obrigaria a pessoa a trocar painel na mão ao ir para a casa. O
 * painel `canais` lê a navegação e escolhe a fonte — custo zero em slots, e o
 * shell tem só três.
 *
 * Uma lista só, misturada e ordenada por recência, e não três seções por tipo:
 * é como uma caixa de entrada funciona. Separar faria a conversa de ontem
 * ficar abaixo de um grupo morto só porque grupo é outro tipo. A única
 * partição é a que a PESSOA fez: as fixadas sobem para uma seção própria.
 */


/** Uma linha da coluna. Assina a própria conversa — lei nº 1. */
const Conversa = memo(function Conversa({
  id,
  ativa,
  fixada,
}: {
  id: string;
  ativa: boolean;
  fixada: boolean;
}) {
  const canal = useChannel(id);
  /*
    O destinatário é assinado AQUI, e só quando é DM.

    Grupo e notas não têm outro lado; pedir a pessoa nesses casos criaria uma
    subscrição por linha para um valor que nunca chega. `usePessoa("")` devolve
    `undefined` sem custo — o store não acha entidade de chave vazia.
  */
  const outro = usePessoa(canal?.destinatarioId ?? "");
  const ultima = useMessage(canal?.ultimaMensagemId ?? "");
  /*
    O autor da última mensagem, e só no GRUPO — é o único tipo em que "quem
    disse" não é óbvio: numa DM só há o outro lado, e nas notas só você. A
    mesma chave vazia de cima quando não se aplica.
  */
  const eu = usuarioLocalId();
  const autorId =
    canal?.tipo === "grupo" && ultima?.authorId !== eu
      ? (ultima?.authorId ?? "")
      : "";
  const autor = usePessoa(autorId);

  if (!canal) return null;

  const temNaoLidas = canal.naoLidas > 0 && !canal.silenciado;
  const nome =
    canal.tipo === "notas"
      ? "Suas notas"
      : canal.tipo === "dm"
        ? (outro?.displayName ?? canal.name)
        : canal.name;

  const detalhe = detalheDaConversa({
    tipo: canal.tipo === "grupo" ? "grupo" : canal.tipo === "notas" ? "notas" : "dm",
    participantes: canal.participantes,
    ultima: ultima
      ? { conteudo: ultima.content, minha: ultima.authorId === eu }
      : undefined,
    autor: autor?.displayName,
  });

  const linha = (
    <button
      type="button"
      className={css.conversa}
      aria-current={ativa}
      data-naolidas={temNaoLidas}
      onClick={() => abrirConversa(id)}
    >
      {canal.tipo === "dm" ? (
        <Avatar
          id={outro?.id ?? ""}
          sigla={outro?.sigla}
          url={outro?.avatarUrl}
          tamanho="sm"
        >
          {canal.destinatarioId ? (
            <PontoDePresenca
              userId={canal.destinatarioId}
              className={css.ponto}
            />
          ) : null}
        </Avatar>
      ) : (
        <span className={css.marca} aria-hidden>
          {canal.tipo === "grupo" && canal.iconeUrl !== undefined ? (
            <img className={css.imagemDoGrupo} src={canal.iconeUrl} alt="" />
          ) : canal.tipo === "grupo" ? (
            /* A contagem de gente, como no design — é o que distingue um
               grupo sem ícone, e deixou o detalhe livre para a última
               mensagem. */
            contagem(canal.participantes)
          ) : (
            <Note size={ICONE.calha} />
          )}
        </span>
      )}

      <span className={css.texto}>
        <span className={css.nome}>{nome}</span>
        {detalhe ? <span className={css.detalhe}>{detalhe}</span> : null}
      </span>
      {ultima?.createdAtCurto ? (
        <span className={css.hora}>{ultima.createdAtCurto}</span>
      ) : null}

      {/* A contagem visível é de MENÇÃO; não-lida sem menção é peso, não
          número — a mesma regra da lista de canais. */}
      {canal.mencoes > 0 ? (
        <Selo forma="contagem" tom="perigo">{contagem(canal.mencoes)}</Selo>
      ) : null}

      {/* Silenciada mantém a contagem e perde o realce — e diz POR QUÊ, senão
          a linha apagada lê como conversa sem nada. */}
      {canal.silenciado ? (
        <span className={css.marcador}>
          <BellSimpleSlash size={ICONE.selo} aria-hidden />
          <span className="sr-only">silenciada</span>
        </span>
      ) : null}

      {fixada ? (
        <span className={css.marcador}>
          <PushPin size={ICONE.selo} aria-hidden />
          <span className="sr-only">fixada</span>
        </span>
      ) : null}

      {temNaoLidas ? (
        <span className="sr-only">
          {rotuloDeNaoLidas(canal.naoLidas, canal.mencoes)}
        </span>
      ) : null}
    </button>
  );

  /*
    Notas não tem menu: é a sua própria gaveta, e não há relação para gerir nem
    de onde sair. Um menu de um item só é o que a versão anterior evitava.
  */
  if (canal.tipo === "notas") return linha;

  /*
    O wrapper existe pelo ✕: ação dentro do botão da linha seria botão dentro
    de botão (HTML inválido — o clique acionaria os dois), e o
    `ContextMenuTrigger asChild` aceita UM filho. É o arranjo de
    `.linhaDeCanal` na coluna de canais, pela mesma razão.
  */
  return (
    <div className={css.linha}>
      <MenuDeContexto gatilho={linha}>
        <ItensDaConversa channelId={id} />
      </MenuDeContexto>
      {/*
        ✕ só na DM, como no design. Fechar a DM a tira da coluna e nada se
        perde — ela volta com a próxima mensagem. Sair de um GRUPO é outra
        coisa (você deixa de receber), e fica no menu, marcado como perigo,
        onde não se aciona passando o ponteiro.
      */}
      {canal.tipo === "dm" ? (
        <button
          type="button"
          className={css.fechar}
          aria-label={`Fechar conversa com ${nome}`}
          onClick={() => void sairDaConversa(id)}
        >
          <X size={ICONE.selo} aria-hidden />
        </button>
      ) : null}
    </div>
  );
});

/**
 * A caixa de entrada como item da coluna — a MESMA superfície do botão do
 * cabeçalho de canal, pelo mesmo `alternarSuperficie`.
 *
 * Duas subscrições pela razão de `BotaoDePainel`: ancorada ela responde ao
 * layout, flutuando responde ao drawer, e `superficieAberta` junta as duas.
 */
function ItemDaCaixa() {
  const noSlot = useSyncExternalStore(assinarLayout, () =>
    painelVisivel("caixaDeEntrada"),
  );
  const aberta = useSyncExternalStore(assinarDrawer, () =>
    superficieAberta("caixaDeEntrada", noSlot),
  );
  const { naoLidas } = useTotaisNaoLidos();

  return (
    <button
      type="button"
      className={css.item}
      aria-pressed={aberta}
      onClick={() => alternarSuperficie("caixaDeEntrada")}
    >
      <Tray size={ICONE.selo} aria-hidden />
      <span className={css.nome}>Caixa de entrada</span>
      {/* Número NEUTRO, como no design: não-lida é inventário, não chamado —
          o vermelho fica para quem pede resposta (os pedidos, logo acima). */}
      {naoLidas > 0 ? (
        <span className={css.contagem}>
          {contagem(naoLidas)}
          <span className="sr-only"> não lidas</span>
        </span>
      ) : null}
    </button>
  );
}

export function ListaDeConversas() {
  const ids = useConversas();
  const ativo = useCanalAtivo();
  const local = useLocal();
  const favoritos = useSyncExternalStore(assinarFavoritos, lerFavoritos);
  /* Pedidos RECEBIDOS: são os que pedem uma ação sua. Os enviados esperam
     pelo outro lado e não são chamado. */
  const pedidos = useRelacao("recebido").length;

  /*
    Fixadas numa seção própria, como no design. A ordem continua a do adapter
    (`ordenarComFavoritas` já as põe por cima); aqui só se parte a lista.
  */
  const fixadas = ids.filter((id) => favoritos.includes(id));
  const resto = ids.filter((id) => !favoritos.includes(id));

  return (
    <div className={css.painel}>
      {/*
        "Encontrar ou iniciar conversa": a PALETA, já em pessoas.

        É `button` e não `input` pela razão da busca da coluna de canais —
        digitar aqui seria um segundo campo com o mesmo texto da paleta. O `@`
        entra escrito no campo dela, e na casa o índice traz quem você tem em
        conversa e seus amigos; escolher alguém abre a conversa, nova ou não.
      */}
      <div className={css.faixaDeBusca}>
        <GatilhoDeBusca
          denso
          rotulo="Encontrar ou iniciar conversa"
          className={css.busca}
          onClick={() => abrirPaletaCom(prefixoDe("pessoa"))}
        />
      </div>

      {/*
        Amigos é uma LINHA da coluna, não um painel.

        Ele não tem conversa nem histórico — é uma lista de gente, e gastar um
        dos três slots do shell com ela seria caro para o que ela é. Como linha,
        ela fica onde a pessoa já está procurando quem falar.
      */}
      <nav className={css.fixos} aria-label="Casa">
        <button
          type="button"
          className={css.item}
          aria-current={local.tipo === "amigos"}
          onClick={() => irParaAmigos()}
        >
          <Users size={ICONE.selo} aria-hidden />
          <span className={css.nome}>Amigos</span>
          {pedidos > 0 ? (
            <Selo forma="contagem" tom="perigo">
              {contagem(pedidos)}
              <span className="sr-only">
                {pedidos === 1 ? " pedido de amizade" : " pedidos de amizade"}
              </span>
            </Selo>
          ) : null}
        </button>
        <ItemDaCaixa />
      </nav>

      {/* Ver `MessageList`: rolável sem foco é inoperável por teclado. */}
      <div className={css.rolagem} tabIndex={0}>
        {fixadas.length > 0 ? (
          <>
            <div className={css.secao}>
              <span className={css.tituloDaSecao}>Fixadas</span>
            </div>
            <nav aria-label="Conversas fixadas">
              {fixadas.map((id) => (
                <Conversa key={id} id={id} ativa={id === ativo} fixada />
              ))}
            </nav>
          </>
        ) : null}

        <div className={css.secao}>
          <span className={css.tituloDaSecao}>Mensagens diretas</span>
          {/*
            ⚠ **O `+` de criar grupo, e ele fecha um buraco de três etapas.**
            `createGroup` existia no adapter desde a etapa 3 e nunca tinha sido
            chamado — a família "construído e inalcançável" que o painel de
            fixadas já registrou. O lugar é o cabeçalho da seção, como no
            design: quem quer um grupo está olhando as mensagens diretas.
          */}
          <Tooltip texto="Novo grupo">
            <button
              type="button"
              className={css.novoGrupo}
              aria-label="Novo grupo"
              onClick={() => administrar({ tipo: "novoGrupo" })}
            >
              <Plus size={ICONE.selo} aria-hidden />
            </button>
          </Tooltip>
        </div>

        {ids.length === 0 ? (
          <EstadoVazio
            compacto
            titulo="Nenhuma conversa ainda"
            detalhe="Abra o perfil de alguém e mande a primeira mensagem."
            acao={{ rotulo: "Ver amigos", aoClicar: irParaAmigos }}
          />
        ) : (
          <nav aria-label="Mensagens diretas">
            {resto.map((id) => (
              <Conversa key={id} id={id} ativa={id === ativo} fixada={false} />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
