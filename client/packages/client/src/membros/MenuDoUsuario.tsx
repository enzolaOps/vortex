import { useSyncExternalStore } from "react";

import {
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import { Deslizante } from "../components/ui/Deslizante";
import {
  EnvelopeSimple,
  Hammer,
  Note,
  PencilSimple,
  Phone,
  PhoneX,
  ProhibitInset,
  SignOut,
  UserCircle,
} from "../components/ui/icones";
import { Avatar } from "../components/ui/Avatar";
import { ItemDeId } from "../components/ui/ItemDeId";
import {
  canalDeVozDe,
  usuarioLocalId,
} from "../sdk/adapter";
import { chaveDeMembro } from "../sdk/domain";
import { pode } from "../sdk/permissoes";
import { administrar } from "../store/administracao";
import {
  useMembro,
  useServidorAtivo,
  useVozDoCanal,
} from "../store/hooks";
import {
  abrirConversa,
  lerLocal,
} from "../store/navegacao";
import { alternarSilencioDe } from "../store/sobrePessoas";
import {
  assinarVolume,
  definirVolume,
  lerVolume,
  VOLUME_MAXIMO,
} from "../store/volumesDeVoz";
import { moderarVoz } from "../sdk/cargos";
import { menuLargo } from "../components/ui/menu";
import { entrarNaChamada } from "../sdk/chamada";
import { abrirConversaCom } from "../sdk/social";
import {
  SubmenuDeCargos,
  SubmenuDeVoz,
} from "./SubmenusDeMembro";
import css from "./MenuDoUsuario.module.css";

/**
 * O menu de um MEMBRO — o mesmo nas duas superfícies que o abrem.
 *
 * ⚠ **Ele morava em `list/MessageRow.tsx` e servia só à timeline, enquanto a
 * member list tinha um menu PRÓPRIO com quatro itens de moderação.** A mesma
 * pessoa, dois menus diferentes, dependendo de onde se clicasse com o direito.
 * Medido: onze itens contra quatro.
 *
 * O `CLAUDE.md` já tinha a regra escrita, do dia em que o `⋯` da mensagem foi
 * resolvido — *"Dois menus com os mesmos quinze itens divergem no primeiro que
 * ganha um item novo."* Aqui eles já tinham divergido em sete.
 *
 * O design desenha UM menu de membro: Cargos › · Alterar apelido · Mover para
 * canal de voz › · Castigar › · Expulsar do servidor · Banir · Mensagem.
 *
 * Mora em `membros/` e não em `list/` porque é um menu sobre uma PESSOA, não
 * sobre uma mensagem — e porque todas as dependências dele já viviam aqui,
 * `SubmenuDeCargos` e `SubmenuDeVoz` inclusive. A direção do import continua
 * sendo `list → membros`, como já era.
 *
 * Ele existe porque o design o desenha, e porque o caminho que havia — o
 * cartão de perfil no hover do avatar — responde "quem é" e não "o que eu faço
 * com essa pessoa". São perguntas diferentes e pedem alvos diferentes.
 *
 * O que é de MODERAÇÃO segue a regra da member list e some sem permissão; o
 * resto é do dia a dia e aparece para todo mundo.
 *
 * ⚠ **"Acima da sua hierarquia" existe agora, e é a ÚNICA coisa deste menu
 * que aparece desabilitada.** A distinção com o resto é o critério, não o
 * gosto: permissão que você nunca vai ter é ruído permanente e some;
 * hierarquia muda quando alguém troca de cargo, então é informação — dizer
 * "você não pode banir esta pessoa PORQUE ela está acima de você" é diferente
 * de esconder o item e deixar a pessoa procurando.
 */
export function MenuDoUsuario({
  userId,
  serverId: serverIdDado,
  voz,
}: {
  userId: string;
  /**
   * O servidor, quando quem abre o menu sabe qual.
   *
   * ⚠ **A sala de voz e o popout NÃO estão no servidor ativo.** Ler o servidor
   * da navegação funciona na timeline e na member list e mente nas outras
   * duas: numa chamada aberta com outro servidor selecionado, moderar agiria
   * sobre o servidor errado — ou, numa DM em chamada, sobre um que não existe.
   */
  serverId?: string;
  /**
   * O canal da SALA, quando o menu é aberto de dentro da voz.
   *
   * ⚠ **A voz tinha um menu PRÓPRIO, e era a terceira variante da mesma
   * pessoa.** A timeline e a member list já compartilhavam este; a sala
   * respondia volume, silêncio local, mover, mudo/surdo do servidor e
   * desconectar — sem "ver perfil" completo, sem cargos, sem apelido, sem
   * castigo. O `CLAUDE.md` já tinha a regra: dois menus com os mesmos itens
   * divergem no primeiro que ganha um item novo.
   */
  voz?: string;
}) {
  const ativo = useServidorAtivo();
  const serverId = serverIdDado ?? ativo;
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const souEu = userId === usuarioLocalId();
  /* Canal ativo para as permissões — moderação é resolvida por canal em todo
     o resto do app, e este menu não pode ser a exceção. */
  /*
    O canal que responde às permissões: o da SALA quando o menu nasce na voz,
    senão o canal aberto. Moderação é resolvida por canal em todo o resto do
    app, e este menu não pode ser a exceção.
  */
  const local = lerLocal();
  const canalId =
    voz ?? (local.tipo === "servidor" ? (local.channelId ?? "") : "");

  /*
    As três perguntas que a fase 6 destravou.

    `abaixoDeMim` vem do snapshot — a comparação é `inferiorTo` do SDK e roda
    na escrita, não aqui: `stoat.js` só pode ser importado dentro de `src/sdk/`.
  */
  const abaixo = membro?.abaixoDeMim === true;
  const podeGerenciarCargos = !souEu && abaixo && pode(canalId, "gerenciarCargos");
  const podeGerenciarApelido = souEu || (abaixo && pode(canalId, "gerenciarApelidos"));
  const podeMover = !souEu && abaixo && pode(canalId, "moverMembros");
  /*
    ⚠ Em voz é pergunta do STORE EFÊMERO de voz, e ele é keyed por canal — não
    há "onde está fulano". Varrer os canais aqui seria trabalho a cada abertura
    de menu; o que existe é o snapshot do membro dizendo se ele está em alguma
    sala, e ele já vem do adapter.
  */
  const emVoz = canalDeVozDe(userId) !== undefined;

  /*
    ⚠ **O item desabilitado com MOTIVO — e ele só existe quando o motivo é
    hierarquia.** Sem permissão nenhuma o bloco de moderação simplesmente não
    é renderizado (regra da member list); com permissão e hierarquia contra,
    ele aparece cinza dizendo por quê. Um item cinza sem motivo ensinaria a
    pessoa a tentar de novo.
  */
  /*
    ⚠ **O aviso e os três itens de moderação são EXCLUDENTES, e a primeira
    versão os deixou coexistir.** Medido no arnês: "Moderar · acima da sua
    hierarquia" apareceu cinza logo acima de "Expulsar" e "Banir" habilitados
    — a interface contradizendo a si mesma numa linha. `abaixo` gateia os três
    agora, e o aviso ocupa o lugar deles.
  */
  const barradoPorHierarquia =
    !souEu && !abaixo && membro !== undefined && pode(canalId, "expulsar");

  return (
    <ContextMenuContent className={menuLargo}>
      <div className={css.cabecalhoDoUsuario}>
        <Avatar
          sigla={membro?.sigla ?? "?"}
          url={membro?.avatarUrl}
          tamanho="sm"
          id={userId}
        />
        <div className={css.identidade}>
          <span className={css.identidadeNome}>
            {membro?.displayName ?? "desconhecido"}
          </span>
          <span className={css.identidadeUsuario}>{membro?.username ?? "—"}</span>
        </div>
      </div>

      <ContextMenuSeparator />

      <ContextMenuItem
        onSelect={() => administrar({ tipo: "perfil", serverId, userId })}
      >
        <UserCircle aria-hidden />
        Ver perfil
      </ContextMenuItem>
      {!souEu ? (
        <>
          {/*
            ⚠ **`openDM` é idempotente no protocolo** — chamar com uma conversa
            que já existe devolve a mesma. É o que permite este item não
            precisar saber se já houve conversa antes, e não haver dois
            caminhos ("abrir" e "criar") que precisariam concordar.

            A navegação fica AQUI e não em `sdk/social`: aquele módulo traduz
            protocolo, e para onde a pessoa vai é decisão do store.
          */}
          <ContextMenuItem
            onSelect={() => {
              void abrirConversaCom(userId).then((canal) => {
                if (canal) abrirConversa(canal);
              });
            }}
          >
            <EnvelopeSimple aria-hidden />
            Mensagem
          </ContextMenuItem>
          {/*
            ⚠ **Ligar é abrir a conversa E entrar na sala dela**, nesta ordem.
            No Stoat não existe "chamada avulsa": uma chamada é sempre de um
            CANAL, e o canal de uma conversa direta é a própria DM. Sem abrir
            antes, a pessoa entraria numa chamada sem ver com quem.

            Só depois de a conversa existir — se `openDM` falhar, não há sala
            para entrar, e entrar num ID indefinido é o tipo de chamada que
            falha calada.
          */}
          <ContextMenuItem
            onSelect={() => {
              void abrirConversaCom(userId).then((canal) => {
                if (!canal) return;
                abrirConversa(canal);
                void entrarNaChamada(canal);
              });
            }}
          >
            <Phone aria-hidden />
            Ligar
          </ContextMenuItem>
        </>
      ) : null}

      {/*
        ⚠ **A seta VOLTOU, e com submenu de verdade.**

        Ela tinha saído porque prometia o que o app não podia cumprir: cargos
        exigia a tabela RESOLVIDA (quais são os do servidor E quais são os
        desta pessoa) e `MemberSnapshot` não carregava os IDs. `cargosIds`
        entrou na fase 6, e com ele os dois submenus deste menu.

        Uma seta que não abre nada é pior que a ausência dela — é o mesmo
        defeito do item sem `onSelect` que o lint deste projeto mata.
      */}
      {podeGerenciarCargos ? (
        <SubmenuDeCargos serverId={serverId} userId={userId} />
      ) : null}

      {podeGerenciarApelido ? (
        <ContextMenuItem
          onSelect={() =>
            administrar({ tipo: "apelido", serverId, userId })
          }
        >
          <PencilSimple aria-hidden />
          Alterar apelido
        </ContextMenuItem>
      ) : null}

      {/* A nota mora DENTRO do perfil, como no design ("Nota privada · só
          você vê", no cartão). Um modal só para ela daria duas superfícies
          sobre a mesma pessoa, e a segunda sem contexto de quem ela é. */}
      <ContextMenuItem
        onSelect={() => administrar({ tipo: "perfil", serverId, userId })}
      >
        <Note aria-hidden />
        Nota privada
      </ContextMenuItem>

      {!souEu ? (
        <>
          <ContextMenuSeparator />
          {/*
            ⚠ **Só aparece com a pessoa JÁ em voz.** `voice_channel` MOVE, não
            convoca — o protocolo devolve 400 para quem não está em sala
            nenhuma, e um item que falha sempre é o mesmo defeito que a seta
            sem submenu era.
          */}
          {emVoz && podeMover ? (
            <SubmenuDeVoz serverId={serverId} userId={userId} />
          ) : null}
          {/*
            ⚠ **O rótulo NÃO alterna com o estado.** "Silenciar" e
            "Dessilenciar" no mesmo lugar fazem quem lê depressa clicar no
            oposto do que quer — e um item de menu não tem `aria-pressed` para
            carregar o estado. Quem mostra o estado é o interruptor do perfil,
            que é uma superfície que fica aberta; daqui o menu só ALTERNA, que
            é o gesto rápido.
          */}
          <ContextMenuItem onSelect={() => alternarSilencioDe(userId)}>
            <ProhibitInset aria-hidden />
            Silenciar só para mim
          </ContextMenuItem>
        </>
      ) : null}

      {/*
        O bloco de VOZ — só quando o menu nasce dentro de uma sala.

        Componente próprio porque ele assina três coisas (volume, sala,
        silêncio) que não existem fora da voz: com os hooks aqui em cima, todo
        menu de usuário da timeline pagaria por elas.
      */}
      {voz !== undefined ? (
        <BlocoDeVoz
          userId={userId}
          channelId={voz}
          serverId={serverId}
          souEu={souEu}
          abaixo={abaixo}
        />
      ) : null}

      {barradoPorHierarquia ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem disabled className={css.barrado}>
            <Hammer aria-hidden />
            Moderar · acima da sua hierarquia
          </ContextMenuItem>
        </>
      ) : null}

      {!souEu && abaixo && pode(canalId, "silenciarMembro") ? (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            perigo
            onSelect={() =>
              administrar({ tipo: "moderar", serverId, userIds: [userId], acao: "castigo" })
            }
          >
            <ProhibitInset aria-hidden />
            Castigar (timeout)
          </ContextMenuItem>
        </>
      ) : null}
      {!souEu && abaixo && pode(canalId, "expulsar") ? (
        <ContextMenuItem
          perigo
          onSelect={() =>
            administrar({ tipo: "moderar", serverId, userIds: [userId], acao: "expulsar" })
          }
        >
          <SignOut aria-hidden />
          Expulsar do servidor
        </ContextMenuItem>
      ) : null}
      {!souEu && abaixo && pode(canalId, "banir") ? (
        <ContextMenuItem
          perigo
          onSelect={() =>
            administrar({ tipo: "moderar", serverId, userIds: [userId], acao: "banir" })
          }
        >
          <Hammer aria-hidden />
          Banir do servidor
        </ContextMenuItem>
      ) : null}

      {/*
        ⚠ **Veio do menu da member list, e é a razão de o unificado ser a
        UNIÃO e não o maior dos dois.** Copiar ID existia só lá; trocar aquele
        menu por este sem trazê-lo teria apagado a ação em silêncio, que é
        exatamente o defeito que unificar deveria evitar.
      */}
      <ItemDeId id={userId} />
    </ContextMenuContent>
  );
}

