import { useSyncExternalStore, type ReactElement } from "react";

import { Avatar } from "../components/ui/Avatar";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { Deslizante } from "../components/ui/Deslizante";
import { Hammer, PhoneX, UserCircle } from "../components/ui/icones";
import { menuLargo } from "../components/ui/menu";
import { SubmenuDeVoz } from "../membros/SubmenusDeMembro";
import { usuarioLocalId } from "../sdk/adapter";
import { moderarVoz } from "../sdk/cargos";
import { chaveDeMembro } from "../sdk/domain";
import { pode } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import {
  useChannel,
  useMembro,
  usePessoa,
  useVozDoCanal,
} from "../store/hooks";
import {
  alvoDoEvento,
  assinarMenuDoParticipante,
  definirAlvoDoParticipante,
  lerAlvoDoParticipante,
} from "../store/menuDoParticipante";
import {
  alternarSilencioDe,
  assinarSilencioDe,
  estaSilenciado,
} from "../store/sobrePessoas";
import {
  assinarVolume,
  definirVolume,
  lerVolume,
  VOLUME_MAXIMO,
} from "../store/volumesDeVoz";
import css from "./MenuDoParticipante.module.css";

/**
 * O menu de uma pessoa DENTRO da sala de voz.
 *
 * ⚠ **Não é o `MenuDoUsuario`, e a diferença é de pergunta.** Aquele responde
 * "o que eu faço com esta pessoa neste servidor" — cargos, apelido, castigo.
 * Este responde "como eu a OUÇO e o que ela pode fazer NESTA SALA": volume,
 * silêncio, mover, mudo e surdo do servidor, desconectar. É o menu que o
 * design desenha à parte ("Menu do usuário em voz"), e a referência também
 * (`VoiceUserMenu`). Os dois itens que se repetem — "Silenciar só para mim" e
 * "Ver perfil" — chamam as MESMAS funções nos dois, então não divergem.
 *
 * ⚠ **"Silenciar só para mim" é o store de `sobrePessoas`, e não um segundo.**
 * O mesmo gesto já existia no menu do membro, e dois "silenciados" guardados
 * em lugares diferentes discordariam no primeiro dia. O motor lê os dois eixos
 * (volume e silêncio) por `volumeEfetivo`.
 */

/**
 * A superfície que carrega participantes: UM `ContextMenu` para ela inteira.
 *
 * O filho único recebe o clique direito; a captura resolve quem é o alvo pelo
 * `data-participante` mais próximo, e fora de um participante o menu não abre
 * (sem `preventDefault` o Radix abriria uma caixa vazia).
 */
export function ComMenuDoParticipante({
  channelId,
  children,
}: {
  channelId: string;
  children: ReactElement;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onContextMenuCapture={(evento) => {
          const alvo = alvoDoEvento(evento.target, channelId);
          definirAlvoDoParticipante(alvo);
          if (!alvo) evento.preventDefault();
        }}
      >
        {children}
      </ContextMenuTrigger>
      <MenuDoParticipante />
    </ContextMenu>
  );
}

function MenuDoParticipante() {
  const alvo = useSyncExternalStore(
    assinarMenuDoParticipante,
    lerAlvoDoParticipante,
  );
  if (!alvo) return <ContextMenuContent />;
  return <Conteudo userId={alvo.userId} channelId={alvo.channelId} />;
}

