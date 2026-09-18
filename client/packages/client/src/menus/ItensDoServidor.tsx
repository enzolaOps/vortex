import { useSyncExternalStore } from "react";

import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../components/ui/ContextMenu";
import {
  BellSimple,
  Check,
  FolderSimplePlus,
  GearSix,
  Hash,
  ICONE,
  LinkSimple,
  Plus,
  ShieldCheck,
  SignOut,
} from "../components/ui/icones";
import { ItemDeId } from "../components/ui/ItemDeId";
import { marcarCanalLido } from "../sdk/adapter";
import { categorias } from "../sdk/adapter";
import { exibirMinhaTag } from "../sdk/perfilDoServidor";
import { pode, podeNoServidor, type Acao } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import {
  abrirConfig,
  GRUPOS_DE_SERVIDOR,
  NOME_DA_SECAO,
  type SecaoId,
} from "../store/config";
import {
  alternarOcultarSilenciados,
  assinarExibicao,
  ocultaSilenciados,
} from "../store/exibicaoDeCanais";
import { useServer } from "../store/hooks";
import { useExibeTag, usePerfilDoServidor } from "../store/perfilDoServidor";
import { assinarPastas, lerPastas, moverParaPasta } from "../store/pastas";
import {
  assinarSilencio,
  definirNivelDoServidor,
  NIVEIS_DE_NOTIFICACAO,
  nivelDoServidor,
} from "../store/silencio";
import { usuarioLocalId } from "../sdk/adapter";
import { SubmenuDeSilenciar } from "./SubmenuDeSilenciar";

/**
 * O menu do SERVIDOR — um só, para os três alvos que o abrem.
 *
 * ⚠ **Havia dois menus sem um único item em comum, e um terceiro que não
 * existia.** O clique direito no ladrilho do rail dava privacidade e pastas; o
 * `▾` do cabeçalho da coluna dava criar canal e as treze seções de
 * configuração soltas; o clique direito no PRÓPRIO cabeçalho caía no menu do
 * navegador. É a mesma entidade respondendo três coisas diferentes conforme
 * onde a mão pousa — e o `CLAUDE.md` já tinha a regra escrita desde o dia do
 * `⋯`: *"dois menus com os mesmos itens divergem no primeiro que ganha um item
 * novo"*. Estes nunca convergiram para começar.
 *
 * ⚠ **`ContextMenu` e não `DropdownMenu`, mesmo no `▾`.** O gatilho do
 * cabeçalho despacha o `contextmenu` que o `MenuDeContexto` já escuta — o
 * mesmo arranjo do `⋯` da barra de ações da mensagem, e pelo mesmo motivo:
 * manter as duas famílias de primitivo exigiria o conteúdo escrito duas vezes,
 * uma com `ContextMenuItem` e outra com `DropdownMenuItem`.
 *
 * ⚠ **As treze seções viraram um submenu "Configurações ›", nos QUATRO grupos
 * do design.** Treze itens soltos num menu de contexto fazem o menu ser mais
 * alto que a coluna que o abre, e "Banimentos" acaba do lado de "Emojis" sem
 * nada dizer que um é moderação e o outro é expressão — o mesmo defeito que a
 * coluna de configurações já tinha corrigido agrupando.
 */

/** A permissão que cada seção exige — as sem entrada aparecem para todo mundo. */
const PERMISSAO_DA_SECAO: Partial<Record<SecaoId, Acao>> = {
  servidor: "gerenciarServidor",
  tag: "gerenciarServidor",
  modelo: "gerenciarServidor",
  emojis: "gerenciarServidor",
  figurinhas: "gerenciarServidor",
  sons: "gerenciarServidor",
  membros: "expulsar",
  cargos: "gerenciarCargos",
  convites: "criarConvite",
  acesso: "gerenciarServidor",
  seguranca: "gerenciarServidor",
  auditoria: "gerenciarServidor",
  banimentos: "banir",
};