/**
 * O que só existe DENTRO de uma sala de voz.
 *
 * ⚠ **Volume e silêncio local não são a mesma coisa, e os dois eixos vivem em
 * stores separados** (`volumesDeVoz` e `sobrePessoas`) — o motor lê os dois
 * por `volumeEfetivo`. "Silenciar só para mim" fica no bloco de cima, onde já
 * estava, porque ele vale FORA da sala também.
 *
 * ⚠ **Moderação de voz só existe em sala de SERVIDOR.** Uma chamada de DM não
 * tem `ServerMember`, então não há onde escrever mudo, surdo ou mover — e os
 * itens simplesmente não aparecem, em vez de falhar calados.
 *
 * Componente próprio porque ele assina três coisas que não existem fora da
 * voz: com os hooks no menu, todo clique direito da timeline pagaria por elas.
 */
function BlocoDeVoz({
  userId,
  channelId,
  serverId,
  souEu,
  abaixo,
}: {
  userId: string;
  channelId: string;
  serverId: string;
  souEu: boolean;
  abaixo: boolean;
}) {
  const sala = useVozDoCanal(channelId);
  const participante = sala.find((p) => p.userId === userId);
  const volume = useSyncExternalStore(
    (ouvinte) => assinarVolume(userId, ouvinte),
    () => lerVolume(userId),
  );

  const deServidor = serverId !== "" && !souEu;
  const podeMover = deServidor && pode(channelId, "moverMembros");
  const podeMudo = deServidor && pode(channelId, "silenciarNaVoz");
  const podeSurdo = deServidor && pode(channelId, "ensurdecerNaVoz");

  return (
    <>
      <ContextMenuSeparator />

      {souEu ? null : (
        /*
          ⚠ **As setas param no deslizante.** Dentro de um `menu` o Radix usa
          ↑↓ para andar entre itens e as letras para busca por digitação; sem
          o `stopPropagation`, apertar → no volume andaria o foco para o item
          seguinte em vez de subir o volume. Chega-se a ele por Tab.
        */
        <div className={css.volume} onKeyDown={(e) => e.stopPropagation()}>
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
            rotulo="Volume individual"
            texto={`${String(volume)} por cento`}
            aoMudar={(v) => definirVolume(userId, v)}
          />
        </div>
      )}

      {podeMover && abaixo ? (
        <SubmenuDeVoz
          serverId={serverId}
          userId={userId}
          rotulo="Mover para outro canal"
          atual={channelId}
        />
      ) : null}

      {abaixo && (podeMudo || podeSurdo || podeMover) ? (
        <>
          {/*
            ⚠ **Aviso é o terceiro tom, e não é um perigo mais fraco.**
            Restringir alguém é reversível e administrativo; tirá-lo da sala é
            uma ação que interrompe.
          */}
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
    </>
  );
}