function Conteudo({ userId, channelId }: { userId: string; channelId: string }) {
  const canal = useChannel(channelId);
  const serverId = canal?.serverId ?? "";
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const pessoa = usePessoa(userId);
  const sala = useVozDoCanal(channelId);
  const participante = sala.find((p) => p.userId === userId);

  const volume = useSyncExternalStore(
    (ouvinte) => assinarVolume(userId, ouvinte),
    () => lerVolume(userId),
  );
  const silenciado = useSyncExternalStore(
    (ouvinte) => assinarSilencioDe(userId, ouvinte),
    () => estaSilenciado(userId),
  );

  const souEu = userId === usuarioLocalId();
  const nome = membro?.displayName ?? pessoa?.displayName ?? "alguém";
  const usuario = membro?.username ?? pessoa?.username;

  /*
    ⚠ **Moderação só existe em sala de SERVIDOR.** Uma chamada de DM não tem
    `ServerMember`, então não há onde escrever mudo, surdo ou mover — e os
    itens simplesmente não aparecem, em vez de falhar calados.

    `abaixoDeMim` é a hierarquia que o servidor também confere
    (`NotElevated`); sem ela o item existiria para o servidor recusar.
  */
  const deServidor = serverId !== "" && !souEu;
  const abaixo = membro?.abaixoDeMim === true;
  const podeMover = deServidor && pode(channelId, "moverMembros");
  const podeMudo = deServidor && pode(channelId, "silenciarNaVoz");
  const podeSurdo = deServidor && pode(channelId, "ensurdecerNaVoz");
  const algumaModeracao = podeMover || podeMudo || podeSurdo;
  /* O item cinza com MOTIVO, pela regra do `MenuDoUsuario`: permissão que você
     nunca vai ter some; hierarquia, que muda, é informação. */
  const barrado = algumaModeracao && membro !== undefined && !abaixo;

  return (
    <ContextMenuContent className={menuLargo}>
      <div className={css.cabecalho}>
        <Avatar
          id={userId}
          sigla={membro?.sigla ?? pessoa?.sigla ?? "?"}
          url={membro?.avatarUrl ?? pessoa?.avatarUrl}
          tamanho="sm"
        />
        <div className={css.identidade}>
          <span className={css.nome}>{nome}</span>
          <span className={css.onde}>
            {usuario ? `${usuario} · ` : ""}em {canal?.name ?? "voz"}
          </span>
        </div>
      </div>

      <ContextMenuSeparator />

      {souEu ? null : (
        <>
          {/*
            ⚠ **As setas pararam no deslizante.** Dentro de um `menu` o Radix
            usa ↑↓ para andar entre itens e as letras para busca por digitação;
            sem o `stopPropagation`, apertar → no volume andaria o foco para o
            item seguinte em vez de subir o volume. O deslizante continua
            fora da navegação por setas do menu — chega-se a ele por Tab.
          */}
          <div
            className={css.volume}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <label className={css.rotuloDoVolume} htmlFor="volume-do-participante">
              Volume individual
              <span className={css.valorDoVolume}>{volume}%</span>
            </label>
            <Deslizante
              id="volume-do-participante"
              valor={volume}
              min={0}
              max={VOLUME_MAXIMO}
              passo={5}
              rotulo={`Volume de ${nome}`}
              texto={`${String(volume)} por cento`}
              aoMudar={(v) => definirVolume(userId, v)}
            />
          </div>

          <ContextMenuCheckboxItem
            marcado={silenciado}
            aoAlternar={() => alternarSilencioDe(userId)}
          >
            Silenciar só para mim
          </ContextMenuCheckboxItem>

          {podeMover && abaixo ? (
            <SubmenuDeVoz
              serverId={serverId}
              userId={userId}
              rotulo="Mover para outro canal"
              atual={channelId}
            />
          ) : null}
        </>
      )}

      <ContextMenuItem
        onSelect={() => administrar({ tipo: "perfil", serverId, userId })}
      >
        <UserCircle aria-hidden />
        Ver perfil
      </ContextMenuItem>

      {barrado ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem disabled className={css.barrado}>
            <Hammer aria-hidden />
            Moderar · acima da sua hierarquia
          </ContextMenuItem>
        </>
      ) : null}

      {algumaModeracao && abaixo ? (
        <>
          <ContextMenuSeparator />
          {podeMudo ? (
            <ContextMenuCheckboxItem
              aviso
              marcado={participante?.mudoPeloServidor === true}
              aoAlternar={() =>
                void moderarVoz(serverId, userId, {
                  tipo: "mudo",
                  ligar: participante?.mudoPeloServidor !== true,
                })
              }
            >
              Mudo no servidor
            </ContextMenuCheckboxItem>
          ) : null}
          {podeSurdo ? (
            <ContextMenuCheckboxItem
              aviso
              marcado={participante?.surdoPeloServidor === true}
              aoAlternar={() =>
                void moderarVoz(serverId, userId, {
                  tipo: "surdo",
                  ligar: participante?.surdoPeloServidor !== true,
                })
              }
            >
              Ensurdecer no servidor
            </ContextMenuCheckboxItem>
          ) : null}
          {podeMover ? (
            <ContextMenuItem
              perigo
              onSelect={() =>
                void moderarVoz(serverId, userId, { tipo: "desconectar" })
              }
            >
              <PhoneX aria-hidden />
              Desconectar do canal
            </ContextMenuItem>
          ) : null}
        </>
      ) : null}
    </ContextMenuContent>
  );
}
