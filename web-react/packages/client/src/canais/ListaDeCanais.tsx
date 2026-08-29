import {
  CaretDown,
  BellSimple,
  BellSimpleSlash,
  CaretRight,
  Check,
  Hash,
  LinkSimple,
  Lock,
  MagnifyingGlass,
  Monitor,
  PencilSimple,
  Plus,
  SpeakerHigh,
  UserPlus,
  Trash,
  VideoCamera,
} from "@phosphor-icons/react";
import { memo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import {
  abrirConfig,
  DE_SERVIDOR,
  NOME_DA_SECAO,
  type SecaoId,
} from "../store/config";
import { entrarNaChamada } from "../sdk/chamada";
import { administrar } from "../store/administracao";
import { ListaDeConversas } from "../casa/ListaDeConversas";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { marcarCanalLido } from "../sdk/adapter";
import { pode, type Acao } from "../sdk/permissoes";
import {
  chaveDeMembro,
  type CategoriaDeCanais,
  type EstadoDeVoz,
  type ParticipanteDeVoz,
} from "../sdk/domain";
import { alternarColapso } from "../store/colapso";
import { alternarSilencio } from "../store/silencio";
import { abrirPaleta } from "../store/paleta";
import {
  useCanalAtivo,
  useCategorias,
  useColapso,
  useChannel,
  useMembro,
  useServer,
  useServidorAtivo,
  useVozDoCanal,
  useLocal,
} from "../store/hooks";
import { Avatar } from "../components/ui/Avatar";
import { aindaNao } from "../pendente/pendencias";
import { FaixaDeVoz } from "../voz/FaixaDeVoz";
import { PainelDeUsuario } from "../usuario/PainelDeUsuario";
import { selecionarCanal } from "../store/navegacao";
import css from "./ListaDeCanais.module.css";

/**
 * Ícone por estado de publicação. Voz simples não tem ícone de propósito —
 * ver o comentário em `NaSala`.
 */
/**
 * A tecla, escrita como a plataforma a chama.
 *
 * `⌘K` num Mac e `Ctrl K` no resto. Mostrar "Ctrl" a quem usa Mac ensina o
 * atalho errado, e quem tenta e não funciona não tenta de novo — o custo de
 * errar aqui é maior que o de não mostrar nada.
 *
 * `navigator.platform` está deprecado mas continua sendo o que funciona em
 * todo navegador; `userAgentData` ainda não é universal. Fora do render de
 * propósito: é constante da máquina, não estado.
 */
const TECLA_DA_PALETA = /mac/i.test(navigator.platform) ? "⌘K" : "Ctrl K";

const ICONE_DE_VOZ: Record<EstadoDeVoz, typeof VideoCamera> = {
  voz: SpeakerHigh,
  video: VideoCamera,
  tela: Monitor,
};

/**
 * Um canal. Assina a si mesmo.
 *
 * `memo` corta a cascata: mensagem nova num canal qualquer republica a
 * contagem daquele canal e mais nada. Sem isto, a lista inteira re-renderizaria
 * a cada mensagem de cada canal — e num servidor movimentado isso é constante.
 */
const Canal = memo(function Canal({
  id,
  serverId,
  ativo,
}: {
  id: string;
  serverId: string;
  ativo: boolean;
}) {
  const canal = useChannel(id);

  if (!canal) {
    return <span className={css.canal} aria-hidden />;
  }

  const podeConvidar = pode(id, "criarConvite");
  const temNaoLidas = canal.naoLidas > 0;

  /*
    O ícone diz o TIPO; o cadeado diz o ACESSO — e o design os separa.

    Um canal privado de voz continua sendo de voz. Trocar o alto-falante pelo
    cadeado diria a coisa errada sobre o que acontece lá dentro, então o
    cadeado vem depois do nome, como no design.
  */
  const Icone = canal.tipo === "voz" ? SpeakerHigh : Hash;

  return (
    <>
    <div className={css.linhaDeCanal}>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className={css.canal}
          aria-current={ativo}
          data-naolidas={temNaoLidas && !canal.silenciado}
          data-silenciado={canal.silenciado}
          onClick={() => selecionarCanal(id)}
        >
          {/*
            A MESMA barra do rail, e o gesto repetido é o que faz dele
            assinatura: um indicador que aparece numa coluna só é um acidente.

            Ela carrega duas coisas sem ambiguidade — posição no ativo, não
            lido no degrau curto. É a decisão já registrada: a barra marca não
            lida e NÃO marca menção, porque não lida é posicional e menção é
            contagem. A contagem continua ao lado, em número.

            ⚠ Silenciado não acende. A barra é o que faz o olho parar naquela
            linha varrendo a coluna, e é exatamente disso que quem silenciou
            quer distância; o número ao lado fica, para quem for procurar.
          */}
          <span
            className={css.barra}
            data-estado={
              ativo
                ? "ativa"
                : temNaoLidas && !canal.silenciado
                  ? "atencao"
                  : "repouso"
            }
            aria-hidden
          />

          {/* Ícones Phosphor, weight regular, 20px — um set só, sem exceção. */}
          <Icone size={20} className={css.icone} aria-hidden />
          <span className={css.nome}>{canal.name}</span>

          {/*
            Cadeado, sino cortado e teto de sala — os três marcadores que o
            design põe depois do nome.

            Todos com `sr-only` ao lado, e não `aria-label` no ícone: o ícone
            está dentro de um botão que já tem nome acessível, e um `label`
            aninhado não é anunciado. O texto é o que chega ao leitor.
          */}
          {canal.privado ? (
            <span className={css.marcador}>
              <Lock size={20} aria-hidden />
              <span className="sr-only">canal restrito</span>
            </span>
          ) : null}

          {canal.silenciado ? (
            <span className={css.marcador}>
              <BellSimpleSlash size={20} aria-hidden />
              <span className="sr-only">silenciado</span>
            </span>
          ) : null}

          {canal.tipo === "voz" && canal.limite !== undefined ? (
            <TetoDaSala channelId={id} limite={canal.limite} />
          ) : null}

          {/*
            Silenciado mantém a CONTAGEM e perde o realce.

            Quem silencia quer parar de ser chamado, não parar de saber.
            Esconder o número seria decidir pela pessoa que aquele canal deixou
            de existir — e ela silenciou justamente porque ele continua
            existindo e ela quer olhar na hora dela.
          */}
          {canal.mencoes > 0 ? (
            <span className={css.contador} data-silenciado={canal.silenciado}>
              {contagem(canal.mencoes)}
            </span>
          ) : null}

          {/*
            O ponto é decoração; o dado é este texto.

            Peso da fonte e um círculo de 8px não existem para leitor de tela,
            e "não lido" é justamente o estado que decide onde a pessoa clica.
          */}
        {temNaoLidas ? (
          <span className="sr-only">
            {rotuloDeNaoLidas(canal.naoLidas, canal.mencoes)}
          </span>
        ) : null}
        </button>

      </ContextMenuTrigger>

      <ContextMenuContent>
        {/* Regra do briefing: ação que a pessoa não pode executar não é
            renderizada. Ver `sdk/permissoes.ts`. */}
        <ContextMenuItem
          onSelect={() => marcarCanalLido(id)}
          disabled={!temNaoLidas || !pode(id, "marcarLida")}
        >
          <Check size={20} aria-hidden />
          Marcar como lida
        </ContextMenuItem>

        {/* Silenciar é preferência de LEITURA, não permissão: qualquer pessoa
            pode silenciar qualquer canal que enxerga. */}
        <ContextMenuItem onSelect={() => alternarSilencio(id)}>
          {canal.silenciado ? (
            <BellSimple size={20} aria-hidden />
          ) : (
            <BellSimpleSlash size={20} aria-hidden />
          )}
          {canal.silenciado ? "Reativar avisos" : "Silenciar canal"}
        </ContextMenuItem>

        {/*
          Daqui para baixo é administração, e cada item só existe se a pessoa
          PODE. Não é `disabled`: um item cinza ensina que a ação existe e que
          você não a tem, o que é ruído permanente para quem nunca vai tê-la.
          A regra do briefing é não RENDERIZAR.
        */}
        {canal.tipo === "voz" ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => void entrarNaChamada(id)}>
              <SpeakerHigh size={20} aria-hidden />
              Entrar na sala
            </ContextMenuItem>
          </>
        ) : null}

        {pode(id, "criarConvite") ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => administrar({ tipo: "convite", channelId: id })}
            >
              <LinkSimple size={20} aria-hidden />
              Criar convite
            </ContextMenuItem>
          </>
        ) : null}

        {pode(id, "gerenciarCanais") ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => administrar({ tipo: "editarCanal", channelId: id })}
            >
              <PencilSimple size={20} aria-hidden />
              Editar canal
            </ContextMenuItem>
            <ContextMenuItem
              perigo
              onSelect={() => administrar({ tipo: "apagarCanal", channelId: id })}
            >
              <Trash size={20} aria-hidden />
              Apagar canal
            </ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>

          {/*
            As ações da linha, do design — visíveis no hover e no canal ativo.

            ⚠ **Fora do `<button>` da linha, e isso não é escolha de estilo:**
            botão dentro de botão é HTML inválido, o navegador reestrutura a
            árvore sozinho e o clique interno passa a acionar os dois. Elas são
            irmãs da linha e se posicionam sobre ela.

            `visibility` e nunca `opacity`: com opacidade zero os alvos
            continuariam recebendo TABULAÇÃO — numa coluna de quarenta canais
            seriam oitenta paradas invisíveis antes de chegar ao rodapé. É a
            mesma regra da barra de ações da mensagem.
          */}
          <span className={css.acoesDaLinha}>
            {podeConvidar ? (
              <button
                type="button"
                className={css.acaoDaLinha}
                aria-label={`Criar convite para ${canal.name}`}
                onClick={() => administrar({ tipo: "convite", channelId: id })}
              >
                <UserPlus size={20} aria-hidden />
              </button>
            ) : null}

            {/* Desenhado sem implementação — ver `pendente/pendencias.ts`. */}
            <button
              type="button"
              className={css.acaoDaLinha}
              aria-label={`Criar tópico em ${canal.name}`}
              onClick={aindaNao("criarTopico")}
            >
              <Plus size={20} aria-hidden />
            </button>
          </span>
    </div>

    {/* A sala pendura no CANAL, não na categoria: só o canal sabe o próprio
        tipo, e montar `Sala` em canal de texto criaria um efeito Solid por
        canal que nunca dispararia. Fora do `ContextMenu` de propósito: ela
        tem alvos próprios, e herdar o menu do canal daria "Marcar como lida"
        ao clicar com o direito numa pessoa. */}
    {canal.tipo === "voz" ? <Sala channelId={id} serverId={serverId} /> : null}
    </>
  );
});

