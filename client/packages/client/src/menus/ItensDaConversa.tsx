import { useSyncExternalStore } from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import {
  Check,
  Gear,
  ICONE,
  Note,
  Phone,
  ProhibitInset,
  PushPin,
  SignOut,
  User,
  X,
} from "../components/ui/icones";
import { ItemDeId } from "../components/ui/ItemDeId";
import { marcarCanalLido } from "../sdk/adapter";
import { entrarNaChamada } from "../sdk/chamada";
import { bloquear, desfazerAmizade, sairDaConversa } from "../sdk/social";
import { administrar } from "../store/administracao";
import { alternarFavorita, assinarFavoritos, ehFavorita } from "../store/favoritos";
import { useChannel } from "../store/hooks";
import { SubmenuDeSilenciar } from "./SubmenuDeSilenciar";

/**
 * O menu da CONVERSA — conversa direta e grupo.
 *
 * ⚠ **A ordem é a do design, e a mudança que ela impõe é onde "Fechar" fica.**
 * Ele estava em segundo, colado em "Fixar"; o design o põe no FIM, junto de
 * "Sair do grupo", porque os dois são a mesma classe de gesto — tirar a
 * conversa da coluna. Ação que remove no meio de um menu é onde se clica sem
 * querer ao mirar a de cima.
 *
 * ⚠ **`Notas` continua sem menu**, e não por economia: é a sua própria
 * gaveta — não há relação para gerir, nem de onde sair, nem a quem ligar. O
 * único item que sobraria é "Copiar ID".
 */
export function ItensDaConversa({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const favorita = useSyncExternalStore(assinarFavoritos, () =>
    ehFavorita(channelId),
  );
  if (!canal) return null;

  const dm = canal.tipo === "dm";
  const grupo = canal.tipo === "grupo";
  const outroId = canal.destinatarioId;

  return (
    <ContextMenuContent>
      {/*
        "Marcar como lida" faltava nas duas — DM e grupo —, e é o primeiro item
        do menu no design. Ele existe no menu do canal desde sempre; uma
        conversa É um canal, e a assimetria era só de quem escreveu o menu.
      */}
      <ContextMenuItem
        onSelect={() => marcarCanalLido(channelId)}
        disabled={canal.naoLidas === 0}
      >
        <Check size={ICONE.calha} aria-hidden />
        Marcar como lida
      </ContextMenuItem>

      {/*
        ⚠ **Ligar é do design e não existia no menu.** O cabeçalho da conversa
        já tem o botão, mas quem está lendo OUTRO canal não passa por ele — e é
        justamente quem precisa do caminho curto. `entrarNaChamada` é a mesma
        fachada do botão, então os dois não podem divergir.
      */}
      <ContextMenuItem onSelect={() => void entrarNaChamada(channelId)}>
        <Phone size={ICONE.calha} aria-hidden />
        Ligar
      </ContextMenuItem>

      {/* A mesma forma de silenciar do servidor, do canal e do tópico. */}
      <SubmenuDeSilenciar
        alvo={{ tipo: "canal", id: channelId }}
        rotulo="Silenciar conversa"
      />

      <ContextMenuSeparator />

      {dm ? (
        <>
          {/* Favorita vai para a CONTA pela sincronia de configurações. */}
          <ContextMenuItem onSelect={() => alternarFavorita(channelId)}>
            <PushPin size={ICONE.calha} aria-hidden />
            {favorita ? "Desafixar conversa" : "Fixar conversa"}
          </ContextMenuItem>

          {/*
            ⚠ **A nota mora DENTRO do perfil**, como no design ("Nota privada ·
            só você vê", no cartão) e como já acontece no menu do usuário. Um
            modal só para ela daria duas superfícies sobre a mesma pessoa, e a
            segunda sem contexto de quem ela é.
          */}
          {outroId !== undefined ? (
            <ContextMenuItem
              onSelect={() =>
                administrar({ tipo: "perfil", serverId: "", userId: outroId })
              }
            >
              <Note size={ICONE.calha} aria-hidden />
              Nota privada
            </ContextMenuItem>
          ) : null}
        </>
      ) : null}

      {grupo ? (
        <>
          <ContextMenuItem onSelect={() => alternarFavorita(channelId)}>
            <PushPin size={ICONE.calha} aria-hidden />
            {favorita ? "Desafixar conversa" : "Fixar conversa"}
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => administrar({ tipo: "grupo", channelId })}
          >
            <Gear size={ICONE.calha} aria-hidden />
            Gerenciar grupo
          </ContextMenuItem>
        </>
      ) : null}

      {/*
        ⚠ **As duas de RELAÇÃO só existem com destinatário resolvido.** Numa DM
        o `destinatarioId` é calculado no adapter (`recipientIds` menos eu); sem
        ele não há de quem desfazer amizade nem quem bloquear, e um item que age
        sobre `undefined` falha calado. Grupo não tem "o outro".
      */}
      {dm && outroId !== undefined ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            perigo
            onSelect={() => {
              void desfazerAmizade(outroId);
            }}
          >
            <User size={ICONE.calha} aria-hidden />
            Desfazer amizade
          </ContextMenuItem>
          <ContextMenuItem
            perigo
            onSelect={() => {
              void bloquear(outroId);
            }}
          >
            <ProhibitInset size={ICONE.calha} aria-hidden />
            Bloquear
          </ContextMenuItem>
        </>
      ) : null}

      <ContextMenuSeparator />

      {dm ? (
        <ContextMenuItem
          onSelect={() => {
            void sairDaConversa(channelId);
          }}
        >
          <X size={ICONE.calha} aria-hidden />
          Fechar conversa
        </ContextMenuItem>
      ) : (
        <ContextMenuItem
          perigo
          onSelect={() => {
            void sairDaConversa(channelId);
          }}
        >
          <SignOut size={ICONE.calha} aria-hidden />
          Sair do grupo
        </ContextMenuItem>
      )}

      {/*
        ⚠ **Divergência 1:1 deliberada: o design NÃO tem "Copiar ID" na DM.**
        Ele existe aqui desde que o menu foi construído, e tirá-lo apagaria uma
        ação em silêncio — o defeito exato que unificar menu deveria evitar.
        Todo menu deste app termina em `ItemDeId`, e a consistência interna
        ganha da composição de uma tela.
      */}
      <ItemDeId id={channelId} />
    </ContextMenuContent>
  );
}
