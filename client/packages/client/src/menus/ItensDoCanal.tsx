import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import {
  BellSimple,
  Check,
  Copy,
  GearSix,
  Hash,
  ICONE,
  Link,
  LinkSimple,
  PencilSimple,
  SpeakerHigh,
  Trash,
} from "../components/ui/icones";
import { ItemDeId } from "../components/ui/ItemDeId";
import { copiarTexto } from "../lib/copiar";
import { atalho } from "../lib/plataforma";
import { menuAtalho } from "../components/ui/menu";
import { entrarNaChamada } from "../sdk/chamada";
import { marcarCanalLido } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import { duplicarCanal } from "../sdk/servidores";
import { administrar } from "../store/administracao";
import { abrirConfigDeCanal } from "../store/config";
import { useChannel } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import { SubmenuDeSilenciar } from "./SubmenuDeSilenciar";

/**
 * O menu do CANAL — o mesmo na coluna e no `⋯` do cabeçalho.
 *
 * ⚠ **O cabeçalho do canal não tinha menu nenhum**, e o design desenha um `⋯`
 * ali. Quem estava com o canal aberto e queria convidar, silenciar ou editar
 * precisava voltar à coluna e mirar a linha — ou seja, o lugar onde a pessoa
 * está era o único sem as ações do lugar onde ela está.
 *
 * Extraído de `canais/ListaDeCanais.tsx` inteiro: o conteúdo é o mesmo, e a
 * única diferença entre as duas superfícies é o gatilho.
 */
export function ItensDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  if (!canal) return null;

  const temNaoLidas = canal.naoLidas > 0;
  const deVoz = canal.tipo === "voz";

  return (
    <ContextMenuContent>
      {/* Regra do briefing: ação que a pessoa não pode executar não é
          renderizada. Ver `sdk/permissoes.ts`. */}
      <ContextMenuItem
        onSelect={() => marcarCanalLido(channelId)}
        disabled={!temNaoLidas || !pode(channelId, "marcarLida")}
      >
        <Check size={ICONE.calha} aria-hidden />
        Marcar como lida
      </ContextMenuItem>

      {/*
        Silenciar é preferência de LEITURA, não permissão: qualquer pessoa pode
        silenciar qualquer canal que enxerga. A forma é a mesma do servidor, da
        DM e do tópico desde que `SubmenuDeSilenciar` existe.
      */}
      <SubmenuDeSilenciar
        alvo={{ tipo: "canal", id: channelId }}
        rotulo="Silenciar canal"
      />
      <ContextMenuItem
        onSelect={() =>
          administrar({ tipo: "notificacoesDoCanal", channelId })
        }
      >
        <BellSimple size={ICONE.calha} aria-hidden />
        Notificações…
      </ContextMenuItem>

      {deVoz ? (
        <>
          <ContextMenuSeparator />
          {/*
            ⚠ **"Entrar na sala" aparece MESMO conectado, e é do design.**
            Esconder o item para quem já está dentro parece limpeza e custa o
            caso de quem entrou por engano noutro canal e quer voltar a este —
            e `entrarNaChamada` no canal em que já se está é no-op.
          */}
          <ContextMenuItem onSelect={() => void entrarNaChamada(channelId)}>
            <SpeakerHigh size={ICONE.calha} aria-hidden />
            Entrar na sala
          </ContextMenuItem>
          {/*
            ⚠ **Existe porque o clique deixou de abrir o chat.** Sem este item,
            ler a conversa de uma sala em que você NÃO está perderia o único
            caminho que tinha.
          */}
          <ContextMenuItem onSelect={() => selecionarCanal(channelId)}>
            <Hash size={ICONE.calha} aria-hidden />
            Abrir o chat
          </ContextMenuItem>
        </>
      ) : null}

      <ContextMenuSeparator />

      {/*
        ⚠ **"Copiar link" do canal é do design (`⇧⌘C`) e não existia.** Ele
        monta o caminho a partir do CANAL e não da rota atual — um link do
        canal #produto copiado com #geral aberto apontaria para #geral, e quem
        cola não descobre.
      */}
      <ContextMenuItem
        onSelect={() =>
          void copiarTexto(
            `${location.origin}/servidor/${canal.serverId ?? ""}/canal/${channelId}`,
            "Link",
          )
        }
        disabled={canal.serverId === undefined}
      >
        <Link size={ICONE.calha} aria-hidden />
        Copiar link
        <span className={menuAtalho}>
          {atalho({ mod: true, shift: true, tecla: "C" })}
        </span>
      </ContextMenuItem>

      {pode(channelId, "criarConvite") ? (
        <ContextMenuItem
          onSelect={() => administrar({ tipo: "convite", channelId })}
        >
          <LinkSimple size={ICONE.calha} aria-hidden />
          Criar convite
        </ContextMenuItem>
      ) : null}

      {/*
        Daqui para baixo é administração, e cada item só existe se a pessoa
        PODE. Não é `disabled`: um item cinza ensina que a ação existe e que
        você não a tem, ruído permanente para quem nunca vai tê-la.
      */}
      {pode(channelId, "gerenciarCanais") ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => administrar({ tipo: "editarCanal", channelId })}
          >
            <PencilSimple size={ICONE.calha} aria-hidden />
            Editar canal
          </ContextMenuItem>
          {/*
            Do design, ao lado de "Editar canal". Copia configurações E
            permissões — sem os overrides, duplicar abriria um canal restrito.
            Abre a cópia ao terminar: ela tem o MESMO nome do original, e sem
            navegar não haveria como saber qual das duas linhas é a nova.
          */}
          <ContextMenuItem
            onSelect={() =>
              void duplicarCanal(channelId).then((novo) => {
                if (novo) selecionarCanal(novo);
              })
            }
          >
            <Copy size={ICONE.calha} aria-hidden />
            Duplicar canal
          </ContextMenuItem>
          {/*
            ⚠ **Renomear e CONFIGURAR são dois destinos, e o design os
            separa.** O modal de editar resolve o caso de um campo; as
            configurações são quatro telas com permissões e exclusão.
          */}
          <ContextMenuItem onSelect={() => abrirConfigDeCanal("canal", channelId)}>
            <GearSix size={ICONE.calha} aria-hidden />
            Configurações do canal
          </ContextMenuItem>
          <ContextMenuItem
            perigo
            onSelect={() => administrar({ tipo: "apagarCanal", channelId })}
          >
            <Trash size={ICONE.calha} aria-hidden />
            Apagar canal
          </ContextMenuItem>
        </>
      ) : null}

      <ItemDeId id={channelId} />
    </ContextMenuContent>
  );
}