/**
 * Uma pessoa DENTRO da sala. Assina a si mesma.
 *
 * Reusa a chave composta de membro: quem está na sala é membro do servidor, e
 * o nome que vale ali é o apelido daquele servidor — não o username global.
 * O trabalho da feature anterior aparece de graça aqui.
 */
const NaSala = memo(function NaSala({
  serverId,
  participante,
}: {
  serverId: string;
  participante: ParticipanteDeVoz;
}) {
  const membro = useMembro(chaveDeMembro(serverId, participante.userId));
  const Icone = ICONE_DE_VOZ[participante.estado];

  return (
    <li className={css.naSala}>
      <Avatar
        id={participante.userId}
        sigla={membro?.sigla}
        tamanho="xs"
        className={css.avatarDeVoz}
      />
      {/*
        ⚠ **SEM cor de cargo aqui, e a ausência é do design.**

        Medido nos dois lugares dele: `Marina` sai `#7EE3E9` na lista de
        membros e `#E6EAF0` na sala de voz. A member list responde "quem é
        quem neste servidor", onde hierarquia é o dado; a sala responde "quem
        está aqui agora", onde ela não é. Colorir por cargo numa lista de três
        pessoas transforma presença em organograma.
      */}
      <span className={css.nomeNaSala}>
        {membro?.displayName ?? participante.userId}
      </span>
      {/*
        Tela e câmera ganham ícone; voz simples não ganha nada.

        Um ícone em cada linha viraria ruído numa sala cheia, e "está aqui
        ouvindo" é o caso comum — o padrão não precisa de marca. O rótulo
        acompanha porque estado nunca é só forma.
      */}
      {participante.estado !== "voz" ? (
        <>
          <Icone size={20} aria-hidden className={css.estadoDeVoz} />
          <span className="sr-only">
            {participante.estado === "tela"
              ? "compartilhando a tela"
              : "com a câmera ligada"}
          </span>
        </>
      ) : null}
    </li>
  );
});

