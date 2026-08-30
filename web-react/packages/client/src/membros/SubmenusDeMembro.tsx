import { Check, Hash, UsersThree } from "@phosphor-icons/react";

import {
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../components/ui/ContextMenu";
import { usuarioLocalId } from "../sdk/adapter";
import {
  alternarCargo,
  cargosDoServidor,
  moverParaCanalDeVoz,
} from "../sdk/cargos";
import { chaveDeMembro } from "../sdk/domain";
import { useCanaisDeVoz, useChannel, useMembro } from "../store/hooks";

/**
 * Os submenus que a fase 6 destravou.
 *
 * ⚠ **A seta `›` só existe onde há submenu de verdade.** Ela tinha saído do
 * menu do usuário porque prometia o que o app não podia cumprir — quem usa
 * relatou "hover em cargos e em mover para canal não mostra nada". O que
 * faltava era DADO: `MemberSnapshot` carregava a cor e o nome do cargo
 * HASTEADO, não a lista de cargos da pessoa.
 */

/**
 * Dar e tirar cargo.
 *
 * ⚠ **Sem botão de salvar, e sem fechar o menu.** É a instrução da referência:
 * *"aplica na hora, sem botão salvar"*. É a ação de moderação mais frequente,
 * e obrigar a reabrir o menu para o segundo cargo transformaria "arrumar os
 * cargos de alguém" em cinco idas e voltas. `onSelect` com `preventDefault` é
 * o que mantém a caixa aberta.
 *
 * ⚠ **Cargo acima do meu aparece TRAVADO, não some.** A referência escreve o
 * porquê: *"o seletor filtra por hierarquia — cargos acima do seu aparecem
 * travados em vez de sumirem"*. Sumir faria a pessoa achar que o cargo não
 * existe; travado diz que existe e não é seu para dar.
 */
export function SubmenuDeCargos({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const eu = useMembro(chaveDeMembro(serverId, usuarioLocalId() ?? ""));

  const cargos = cargosDoServidor(serverId);
  if (cargos.length === 0) return null;

  const meus = membro?.cargosIds ?? [];
  /*
    O meu cargo mais alto, em RANK. Menor é mais alto no protocolo, e o
    `Infinity` de quem não tem cargo nenhum é o certo: sem cargo, todo cargo
    está acima de você.
  */
  const meuTopo = eu
    ? Math.min(
        ...cargos
          .filter((c) => eu.cargosIds.includes(c.id))
          .map((c) => c.rank),
        Infinity,
      )
    : Infinity;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <UsersThree aria-hidden />
        Cargos
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        {cargos.map((c) => {
          const tem = meus.includes(c.id);
          const acimaDeMim = c.rank <= meuTopo;
          return (
            <ContextMenuItem
              key={c.id}
              disabled={acimaDeMim}
              onSelect={(e) => {
                /* Mantém a caixa aberta: arrumar cargos é várias escolhas
                   seguidas, e fechar a cada uma seria cinco reaberturas. */
                e.preventDefault();
                void alternarCargo(serverId, userId, c.id);
              }}
            >
              {/* Espaço reservado sempre: sem ele os nomes dançam para a
                  esquerda conforme os cargos são marcados. */}
              <span aria-hidden>{tem ? <Check size={20} /> : null}</span>
              {c.nome}
            </ContextMenuItem>
          );
        })}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

/**
 * Puxar alguém para outro canal de voz.
 *
 * ⚠ Lista só os canais de VOZ, e sem o canal em que a pessoa já está — mover
 * alguém para onde ela está é um alvo que não faz nada, que é o defeito que o
 * lint de `onSelect` existe para matar.
 */
export function SubmenuDeVoz({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const canais = useCanaisDeVoz(serverId);
  if (canais.length === 0) return null;

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Hash aria-hidden />
        Mover para canal
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        {canais.map((id) => (
          <Destino
            key={id}
            channelId={id}
            serverId={serverId}
            userId={userId}
          />
        ))}
      </ContextMenuSubContent>
    </ContextMenuSub>
  );
}

/**
 * Um canal de destino. Assina o próprio nome.
 *
 * ⚠ Componente e não `.map()` com um `find`: o nome mora no snapshot do CANAL,
 * e resolvê-lo no pai exigiria o pai assinar todos os canais de voz do
 * servidor para desenhar um submenu que quase nunca abre. É a lei nº 1 na
 * mesma forma que o filtro do `NovoGrupo` usa.
 */
function Destino({
  channelId,
  serverId,
  userId,
}: {
  channelId: string;
  serverId: string;
  userId: string;
}) {
  const canal = useChannel(channelId);
  if (!canal) return null;

  return (
    <ContextMenuItem
      onSelect={() => void moverParaCanalDeVoz(serverId, userId, channelId)}
    >
      {canal.name}
    </ContextMenuItem>
  );
}
