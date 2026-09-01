import { Gear, Note, Plus, Users } from "../components/ui/icones";
import { memo } from "react";

import { EstadoVazio } from "../components/ui/EstadoVazio";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import {
  useCanalAtivo,
  useChannel,
  useConversas,
  usePessoa,
} from "../store/hooks";
import { abrirConversa, irParaAmigos } from "../store/navegacao";
import { useLocal } from "../store/hooks";
import { Selo } from "../components/ui/Selo";
import css from "./ListaDeConversas.module.css";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { ItemDeId } from "../components/ui/ItemDeId";
import { Tooltip } from "../components/ui/Tooltip";
import { administrar } from "../store/administracao";

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
 * ficar abaixo de um grupo morto só porque grupo é outro tipo.
 */

/** Uma linha da coluna. Assina a própria conversa — lei nº 1. */
const Conversa = memo(function Conversa({
  id,
  ativa,
}: {
  id: string;
  ativa: boolean;
}) {
  const canal = useChannel(id);
  /*
    O destinatário é assinado AQUI, e só quando é DM.

    Grupo e notas não têm outro lado; pedir a pessoa nesses casos criaria uma
    subscrição por linha para um valor que nunca chega. `usePessoa("")` devolve
    `undefined` sem custo — o store não acha entidade de chave vazia.
  */
  const outro = usePessoa(canal?.destinatarioId ?? "");

  if (!canal) return null;

  const temNaoLidas = canal.naoLidas > 0 && !canal.silenciado;
  const nome =
    canal.tipo === "notas"
      ? "Suas notas"
      : canal.tipo === "dm"
        ? (outro?.displayName ?? canal.name)
        : canal.name;

  const linha = (
    <button
      type="button"
      className={css.conversa}
      aria-current={ativa}
      data-naolidas={temNaoLidas}
      onClick={() => abrirConversa(id)}
    >
      <span className={css.marca} aria-hidden>
        {/*
          A imagem do grupo quando existe, o glifo quando não.

          ⚠ O glifo NÃO foi substituído: ele é a marca de "isto é um grupo"
          para a esmagadora maioria, que nunca subiu imagem. Trocá-lo por um
          gradiente com sigla apagaria a distinção entre grupo e DM, que é a
          única informação que esta coluna dá de relance.
        */}
        {canal.tipo === "grupo" && canal.iconeUrl !== undefined ? (
          <img className={css.imagemDoGrupo} src={canal.iconeUrl} alt="" />
        ) : canal.tipo === "grupo" ? (
          <Users size={20} />
        ) : canal.tipo === "notas" ? (
          <Note size={20} />
        ) : (
          (outro?.sigla ?? "?")
        )}
        {/*
          Presença só na DM: um grupo não tem um estado, tem vários, e
          escolher um deles seria inventar informação. O ponto carrega forma
          além de cor — presença nunca é comunicada só por matiz.
        */}
        {canal.tipo === "dm" && canal.destinatarioId ? (
          <PontoDePresenca
            userId={canal.destinatarioId}
            className={css.ponto}
          />
        ) : null}
      </span>

      <span className={css.texto}>
        <span className={css.nome}>{nome}</span>
        {canal.tipo === "grupo" ? (
          <span className={css.detalhe}>
            {contagem(canal.participantes)} pessoas
          </span>
        ) : null}
      </span>

      {/* A contagem visível é de MENÇÃO; não-lida sem menção é peso, não
          número — a mesma regra da lista de canais. */}
      {canal.mencoes > 0 ? (
        <Selo forma="contagem" tom="perigo">{contagem(canal.mencoes)}</Selo>
      ) : null}

      {temNaoLidas ? (
        <span className="sr-only">
          {rotuloDeNaoLidas(canal.naoLidas, canal.mencoes)}
        </span>
      ) : null}
    </button>
  );

  /*
    ⚠ **O menu só existe para GRUPO, e a condição não é economia — é o que
    impede um menu de um item só.** Numa DM as ações do design (fechar,
    silenciar, favoritar) ainda não existem; montar `ContextMenu.Root` em cada
    linha para abrir uma caixa vazia é o mesmo custo que a member list já
    evitou, com o agravante de a caixa não ter conteúdo.
  */
  if (canal.tipo !== "grupo") return linha;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{linha}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={() => administrar({ tipo: "grupo", channelId: id })}
        >
          <Gear size={20} aria-hidden />
          Gerenciar grupo
        </ContextMenuItem>
        <ItemDeId id={id} />
      </ContextMenuContent>
    </ContextMenu>
  );
});

export function ListaDeConversas() {
  const ids = useConversas();
  const ativo = useCanalAtivo();
  const local = useLocal();

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        <span className={css.tituloDaColuna}>Conversas</span>
        {/*
          ⚠ **O `+` de criar grupo, e ele fecha um buraco de três etapas.**
          `createGroup` existia no adapter desde a etapa 3 e nunca tinha sido
          chamado — a família "construído e inalcançável" que o painel de
          fixadas já registrou. O lugar é este: quem quer um grupo está
          olhando a lista de conversas, não o menu de um servidor.
        */}
        <Tooltip texto="Novo grupo">
          <button
            type="button"
            className={css.novoGrupo}
            aria-label="Novo grupo"
            onClick={() => administrar({ tipo: "novoGrupo" })}
          >
            <Plus size={16} aria-hidden />
          </button>
        </Tooltip>
      </header>

      {/*
        Amigos é uma LINHA da coluna, não um painel.

        Ele não tem conversa nem histórico — é uma lista de gente, e gastar um
        dos três slots do shell com ela seria caro para o que ela é. Como linha,
        ela fica onde a pessoa já está procurando quem falar.
      */}
      <button
        type="button"
        className={css.amigos}
        aria-current={local.tipo === "amigos"}
        onClick={() => irParaAmigos()}
      >
        <span className={css.marca} aria-hidden>
          <Users size={20} />
        </span>
        <span className={css.nome}>Amigos</span>
      </button>

      {/* Ver `MessageList`: rolável sem foco é inoperável por teclado. */}
      <div className={css.rolagem} tabIndex={0}>
        {ids.length === 0 ? (
          <EstadoVazio
            compacto
            titulo="Nenhuma conversa ainda"
            detalhe="Abra o perfil de alguém e mande a primeira mensagem."
            acao={{ rotulo: "Ver amigos", aoClicar: irParaAmigos }}
          />
        ) : (
          <nav aria-label="Conversas">
            {ids.map((id) => (
              <Conversa key={id} id={id} ativa={id === ativo} />
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}