export function ItensDoServidor({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  const perfil = usePerfilDoServidor(serverId);
  const exiboTag = useExibeTag(serverId, usuarioLocalId() ?? "");
  const pastas = useSyncExternalStore(assinarPastas, lerPastas);
  const ocultar = useSyncExternalStore(assinarExibicao, () =>
    ocultaSilenciados(serverId),
  );
  const nivel = useSyncExternalStore(assinarSilencio, () => nivelDoServidor(serverId));

  /*
    A permissão pelo PRIMEIRO canal, e pelo servidor quando não há nenhum.

    Sobrescrita por canal só aparece no canal, então perguntar ao servidor onde
    existe canal devolveria a resposta errada. Ver `podeNoServidor`.
  */
  const grupos = categorias.getSnapshot(serverId) ?? [];
  const canais = grupos.flatMap((g) => g.canais);
  const primeiro = canais[0];
  const posso = (acao: Acao) =>
    primeiro === undefined ? podeNoServidor(serverId, acao) : pode(primeiro, acao);

  const podeCriar = posso("gerenciarCanais");
  /* Convidar é do CANAL no protocolo — não existe `Server.createInvite`. O
     primeiro canal é o alvo honesto; sem canal não há convite a criar. */
  const podeConvidar = primeiro !== undefined && pode(primeiro, "criarConvite");

  const secoes = GRUPOS_DE_SERVIDOR.map((g) => ({
    titulo: g.titulo,
    itens: g.itens.filter((s) => {
      const exigida = PERMISSAO_DA_SECAO[s];
      return exigida === undefined || posso(exigida);
    }),
  })).filter((g) => g.itens.length > 0);

  return (
    <ContextMenuContent>
      {/*
        Marcar o servidor inteiro como lido — item do design que não existia em
        menu nenhum. Percorre os canais desta coluna e não `marcarTodosLidos`,
        que é GLOBAL: o item diz "este servidor", e zerar os outros seria fazer
        mais do que ele promete.
      */}
      <ContextMenuItem
        onSelect={() => {
          for (const id of canais) marcarCanalLido(id);
        }}
        disabled={canais.length === 0}
      >
        <Check size={ICONE.calha} aria-hidden />
        Marcar servidor como lido
      </ContextMenuItem>

      {podeConvidar ? (
        <ContextMenuItem
          onSelect={() => administrar({ tipo: "convite", channelId: primeiro })}
        >
          <LinkSimple size={ICONE.calha} aria-hidden />
          Convidar pessoas
        </ContextMenuItem>
      ) : null}

      <ContextMenuSeparator />

      {/*
        Notificações e silêncio, os dois eixos da mesma pergunta — e agora com
        a MESMA forma que o canal, a DM e o tópico usam. Ver `silenciar.ts`.
      */}
      <ContextMenuSub>
        <ContextMenuSubTrigger>
          <BellSimple size={ICONE.calha} aria-hidden />
          Notificações
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {NIVEIS_DE_NOTIFICACAO.map((n) => (
            <ContextMenuCheckboxItem
              key={n.id}
              marcado={(nivel ?? "mencoes") === n.id}
              aoAlternar={() => definirNivelDoServidor(serverId, n.id)}
            >
              {n.rotulo}
            </ContextMenuCheckboxItem>
          ))}
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              administrar({ tipo: "notificacoesDoServidor", serverId })
            }
          >
            Exceções por canal…
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>

      <SubmenuDeSilenciar
        alvo={{ tipo: "servidor", id: serverId }}
        rotulo="Silenciar servidor"
      />

      {/*
        ⚠ **Privacidade é o PRIMEIRO da seção pessoal, e é do design.** Ela é a
        única coisa deste menu que muda o que os OUTROS podem fazer com você;
        pasta e ordem são arrumação.
      */}
      <ContextMenuItem
        onSelect={() =>
          administrar({ tipo: "privacidadeDoServidor", serverId })
        }
      >
        <ShieldCheck size={ICONE.calha} aria-hidden />
        Privacidade neste servidor
      </ContextMenuItem>

      {podeCriar ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() =>
              administrar({
                tipo: "criarCanal",
                serverId,
                categoriaId: undefined,
                voz: false,
              })
            }
          >
            <Hash size={ICONE.calha} aria-hidden />
            Criar canal
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => administrar({ tipo: "criarCategoria", serverId })}
          >
            <Plus size={ICONE.calha} aria-hidden />
            Criar categoria
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() => administrar({ tipo: "evento", serverId })}
          >
            <Plus size={ICONE.calha} aria-hidden />
            Criar evento
          </ContextMenuItem>
        </>
      ) : null}

      {secoes.length > 0 ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <GearSix size={ICONE.calha} aria-hidden />
              Configurações
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {secoes.map((g, i) => (
                <div key={g.titulo}>
                  {i > 0 ? <ContextMenuSeparator /> : null}
                  <ContextMenuLabel>{g.titulo}</ContextMenuLabel>
                  {g.itens.map((s) => (
                    <ContextMenuItem
                      key={s}
                      onSelect={() => abrirConfig(s, serverId)}
                    >
                      {NOME_DA_SECAO[s]}
                    </ContextMenuItem>
                  ))}
                </div>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </>
      ) : null}

      <ContextMenuSeparator />

      {/*
        As duas alternâncias de EXIBIÇÃO — elas eram só do `▾` e agora valem
        também no rail, que é de onde a maioria abre o menu do servidor.
      */}
      {perfil.tag !== undefined ? (
        <ContextMenuCheckboxItem
          marcado={exiboTag}
          aoAlternar={() => void exibirMinhaTag(serverId, !exiboTag)}
        >
          Exibir a tag {perfil.tag} no meu nome
        </ContextMenuCheckboxItem>
      ) : null}
      <ContextMenuCheckboxItem
        marcado={ocultar}
        aoAlternar={() => alternarOcultarSilenciados(serverId)}
      >
        Ocultar canais silenciados
      </ContextMenuCheckboxItem>

      <ContextMenuSeparator />

      <ContextMenuItem
        onSelect={() => administrar({ tipo: "criarPasta", serverId })}
      >
        <FolderSimplePlus size={ICONE.calha} aria-hidden />
        Nova pasta com este
      </ContextMenuItem>
      {pastas.map((p) =>
        p.servidores.includes(serverId) ? (
          <ContextMenuItem
            key={p.id}
            onSelect={() => moverParaPasta(serverId, null)}
          >
            Tirar de {p.nome}
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            key={p.id}
            onSelect={() => moverParaPasta(serverId, p.id)}
          >
            Mover para {p.nome}
          </ContextMenuItem>
        ),
      )}

      {/*
        ⚠ **Sair era alcançável por UM caminho só — dentro da visão geral das
        configurações.** O design o põe no menu do servidor, que é onde a
        categoria inteira o põe. O rótulo muda para quem é dono porque a MESMA
        chamada apaga o servidor (ver `sairDoServidor`); quem decide isso é o
        modal, e por isso o item não tem dois textos aqui.
      */}
      <ContextMenuSeparator />
      <ContextMenuItem
        perigo
        onSelect={() => administrar({ tipo: "apagarServidor", serverId })}
        disabled={servidor === undefined}
      >
        <SignOut size={ICONE.calha} aria-hidden />
        Sair do servidor
      </ContextMenuItem>

      <ItemDeId id={serverId} />
    </ContextMenuContent>
  );
}