/**
 * A sala de um canal de voz.
 *
 * É isto que separa sala de chamada: a linha do canal deixa de ser um botão de
 * ligar e passa a mostrar quem está lá dentro — visível ANTES de entrar,
 * porque o protocolo entrega `Ready.voice_states` no login.
 *
 * Sala vazia não renderiza nada. Um cabeçalho "ninguém aqui" em cada canal de
 * voz gastaria altura permanente da coluna para dizer que não há nada — e a
 * ausência já é visível pela linha sozinha.
 */
/**
 * "3/8" — quantos estão na sala, e quantos cabem.
 *
 * ⚠ **Componente próprio porque ele assina a SALA, e a linha do canal não.**
 * Alguém entrando numa chamada movimentada publica `vozPorCanal` daquele
 * canal; se a contagem morasse no corpo de `Canal`, cada entrada e saída
 * re-renderizaria a linha inteira — ícone, nome, contador, menu de contexto e
 * as duas ações do hover. Aqui acorda um `<span>`.
 *
 * `memo` sobre a linha do canal não protegeria disto: o hook estaria DENTRO
 * dela, e memo não impede re-render causado pela própria subscrição.
 */
const TetoDaSala = memo(function TetoDaSala({
  channelId,
  limite,
}: {
  channelId: string;
  limite: number;
}) {
  const dentro = useVozDoCanal(channelId);

  return (
    <span className={css.teto} data-cheia={dentro.length >= limite}>
      {dentro.length}/{limite}
      <span className="sr-only">
        {` na sala, de ${limite} lugares`}
      </span>
    </span>
  );
});

const Sala = memo(function Sala({
  channelId,
  serverId,
}: {
  channelId: string;
  serverId: string;
}) {
  const dentro = useVozDoCanal(channelId);
  if (dentro.length === 0) return null;

  return (
    <ul className={css.sala}>
      {dentro.map((p) => (
        <NaSala key={p.userId} serverId={serverId} participante={p} />
      ))}
    </ul>
  );
});

/**
 * Uma categoria, com os canais dela.
 *
 * O cabeçalho é um `<button>` de verdade e não um `<div>` com `onClick`:
 * colapsar é ação, e ação precisa alcançar quem navega por teclado. `aria-expanded`
 * é o que diz ao leitor de tela que aquilo abre e fecha — sem ele, o botão
 * anuncia um nome e nenhum estado.
 *
 * A categoria padrão não tem título e por isso não tem cabeçalho: os canais
 * fora de grupo aparecem soltos no topo. Colapsar "nada" não faria sentido, e
 * inventar um rótulo criaria um grupo que o servidor não tem.
 */
const Categoria = memo(function Categoria({
  categoria,
  serverId,
  canalAtivo,
}: {
  categoria: CategoriaDeCanais;
  serverId: string;
  canalAtivo: string;
}) {
  const colapsada = useColapso(categoria.id);
  const temCabecalho = categoria.titulo !== undefined;
  /*
    A permissão é do CANAL no protocolo, e categoria não é canal — ela nem é
    entidade lá, é um campo do servidor. Pergunto pelo primeiro canal dela, que
    é o alvo mais próximo que existe; categoria vazia cai no `""` e a resposta
    é negativa, que é o lado seguro.
  */
  const podeGerenciar = pode(categoria.canais[0] ?? "", "gerenciarCanais");
  const mostrar = !temCabecalho || !colapsada;

  return (
    <div className={css.categoria}>
      {temCabecalho ? (
        /*
          O cabeçalho da categoria carrega o menu dela.

          Botão direito e não um "…" visível: a coluna é o índice do servidor e
          a pessoa passa o olho por ela dezenas de vezes por dia — um alvo
          permanente por categoria seria ruído constante por uma ação que
          acontece uma vez por mês.
        */
        <>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              className={css.secao}
              aria-expanded={!colapsada}
              onClick={() => alternarColapso(categoria.id)}
            >
              <CaretRight
                size={20}
                aria-hidden
                className={css.chevron}
                data-aberta={!colapsada}
              />
              <span className={css.tituloDaSecao}>{categoria.titulo}</span>
            </button>
          </ContextMenuTrigger>

          <ContextMenuContent>
            {podeGerenciar ? (
              <>
                <ContextMenuItem
                  onSelect={() =>
                    administrar({
                      tipo: "criarCanal",
                      serverId,
                      categoriaId: categoria.id,
                      voz: false,
                    })
                  }
                >
                  <Plus size={20} aria-hidden />
                  Novo canal aqui
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() =>
                    administrar({
                      tipo: "renomearCategoria",
                      serverId,
                      categoriaId: categoria.id,
                    })
                  }
                >
                  <PencilSimple size={20} aria-hidden />
                  Renomear categoria
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  perigo
                  onSelect={() =>
                    administrar({
                      tipo: "apagarCategoria",
                      serverId,
                      categoriaId: categoria.id,
                    })
                  }
                >
                  <Trash size={20} aria-hidden />
                  Apagar categoria
                </ContextMenuItem>
              </>
            ) : (
              /*
                Sem permissão o menu não fica VAZIO — um menu que abre sem nada
                dentro parece quebrado. Colapsar já está no clique; aqui ele
                vira o item que justifica o menu existir.
              */
              <ContextMenuItem onSelect={() => alternarColapso(categoria.id)}>
                <CaretRight size={20} aria-hidden />
                {colapsada ? "Expandir" : "Recolher"}
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/*
          O `+` da categoria — do design, e ele é o caminho CURTO.

          A ação já existia no menu de contexto, atrás de um clique com o botão
          direito, que é a afordância que menos gente descobre. Aqui ela fica
          no lugar onde a pessoa procura: ao lado do grupo onde o canal vai
          nascer, e já com a categoria decidida.

          Irmão do botão de colapsar e não filho: botão dentro de botão é HTML
          inválido, e o navegador reestrutura a árvore sozinho.
        */}
        {podeGerenciar ? (
          <button
            type="button"
            className={css.adicionarNaSecao}
            aria-label={`Novo canal em ${categoria.titulo ?? "categoria"}`}
            onClick={() =>
              administrar({
                tipo: "criarCanal",
                serverId,
                categoriaId: categoria.id,
                voz: false,
              })
            }
          >
            <Plus size={20} aria-hidden />
          </button>
        ) : null}
        </>
      ) : null}

      {/*
        A sala NÃO é montada aqui — quem a monta é o `Canal`, que é o único
        que sabe o próprio tipo.

        Esta linha já montou uma segunda cópia, e o resultado era cada
        ocupante aparecendo duas vezes em toda sala de voz. Aconteceu porque
        dois comentários deste mesmo arquivo reivindicavam a posse, cada um
        afirmando ser o dono — e nada falhou: `Sala` é idempotente, então o
        bug só existia na tela.
      */}
      {mostrar
        ? categoria.canais.map((id) => (
            <Canal
              key={id}
              id={id}
              serverId={serverId}
              ativo={id === canalAtivo}
            />
          ))
        : null}
    </div>
  );
});

/**
 * A lista de canais do servidor ativo.
 *
 * A separação texto/voz é derivada do tipo do canal, não das CATEGORIAS do
 * servidor — o protocolo tem categorias (`server.categories`) e elas são
 * pendência listada, não esquecimento: exigem ordem própria, colapso
 * persistido e arrastar-e-soltar, e nenhum dos três é o que esta coluna
 * precisa provar agora.
 *
 * Como o rail: renderiza IDs, cada linha assina a própria entidade. É a forma
 * que um `useVirtualizer` consome, e o que mantém o retrofit barato quando um
 * servidor com 400 canais aparecer.
 */
/**
 * A coluna do meio do shell.
 *
 * ⚠ **Ela tem DUAS fontes, e isso é a resolução do conflito nº 3 do plano de
 * paridade.** O shell tem três slots e o produto tem nove painéis; uma coluna
 * de conversas separada gastaria um slot e obrigaria a pessoa a trocar painel
 * na mão ao ir para a casa. Aqui é o mesmo painel lendo a navegação — que é
 * como o Discord faz, e custa zero em slots.
 */
export function ListaDeCanais() {
  const local = useLocal();

  /*
    O painel de usuário fica FORA do `if`, e é por isso que ele mora aqui e não
    dentro de cada fonte.

    A coluna tem duas fontes — canais do servidor e conversas da casa — e o
    rodapé é o mesmo nas duas. Montá-lo lá dentro daria duas cópias que
    precisam concordar, e uma delas some no dia em que alguém acrescentar a
    terceira fonte. Aqui ele é estrutura da COLUNA, não conteúdo dela.
  */
  return (
    <div className={css.coluna}>
      {local.tipo !== "servidor" ? <ListaDeConversas /> : <CanaisDoServidor />}

      {/*
        A faixa de voz ACIMA do painel de usuário — a ordem é do design, e ela
        tem razão: a chamada é temporária e a identidade é permanente. O que
        aparece e some fica mais perto do conteúdo; o que está sempre lá é o
        chão da coluna.

        Ela devolve `null` fora da chamada, então a linha do grid colapsa
        sozinha e o rodapé volta a ser só o painel.
      */}
      <FaixaDeVoz />
      <PainelDeUsuario />
    </div>
  );
}

/**
 * O que cada seção de servidor exige para APARECER no menu.
 *
 * `Record` sobre as seções de servidor: seção nova não compila até alguém
 * decidir quem pode vê-la, que é a mesma mecânica de `NOME_DA_SECAO` e do
 * registro de modais.
 *
 * `servidor` é `undefined` de propósito — todo mundo precisa dela, porque é
 * onde mora "sair do servidor". Esconder a visão geral de quem não administra
 * seria prender a pessoa dentro do servidor.
 *
 * Item sem permissão NÃO é renderizado, e não é `disabled`: item cinza ensina
 * que a ação existe e que você não a tem, ruído permanente para quem nunca vai
 * tê-la. É a regra que a etapa de administração já segue.
 */
const PERMISSAO_DA_SECAO: Partial<Record<SecaoId, Acao>> = {
  cargos: "gerenciarServidor",
  convites: "criarConvite",
  banimentos: "banir",
  emojis: "gerenciarServidor",
};

function CanaisDoServidor() {
  const serverId = useServidorAtivo();
  const servidor = useServer(serverId);
  const grupos = useCategorias(serverId);
  const canalAtivo = useCanalAtivo();
  /*
    Pergunto pelo primeiro canal que existir. Servidor sem canal nenhum não tem
    a quem perguntar — e aí `pode("")` responde `false` com servidor presente,
    o que esconderia o botão justamente de quem acabou de criar o servidor.
    `gerenciarServidor` no próprio servidor seria a pergunta certa; enquanto o
    SDK só responde por canal, o dono cai no caminho sem servidor e vê o botão.
  */
  const primeiro = grupos.flatMap((g) => g.canais)[0] ?? "";
  const podeCriar = pode(primeiro, "gerenciarCanais");

  // Já vêm agrupadas e ordenadas do adapter — a coluna não organiza nada no
  // render, porque organizar exigiria ler entidades que ela não assina.
  const vazio = grupos.length === 0;

  if (!serverId) {
    return (
      <div className={css.painel}>
        <EstadoVazio
          compacto
          titulo="Nenhum servidor aberto"
          detalhe="Escolha um na coluna ao lado para ver os canais dele."
        />
      </div>
    );
  }

  return (
    <div className={css.painel}>
      <header className={css.cabecalho}>
        {/*
          ⚠ **A porta que faltava, e a falta era total.**

          `abrirConfig` era chamado em UM lugar do app inteiro — a engrenagem do
          rail, com `abrirConfig("perfil")` e sem `serverId`. E a casca de
          configurações só desenha o grupo de servidor sob `{serverId ? … }`.
          Resultado: visão geral, cargos, convites, banimentos e emojis
          existiam, compilavam, estavam roteadas, e ninguém conseguia chegar
          nelas. Junto ia `sairDoServidor`, que mora dentro da visão geral —
          sair de um servidor era impossível pela interface.

          Este era um `<span>` inerte. É onde toda a categoria põe a porta, e é
          onde a pessoa procura: o nome do lugar é o botão para as opções do
          lugar.

          Construído e inalcançável é pior que ausente — custa manutenção sem
          entregar nada, e de fora as duas coisas são idênticas. A regra que
          sai disto está em `superficies-ausentes.md`: superfície nova precisa
          de porta no MESMO passo, e porta é alvo clicável numa tela que já
          existe, não rota.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={css.servidor}
              aria-label={`Opções de ${servidor?.name ?? "servidor"}`}
            >
              {/* Nome e tag num grupo; a seta fica fora dele e ancora na
                  ponta. Ver `.servidor` e `.identidade`. */}
              <span className={css.identidade}>
                <span className={css.nomeDoServidor}>
                  {servidor?.name ?? "…"}
                </span>

              {/*
                O badge de identificador curto, ao lado do nome — é do design.

                ⚠ **Mostra a SIGLA, não a "tag do servidor" do protocolo.** A
                tag é campo configurável de servidor (`Tag do servidor` nas
                configurações do design) e não existe aqui; a sigla é derivada
                do nome e é verdade sobre ele. Quando a tag existir, ela
                substitui isto sem mexer no layout.
              */}
              {servidor ? (
                  <span className={css.tag} aria-hidden>
                    {servidor.sigla}
                  </span>
                ) : null}
              </span>

              <CaretDown size={20} aria-hidden className={css.divisaDoMenu} />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            {/*
              Criar canal e categoria SAÍRAM do cabeçalho e vieram para cá.

              O design não tem `+` no cabeçalho da coluna — ele tem um por
              CATEGORIA, e o menu do servidor é onde "Criar canal" mora. O
              motivo de o botão existir no cabeçalho continua válido (servidor
              recém-criado não tem categoria de onde partir), e aqui ele
              continua alcançável nesse caso.
            */}
            {podeCriar ? (
              <>
                <DropdownMenuItem
                  onSelect={() =>
                    administrar({
                      tipo: "criarCanal",
                      serverId,
                      categoriaId: undefined,
                      voz: false,
                    })
                  }
                >
                  Criar canal
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => administrar({ tipo: "criarCategoria", serverId })}
                >
                  Criar categoria
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}

            {DE_SERVIDOR.filter((secao) => {
              const exigida = PERMISSAO_DA_SECAO[secao];
              return exigida === undefined || pode(primeiro, exigida);
            }).map((secao) => (
              <DropdownMenuItem
                key={secao}
                onSelect={() => abrirConfig(secao, serverId)}
              >
                {NOME_DA_SECAO[secao]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/*
        A busca é uma LINHA PRÓPRIA, e tem cara de campo — é o design.

        Era um botão apertado no canto do cabeçalho, disputando espaço com o
        nome do servidor. O design lhe dá a largura inteira da coluna logo
        abaixo do nome, o que resolve o problema que a auditoria apontou por
        outro caminho: um recurso que a tese do produto chama de navegação
        primária não pode ser o menor alvo da tela.

        Continua sendo `button` e não `input`. Digitar aqui abriria a paleta e
        jogaria fora o primeiro caractere, ou exigiria um segundo campo
        sincronizado com o de lá — dois donos do mesmo texto. O que ele parece
        é campo; o que ele faz é abrir a paleta, que É um campo.
      */}
      <div className={css.faixaDeBusca}>
        <button
          type="button"
          className={css.busca}
          onClick={abrirPaleta}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <MagnifyingGlass size={20} aria-hidden className={css.lupa} />
          <span className={css.buscaRotulo}>Buscar</span>
          <kbd className={css.tecla} aria-hidden>
            {TECLA_DA_PALETA}
          </kbd>
        </button>
      </div>

      {/* Ver `MessageList`: rolável sem foco é inoperável por teclado. */}
      <div className={css.rolagem} tabIndex={0}>
        {vazio ? (
          <EstadoVazio
            compacto
            titulo="Este servidor não tem canais"
            detalhe="Quem administra o servidor pode criar o primeiro."
          />
        ) : (
          <nav aria-label="Canais">
            {grupos.map((grupo) => (
              <Categoria
                key={grupo.id}
                categoria={grupo}
                serverId={serverId}
                canalAtivo={canalAtivo}
              />
            ))}

            {/*
              "Mostrar N canais ocultos" — a linha que fecha a coluna no design.

              ⚠ **Desenhada sem implementação**, e a pendência `canaisOcultos`
              já existia sem nunca ter tido um alvo na tela. É o caso exato que
              o registro existe para cobrir: clicar diz o que ela fará e do que
              depende, em vez de não fazer nada.

              O número é o dos canais que o SERVIDOR tem e a sessão não recebeu
              — e ele não existe: canal sem permissão de ver não chega ao
              cliente, então não há o que contar. Por isso o rótulo é sem
              número, e é honesto: prometer "6" seria inventar o 6.

              `<button>` e não `<div>`: é ação, e ação precisa alcançar quem
              navega por teclado.
            */}
            <button
              type="button"
              className={css.ocultos}
              onClick={aindaNao("canaisOcultos")}
            >
              Mostrar canais ocultos
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
