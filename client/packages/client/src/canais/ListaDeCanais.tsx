import {
  BellSimpleSlash,
  CaretDown,
  CaretRight,
  Check,
  Hash,
  ICONE,
  Lock,
  MicrophoneSlash,
  Monitor,
  PencilSimple,
  Plus,
  SpeakerHigh,
  SpeakerSlash,
  Trash,
  UserPlus,
  VideoCamera,
} from "../components/ui/icones";
import { memo, useEffect, useState, useSyncExternalStore } from "react";

import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "../components/ui/ContextMenu";
import { despacharMenuEm, MenuDeContexto } from "../components/ui/MenuDeContexto";
import { ItensDoCanal } from "../menus/ItensDoCanal";
import { ItensDoServidor } from "../menus/ItensDoServidor";

import { entrarNaChamada } from "../sdk/chamada";
import { definirPalco } from "../store/palcoDeVoz";
import { ComMenuDoParticipante } from "../voz/MenuDoParticipante";
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { administrar } from "../store/administracao";
import { ListaDeConversas } from "../casa/ListaDeConversas";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { EntradaDeEventos } from "../eventos/EntradaDeEventos";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { usePerfilDoServidor } from "../store/perfilDoServidor";
import { pode, podeNoServidor } from "../sdk/permissoes";
import { atalho } from "../lib/plataforma";
import { marcarCanalLido } from "../sdk/adapter";
import {
  chaveDeMembro,
  type CategoriaDeCanais,
  type EstadoDeVoz,
  type ParticipanteDeVoz,
} from "../sdk/domain";
import { categorias, usuarioLocalId, vozPorCanal } from "../sdk/adapter";
import { moverParaCanalDeVoz } from "../sdk/cargos";
import {
  alvoDoArraste,
  assinarArrasteDeVoz,
  comecarArrasteDeVoz,
  entrarNoAlvo,
  lerArrasteDeVoz,
  nomeArrastado,
  sairDoAlvo,
  terminarArrasteDeVoz,
  TEXTO_DO_VEREDITO,
  useArrastandoAlguem,
  vereditoDeSoltura,
  vereditoDoAlvo,
} from "../store/arrasteDeVoz";
import { assinarColapso, colapsadas, definirColapsoDeTodas, alternarColapso } from "../store/colapso";
import {
  assinarSilencio,
  estaSilenciado,
  silencioAte,
  silencioDoServidorAte,
} from "../store/silencio";
import { abrirPaleta } from "../store/paleta";
import { ItemDeId } from "../components/ui/ItemDeId";
import {
  useCanalAtivo,
  useCategorias,
  useColapso,
  useChannel,
  useForum,
  useMembro,
  useServer,
  useServidorAtivo,
  useVozDoCanal,
  useLocal,
} from "../store/hooks";
import { Avatar } from "../components/ui/Avatar";
import { podeCriarTopico } from "../topicos/acoes";
import {
  alternarOcultarSilenciados,
  assinarExibicao,
  ocultaSilenciados,
} from "../store/exibicaoDeCanais";
import { FaixaDeVoz } from "../voz/FaixaDeVoz";
import { selecionarCanal } from "../store/navegacao";
import { Selo } from "../components/ui/Selo";
import { GatilhoDeBusca } from "../components/ui/CampoDeBusca";
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
const TECLA_DA_PALETA = atalho({ mod: true, tecla: "K" });

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

  /*
    Estou conectado NESTA sala?

    ⚠ **Estado que faltava, e ele é diferente de "canal aberto".** No design a
    sala em que você está ganha véu permanente, nome em 600 e o glifo em
    acento — a mesma ênfase do canal ativo, com fundo neutro em vez de tingido,
    porque "estou falando aqui" e "estou lendo aqui" são duas coisas e podem
    acontecer em canais diferentes ao mesmo tempo.

    O getter devolve BOOLEANO, então `useSyncExternalStore` compara por
    `Object.is`: entrar numa chamada acorda duas linhas — a que deixou de ser e
    a que passou a ser — e nenhuma outra. É o mesmo padrão do `ehAlvo` na linha
    de mensagem, e a razão de assinar aqui em vez de no `Sala`: quem muda de
    forma é a LINHA do canal.
  */
  const conectadoAqui = useSyncExternalStore(
    assinarChamada,
    () => lerChamada().channelId === id,
  );

  /*
    O instante de entrada, não a duração — quem conta os segundos é o
    `Cronometro`, e só ele. Ler daqui devolve um número que muda uma vez por
    chamada, então a linha não acorda por causa dele.
  */
  const desdeAqui = useSyncExternalStore(assinarChamada, () => {
    const c = lerChamada();
    return c.channelId === id && c.estado === "dentro" ? c.desde : 0;
  });
  // Fórum e galeria são canal de texto no protocolo; só o `forum` cru diz.
  const forum = useForum(id);

  /*
    ⚠ **O hook fica ACIMA do early return, e a primeira versão não ficava.**

    Havia um `if (!canal) return …` entre `useChannel` e este
    `useSyncExternalStore`: no primeiro render o snapshot ainda não existe, a
    linha volta cedo e chama UM hook; no seguinte ela chama dois. React
    derruba com "Rendered more hooks than during the previous render", e quem
    pegou foi o limite de erro por painel — a coluna inteira virou "o painel de
    canais parou de funcionar".

    Regra das Hooks não é estilo: é a razão pela qual o lint do compiler é
    tratado como erro neste projeto.
  */

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
    <div
      className={css.linhaDeCanal}
      /*
        ⚠ **Os handlers moram no WRAPPER e não no `<button>`.** O botão é o
        filho do `ContextMenuTrigger asChild`, e o Radix funde handlers ali —
        pendurar mais quatro nele é o caminho mais curto para um deles sumir na
        próxima mexida no menu. O wrapper já é o alvo do `:hover` das ações de
        linha, então ele é a caixa da LINHA por definição.

        ⚠ **`dragover` não toca o store**, de propósito: o navegador o dispara
        a cada ~50ms enquanto o ponteiro fica parado. Quem decide é o
        `dragenter`, uma vez; aqui só se lê o veredito já escrito.
      */
      onDragEnter={
        canal.tipo === "voz"
          ? () => {
              const a = lerArrasteDeVoz();
              if (!a || a.deCanal === id) return;
              entrarNoAlvo(
                id,
                vereditoDeSoltura({
                  ocupados: vozPorCanal.getSnapshot(id)?.length ?? 0,
                  limite: canal.limite,
                  podeConectar: pode(id, "conectar"),
                  podeMover: pode(id, "moverMembros"),
                }),
              );
            }
          : undefined
      }
      onDragOver={
        canal.tipo === "voz"
          ? (evento) => {
              if (alvoDoArraste() !== id) return;
              if (vereditoDoAlvo() !== "valido") return;
              /* `preventDefault` é o que diz ao navegador "aqui pode soltar".
                 Sem ele o cursor fica em `not-allowed` e o `drop` não vem —
                 que é exatamente o que queremos nos vereditos de recusa. */
              evento.preventDefault();
              evento.dataTransfer.dropEffect = "move";
            }
          : undefined
      }
      onDragLeave={canal.tipo === "voz" ? () => sairDoAlvo(id) : undefined}
      onDrop={
        canal.tipo === "voz"
          ? (evento) => {
              evento.preventDefault();
              const a = lerArrasteDeVoz();
              const valido = alvoDoArraste() === id && vereditoDoAlvo() === "valido";
              terminarArrasteDeVoz();
              if (!a || !valido) return;
              void moverParaCanalDeVoz(a.serverId, a.userId, id);
            }
          : undefined
      }
    >
    {canal.tipo === "voz" ? <AlvoDeSoltura channelId={id} /> : null}
    <MenuDeContexto
      gatilho={
        <button
          type="button"
          className={css.canal}
          aria-current={ativo}
          data-conectado={conectadoAqui}
          data-naolidas={temNaoLidas && !canal.silenciado}
          data-silenciado={canal.silenciado}
          /*
            Voz ⊥ texto: entrar na sala não troca o canal aberto. A coluna
            de conteúdo é a conversa; a prova da chamada é a faixa e o
            popout. "Abrir o chat" no menu e o título da faixa/popout é
            quem navega, de propósito.
          */
          onClick={() => {
            if (canal.tipo !== "voz") {
              selecionarCanal(id);
              return;
            }
            if (conectadoAqui) {
              definirPalco({ tipo: "grade" });
              return;
            }
            /*
              ⚠ **Sala cheia não TENTA entrar, e antes tentava.** O servidor já
              barra (`voice_join.rs` devolve `CannotJoinCall`), mas o caminho
              até lá é: pedir o nó mais rápido, pedir o token, e só então ouvir
              não — com um toast de erro no fim de uma ida e volta de rede.

              O que ele faz no lugar é o que o design manda: *"continua clicável
              para abrir chat embutido"*. O selo `CHEIO` ao lado já diz por que
              não entrou; abrir a conversa é resposta visível, e não silêncio.

              ⚠ **`ManageChannel` fura o teto no SERVIDOR, e aqui não.**
              `voice_join.rs` isenta quem administra o canal, e a isenção NÃO é
              espelhada — é a mesma decisão já escrita no veredito de soltura
              do arraste: o teto é escolha de quem configurou a sala, e oferecer
              a exceção no alvo que todo mundo clica a transforma no caminho
              normal. Duas regras diferentes para o mesmo teto, uma no clique e
              outra no arraste, seria pior que a divergência contra o servidor.

              Leitura sem assinatura: quem assina a lotação é o `TetoDaSala`, e
              fazer a linha assiná-la a repintaria a cada entrada e saída de
              gente numa sala que ela só nomeia.
            */
            const teto = canal.limite ?? 0;
            if (teto > 0 && (vozPorCanal.getSnapshot(id)?.length ?? 0) >= teto) {
              selecionarCanal(id);
              return;
            }
            void entrarNaChamada(id);
          }}
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
          {/*
            Fórum e galeria com os GLIFOS do design (▤ ▦), não com ícone do set:
            são os mesmos do seletor de tipo no "Criar canal", e o par precisa
            concordar entre a escolha e a coluna.
          */}
          {forum ? (
            <span className={css.glifoDeForum} aria-hidden>
              {forum.midia ? "▦" : "▤"}
            </span>
          ) : (
            <Icone className={css.icone} aria-hidden />
          )}
          <span className={css.nome}>{canal.name}</span>
          {forum && !forum.midia ? <span className={css.etiquetaDeForum}>FÓRUM</span> : null}

          {/*
            Cadeado, sino cortado e teto de sala — os três marcadores que o
            design põe depois do nome.

            Todos com `sr-only` ao lado, e não `aria-label` no ícone: o ícone
            está dentro de um botão que já tem nome acessível, e um `label`
            aninhado não é anunciado. O texto é o que chega ao leitor.
          */}
          {canal.privado ? (
            <span className={css.marcador}>
              <Lock aria-hidden />
              <span className="sr-only">canal restrito</span>
            </span>
          ) : null}

          {/*
            ⚠ **Anuncia o ESTADO, e nunca a ação.** Com o clique entrando na
            sala e o segundo clique abrindo o chat, a tentação é trocar o nome
            acesível para "entrar na sala" / "abrir o chat" — e esse é
            exatamente o erro que o lint pegou nos controles de microfone: um
            rótulo que alterna junto do estado faz o leitor anunciar o
            contrário do que está acontecendo, e some com a identidade do item.

            O nome do botão continua sendo o CANAL. O que muda é saber que você
            já está lá dentro — dado que hoje só existe em `data-conectado`, que
            leitor de tela nenhum lê, e no cronômetro, que é visual.
          */}
          {conectadoAqui ? (
            <span className="sr-only">você está nesta sala</span>
          ) : null}

          {canal.silenciado ? (
            <RestanteDoSilencio channelId={id} serverId={canal.serverId} />
          ) : null}

          {/* Antes do contador, como no design: o cronômetro é sobre VOCÊ e
              a lotação é sobre a sala. */}
          {desdeAqui > 0 ? <Cronometro desde={desdeAqui} /> : null}

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
            <Selo
              forma="contagem"
              tom="perigo"
              className={css.contador}
              data-silenciado={canal.silenciado}
            >
              {contagem(canal.mencoes)}
            </Selo>
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

      }
    >
      <ItensDoCanal channelId={id} />
    </MenuDeContexto>

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
                <UserPlus aria-hidden />
              </button>
            ) : null}

            {/*
              O `+` da linha abre o que o canal tem por assunto: tópico num canal
              de texto, post num fórum, mídia numa galeria. Nenhum em sala de
              voz — o protocolo não aceita tópico lá, e alvo que o servidor
              recusaria não é renderizado.
            */}
            {podeCriarTopico(id) ? (
              <button
                type="button"
                className={css.acaoDaLinha}
                aria-label={`Criar tópico em ${canal.name}`}
                onClick={() =>
                  administrar({ tipo: "criarTopico", channelId: id, mensagemId: undefined })
                }
              >
                <Plus aria-hidden />
              </button>
            ) : forum && pode(id, "enviar") ? (
              <button
                type="button"
                className={css.acaoDaLinha}
                aria-label={forum.midia ? `Enviar mídia em ${canal.name}` : `Novo post em ${canal.name}`}
                onClick={() =>
                  administrar({ tipo: forum.midia ? "enviarMidia" : "novoPost", forumId: id })
                }
              >
                <Plus aria-hidden />
              </button>
            ) : null}
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
  channelId,
  participante,
}: {
  serverId: string;
  channelId: string;
  participante: ParticipanteDeVoz;
}) {
  const membro = useMembro(chaveDeMembro(serverId, participante.userId));
  const Icone = ICONE_DE_VOZ[participante.estado];

  /*
    ⚠ **Só quem tem "Mover membros" arrasta, e é instrução do design.** Sem a
    condição, todo mundo poderia começar um arraste que só o servidor
    recusaria — e um gesto que parece funcionar e volta 403 é pior que um
    gesto que não começa.

    `abaixoDeMim` é a mesma hierarquia que o servidor confere (`NotElevated`),
    e a mesma que o menu do participante já usa. Você não se arrasta: mover-se
    é entrar no outro canal, que é um clique.
  */
  const podeArrastar =
    serverId !== "" &&
    participante.userId !== usuarioLocalId() &&
    membro?.abaixoDeMim === true &&
    pode(channelId, "moverMembros");

  /*
    ⚠ **Quem está falando AGORA — e a coluna nunca soube disso.**

    O store efêmero de fala existe desde a etapa de voz, com throttle de 120ms
    na fronteira, e tinha um único consumidor: o cartão flutuante de chamada.
    Aqui a linha mostrava todo mundo igual.

    A subscrição é por USUÁRIO, que é a granularidade que o `CLAUDE.md`
    manda: alguém começar a falar acorda ESTA linha e mais nada — nem a sala,
    nem a coluna, nem a lista. É a mesma forma do `CartaoDeChamada`.

    ⚠ Aqui a fala muda o NOME também (peso e cor), não só o anel, então o
    re-render é da linha inteira e não de um `<span>`. É o que o design pede,
    e o teto é o número de pessoas na sala — dezenas, não milhares.
  */
  const falandoAgora = useSyncExternalStore(
    falando.subscriber(participante.userId),
    () => falando.getSnapshot(participante.userId) ?? false,
  );

  return (
    <li
      className={css.naSala}
      data-falando={falandoAgora}
      data-participante={participante.userId}
      data-arrastavel={podeArrastar}
      draggable={podeArrastar}
      onDragStart={(evento) => {
        /*
          ⚠ **O `setData` não é cerimônia:** sem uma carga o Firefox nem
          inicia o arraste. O que vale é o store — o `dataTransfer` só
          atravessa o processo do navegador, e o que precisamos (servidor,
          sala de origem, nome) não cabe numa string sem virar um segundo
          formato para manter em dia.
        */
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", participante.userId);
        comecarArrasteDeVoz({
          userId: participante.userId,
          serverId,
          nome: membro?.displayName ?? participante.userId,
          deCanal: channelId,
        });
      }}
      /* Soltar fora de qualquer alvo também termina — `dragend` é o único
         evento que chega nos dois casos, inclusive no Esc durante o arraste. */
      onDragEnd={() => terminarArrasteDeVoz()}
    >
      <Avatar
        id={participante.userId}
        sigla={membro?.sigla}
        url={membro?.avatarUrl}
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
      {/* O anel é visual; para quem não vê, o texto é o que carrega o estado.
          Presença e fala nunca só por cor ou forma. */}
      {falandoAgora ? <span className="sr-only">falando</span> : null}
      {/*
        Tela e câmera ganham ícone; voz simples não ganha nada.

        Um ícone em cada linha viraria ruído numa sala cheia, e "está aqui
        ouvindo" é o caso comum — o padrão não precisa de marca. O rótulo
        acompanha porque estado nunca é só forma.
      */}
      {/*
        ⚠ **Transmitindo vira o selo LIVE, e não o glifo ◧.**

        O design põe o selo exatamente nesta posição da linha (`rgba(232,89,107,
        0.2)` atrás de `#F0808D`, 9/700), e a razão de ele ganhar do glifo é de
        legibilidade: numa coluna de 232px, `LIVE` se lê sem conhecer a
        convenção e `◧` obriga a consultar a legenda.

        ⚠ **E "LIVE" aqui significa TRANSMITINDO, não "com espectadores".** A
        legenda do design escreve "stream com espectadores", e essa contagem
        não existe: `UserVoiceState` tem `screensharing` e nada sobre quem
        assiste, e o `livekit-client` só conhece as assinaturas da PRÓPRIA
        conexão. Contar espectadores é webhook do LiveKit → serviço `api` →
        campo novo, ou seja fork de backend. A divergência está registrada no
        `CLAUDE.md`; o que o selo afirma é verdade sobre o dado que existe.
      */}
      {participante.estado === "tela" ? (
        <Selo forma="etiqueta" tom="perigoSuave" className={css.aoVivo}>
          LIVE
          <span className="sr-only"> — compartilhando a tela</span>
        </Selo>
      ) : participante.estado === "video" ? (
        <>
          <Icone aria-hidden className={css.estadoDeVoz} />
          <span className="sr-only">com a câmera ligada</span>
        </>
      ) : null}

      {/*
        Mudo e surdo, DEPOIS do estado — e podem aparecer junto com ele.

        ⚠ Eles não entram na união `estado` de propósito: estado é o que a
        pessoa está PUBLICANDO (voz, vídeo, tela) e é excludente; mudo e surdo
        são modificadores. Dá para estar compartilhando a tela e mudo ao mesmo
        tempo, e uma união só não representaria isso.

        Surdo IMPLICA mudo no protocolo — quem não ouve também não fala —,
        então mostrar os dois seria dizer a mesma coisa duas vezes numa linha
        de 205px. O fone ganha, porque é o estado maior.
      */}
      {/*
        SRV — silenciado POR ORDEM do servidor.

        ⚠ **AVISO e não perigo, e eu tinha errado.** A referência e o design
        escrevem os dois em `#E2B15C`, e o âmbar é o certo: vermelho é falha
        ou destruição, e não poder falar num servidor é RESTRIÇÃO
        administrativa — a mesma razão pela qual a faixa de voz instável
        deixou de ser vermelha nesta mesma tela.

        **Glifo mais sigla**, e não a sigla sozinha. O ícone diz "microfone" de
        relance e as três letras dizem QUEM desligou; sozinha, a sigla obriga
        a conhecer a convenção antes de entender a linha.

        Vem ANTES do microfone comum e aparece JUNTO com ele: são fatos
        diferentes. "Está sem microfone agora" é escolha que a pessoa desfaz;
        "não pode falar aqui" é decisão de quem modera, e só quem modera
        desfaz. Quem espera resposta reage de forma oposta aos dois.
      */}
      {/*
        ⚠ **Surdo pelo servidor chegava no snapshot e NUNCA era desenhado.**
        `surdoPeloServidor` existe em `ParticipanteDeVoz` desde que o menu do
        participante precisou saber se o item estava marcado — campo lido,
        mapeado e invisível, a mesma família do `statusTexto` da member list.

        Ele vem ANTES do microfone e a sigla `SRV` sai UMA vez mesmo com os
        dois: quem impôs foi o mesmo servidor, e repetir três letras numa linha
        de 232px gastaria largura para dizer o que já está dito.
      */}
      {participante.mudoPeloServidor || participante.surdoPeloServidor ? (
        <>
          {participante.surdoPeloServidor ? (
            <SpeakerSlash aria-hidden className={css.estadoSrv} />
          ) : null}
          {participante.mudoPeloServidor ? (
            <MicrophoneSlash aria-hidden className={css.estadoSrv} />
          ) : null}
          <span className={css.srv} aria-hidden>
            SRV
          </span>
          <span className="sr-only">
            {participante.surdoPeloServidor && participante.mudoPeloServidor
              ? "silenciado e ensurdecido pelo servidor"
              : participante.surdoPeloServidor
                ? "ensurdecido pelo servidor"
                : "silenciado pelo servidor"}
          </span>
        </>
      ) : null}

      {participante.surdo ? (
        <>
          <SpeakerSlash aria-hidden className={css.estadoMudo} />
          <span className="sr-only">sem ouvir</span>
        </>
      ) : participante.mudo ? (
        <>
          <MicrophoneSlash aria-hidden className={css.estadoMudo} />
          <span className="sr-only">com o microfone desligado</span>
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
/**
 * O cronômetro da chamada, no canal em que você está.
 *
 * ⚠ **Componente próprio, e ele é o ÚNICO que acorda por segundo.** Pôr o
 * `setInterval` na linha do canal faria a linha inteira — glifo, nome, selo,
 * contador — re-renderizar sessenta vezes por minuto; pôr os segundos no store
 * da chamada faria acordar todo mundo que a assina, incluindo a faixa e o
 * cartão. É a mesma separação de `falando`: o que muda depressa não mora onde
 * muita gente escuta.
 *
 * Só aparece no canal da chamada, como no design — um cronômetro em cada sala
 * seria uma coluna de relógios contando o tempo dos outros.
 */
const Cronometro = memo(function Cronometro({ desde }: { desde: number }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = Math.max(0, Math.floor((agora - desde) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  const dois = (n: number) => String(n).padStart(2, "0");

  return (
    <span className={css.cronometro}>
      {/* Hora só quando existe: `00:42:17` numa coluna estreita gasta seis
          caracteres para dizer o que quatro dizem na primeira hora. */}
      {h > 0 ? `${String(h)}:${dois(m)}:${dois(seg)}` : `${dois(m)}:${dois(seg)}`}
      <span className="sr-only">{` na chamada`}</span>
    </span>
  );
});

/**
 * O sino, ou o tempo que falta.
 *
 * ⚠ **Componente próprio porque ele acorda por MINUTO.** Pôr o `setInterval`
 * na linha do canal faria glifo, nome, selo e contador re-renderizarem junto;
 * é a mesma separação do `Cronometro` e de `falando`.
 *
 * Um minuto e não um segundo: o rótulo é "7 h" ou "12 min", e nenhum dos dois
 * muda mais rápido que isso — um relógio de segundo aqui seria sessenta
 * acordadas por minuto para escrever o mesmo texto.
 *
 * O design: "silenciado por tempo mostra o restante em mono no lugar do
 * ícone". No lugar, não ao lado — a linha tem 232px e o sino já disse o que o
 * número diz.
 */


const RestanteDoSilencio = memo(function RestanteDoSilencio({
  channelId,
  serverId,
}: {
  channelId: string;
  serverId: string | undefined;
}) {
  /* O prazo do CANAL, senão o do servidor: com o servidor mudo, cada linha
     diz quanto falta para ele voltar, como diria de um silêncio só dela. */
  const ate = useSyncExternalStore(
    assinarSilencio,
    () => silencioAte(channelId) ?? (serverId ? silencioDoServidorAte(serverId) : undefined),
  );
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (ate === undefined || ate === Infinity) return;
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [ate]);

  if (ate === undefined) return null;

  /* Sem prazo: o sino, como sempre foi. "Até eu reativar" não tem número. */
  if (ate === Infinity) {
    return (
      <span className={css.marcador}>
        <BellSimpleSlash aria-hidden />
        <span className="sr-only">silenciado</span>
      </span>
    );
  }

  const min = Math.max(0, Math.ceil((ate - agora) / 60_000));
  const texto = min >= 60 ? `${String(Math.ceil(min / 60))} h` : `${String(min)} min`;

  return (
    <span className={css.restante}>
      {texto}
      <span className="sr-only">{` de silêncio restantes`}</span>
    </span>
  );
});

const TetoDaSala = memo(function TetoDaSala({
  channelId,
  limite,
}: {
  channelId: string;
  limite: number;
}) {
  const dentro = useVozDoCanal(channelId);
  const cheia = dentro.length >= limite;

  return (
    <>
      {/*
        O selo vem ANTES do número, como no design: ele é o veredito e o
        número é a prova. Invertido, o olho lê "4/4" e só depois descobre o
        que isso significa.
      */}
      {cheia ? (
        <Selo
          forma="etiqueta"
          tom="perigoSuave"
          /* A classe é o que a container query de coluna estreita mira para
             escondê-lo — o primitivo dá tom e forma, o consumidor dá o
             comportamento responsivo. Sem ela a regra fica órfã e o selo
             deixa de sair a 180px, que foi o que aconteceu na migração para
             o `Selo` e o que a terceira direção da guarda pegou. */
          className={css.cheio}
          aria-hidden
        >
          CHEIO
        </Selo>
      ) : null}
      <span className={css.teto} data-cheia={cheia}>
        {dentro.length}/{limite}
        <span className="sr-only">
          {cheia
            ? ` na sala — sala cheia, de ${limite} lugares`
            : ` na sala, de ${limite} lugares`}
        </span>
      </span>
    </>
  );
});

/**
 * O canal-alvo durante um arraste — anel, véu e "soltar X aqui".
 *
 * ⚠ **Componente próprio porque ele ASSINA o arraste, e a linha do canal não.**
 * Pôr as duas subscrições no corpo de `Canal` faria toda linha de voz do
 * servidor re-renderizar — glifo, nome, contador, cronômetro, menu e as duas
 * ações de hover — a cada `dragenter`. Aqui acorda um `<span>` que só existe
 * durante o arraste. É a mesma separação do `TetoDaSala` e do `Cronometro`.
 *
 * `arrastando` é booleano e `souOAlvo` também: `useSyncExternalStore` compara
 * por `Object.is`, então entrar num alvo acorda DUAS linhas — a que deixou de
 * ser e a que passou a ser — e nenhuma outra.
 *
 * ⚠ **`pointer-events: none` no overlay.** Sem isso ele vira o alvo dos
 * eventos de arraste e o `dragleave` do wrapper dispara no instante em que o
 * anel aparece, num ciclo que pisca.
 */
const AlvoDeSoltura = memo(function AlvoDeSoltura({
  channelId,
}: {
  channelId: string;
}) {
  const arrastando = useArrastandoAlguem();
  const souOAlvo = useSyncExternalStore(
    assinarArrasteDeVoz,
    () => alvoDoArraste() === channelId,
  );
  const veredicto = useSyncExternalStore(assinarArrasteDeVoz, vereditoDoAlvo);

  if (!arrastando || !souOAlvo) return null;

  /* O nome é lido sem assinar: ele é escrito no mesmo instante em que
     `arrastando` passa a ser verdadeiro, e a subscrição acima já é o que
     acorda este componente. Uma terceira assinatura para um valor que só muda
     junto com a primeira seria trabalho por nada. */
  return (
    <span className={css.alvoDeSoltura} data-veredito={veredicto} aria-hidden>
      {TEXTO_DO_VEREDITO[veredicto](nomeArrastado())}
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
    /*
      UM menu por SALA, e não por pessoa: é o padrão do Root no nível da
      lista. A sala só existe com gente dentro, então quem paga o Root são
      as salas ocupadas — dezenas no pior caso, e nunca uma por linha.
    */
    <ComMenuDoParticipante channelId={channelId}>
      <ul className={css.sala}>
        {dentro.map((p) => (
          <NaSala
            key={p.userId}
            serverId={serverId}
            channelId={channelId}
            participante={p}
          />
        ))}
      </ul>
    </ComMenuDoParticipante>
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
  /*
    Assina o conjunto inteiro para saber se ainda há alguma aberta — é o que
    decide o VERBO do item "todas". `colapsadas()` devolve a referência
    cacheada do store, então isto não aloca por render.
  */
  const conjunto = useSyncExternalStore(assinarColapso, colapsadas);
  const todasColapsadas =
    (categorias.getSnapshot(serverId) ?? [])
      .filter((c) => c.titulo !== undefined)
      .every((c) => conjunto.has(c.id));
  const temCabecalho = categoria.titulo !== undefined;
  /*
    A permissão é do CANAL no protocolo, e categoria não é canal — ela nem é
    entidade lá, é um campo do servidor. Pergunto pelo primeiro canal dela, que
    é o alvo mais próximo que existe, porque uma sobrescrita por canal só
    aparece ali.

    ⚠ **Categoria VAZIA caía no `pode("")`, que é `false`, e o menu ficava sem
    ação nenhuma para quem administra o servidor.** Era o pior lugar para isso
    acontecer: categoria sem canal é exatamente onde a única coisa a fazer é
    criar o primeiro. Sem canal não há sobrescrita possível, então perguntar
    ao SERVIDOR é a resposta certa e não um contorno.
  */
  const primeiro = categoria.canais[0];
  const podeGerenciar =
    primeiro === undefined
      ? podeNoServidor(serverId, "gerenciarCanais")
      : pode(primeiro, "gerenciarCanais");
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
        <MenuDeContexto
          gatilho={
            <button
              type="button"
              className={css.secao}
              aria-expanded={!colapsada}
              onClick={() => alternarColapso(categoria.id)}
            >
              <CaretRight
                aria-hidden
                className={css.chevron}
                data-aberta={!colapsada}
              />
              <span className={css.tituloDaSecao}>{categoria.titulo}</span>
            </button>
          }
        >
          <ContextMenuContent>
            {/*
              ⚠ **"Marcar como lida" faltava, e a categoria é onde ela mais
              paga.** O item existe no canal desde sempre; numa categoria de
              quinze canais, zerá-los um a um são quinze menus abertos. É item
              do design, e não pede permissão nenhuma — ler o que já está na
              sua tela não é ação de servidor.

              ⚠ **Silenciar categoria NÃO entra, e a razão é de plumbing.** Ela
              pediria um TERCEIRO elo na cadeia do silêncio, e `estaMudo`, que
              responde "este canal está mudo?" ao rollup e ao realce da coluna,
              não recebe a categoria — o silêncio existiria no menu e não
              valeria em lugar nenhum. Ver `menus/silenciar.ts`.
            */}
            <ContextMenuItem
              onSelect={() => {
                for (const id of categoria.canais) marcarCanalLido(id);
              }}
              disabled={categoria.canais.length === 0}
            >
              <Check size={ICONE.calha} aria-hidden />
              Marcar categoria como lida
            </ContextMenuItem>

            <ContextMenuSeparator />

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
                  <Plus size={ICONE.calha} aria-hidden />
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
                  <PencilSimple size={ICONE.calha} aria-hidden />
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
                  <Trash size={ICONE.calha} aria-hidden />
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
                <CaretRight size={ICONE.calha} aria-hidden />
                {colapsada ? "Expandir" : "Recolher"}
              </ContextMenuItem>
            )}

            {/*
              ⚠ **"Todas" lê a lista no CLIQUE, e não por prop.**

              Este componente é `memo` e vive numa coluna que pode ter dezenas
              de categorias; receber o array das irmãs como prop o
              re-renderizaria toda vez que a identidade dele mudasse, que é a
              cada publicação do servidor. Ler no handler custa uma chamada por
              clique e zero por render.

              O VERBO sai do estado atual: se há alguma aberta, o gesto é
              fechar; se todas já estão fechadas, é abrir. Um item que diz
              "Colapsar todas" quando não há nada aberto seria um alvo que não
              faz nada.
            */}
            <ContextMenuItem
              onSelect={() => {
                const todas = categorias
                  .getSnapshot(serverId)
                  ?.filter((c) => c.titulo !== undefined);
                if (!todas || todas.length === 0) return;
                const ids = todas.map((c) => c.id);
                definirColapsoDeTodas(ids, !todasColapsadas);
              }}
            >
              <CaretRight size={ICONE.calha} aria-hidden />
              {todasColapsadas ? "Expandir todas" : "Recolher todas"}
            </ContextMenuItem>

            <ItemDeId id={categoria.id} />
          </ContextMenuContent>
        </MenuDeContexto>

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
            <Plus aria-hidden />
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

  return (
    <div className={css.coluna}>
      {local.tipo !== "servidor" && local.tipo !== "eventos" ? (
        <ListaDeConversas />
      ) : (
        <CanaisDoServidor />
      )}
      <FaixaDeVoz />
    </div>
  );
}


function CanaisDoServidor() {
  const serverId = useServidorAtivo();
  const servidor = useServer(serverId);
  /* Tag do servidor (do fork): substitui a sigla e é onde cada um a liga. */
  const perfil = usePerfilDoServidor(serverId);
  const grupos = useCategorias(serverId);
  const canalAtivo = useCanalAtivo();
  /*
    Pergunto pelo primeiro canal que existir, porque sobrescrita por canal só
    aparece ali.

    ⚠ **Servidor sem canal nenhum caía no `pode("")`, que é `false`**, e isso
    escondia as ações de criar justamente de quem acabou de criar o servidor —
    o comentário anterior descrevia o beco e terminava com "enquanto o SDK só
    responde por canal". Ele responde por servidor também, e `podeNoServidor`
    é a pergunta certa quando não há canal a que perguntar.
  */
  const primeiro = grupos.flatMap((g) => g.canais)[0];
  const podeCriar =
    primeiro === undefined
      ? podeNoServidor(serverId, "gerenciarCanais")
      : pode(primeiro, "gerenciarCanais");

  /*
    Categoria vazia aparece só para quem pode criar canal nela.

    ⚠ **A decisão mudou de lugar, e a mudança conserta um beco.** O filtro
    morava no adapter, que também é quem o modal de "criar canal" consulta
    para escolher o destino — então uma categoria recém-criada era invisível
    para os DOIS, e o modal respondia "crie a primeira categoria" a quem
    tinha acabado de criar uma.

    A razão original continua valendo e continua aplicada: para quem não
    administra, um cabeçalho sem nada embaixo é ou ruído ou a pista de que
    existe canal ali que essa pessoa não pode ver. Para quem administra, é o
    lugar onde o próximo canal vai.
  */
  const semVazias = podeCriar
    ? grupos
    : grupos.filter((g) => g.canais.length > 0);

  /*
    Esconder os silenciados — "Ocultar canais silenciados" no menu do servidor.

    ⚠ **Uma subscrição para a coluna inteira, e não uma por canal.** `silencio.ts`
    tem um emitter só; ler o estado de cada canal aqui exigiria a coluna assinar
    dezenas de entidades, que é o oposto da lei nº 1. Silenciar é ação humana
    rara, então acordar a coluna toda quando alguém silencia é o custo certo.

    ⚠ **O canal ABERTO nunca some**, e é a única exceção. Silenciar o canal que
    você está lendo com a preferência ligada faria a coluna engolir o item
    marcado como ativo — a lista deixaria de mostrar onde você está, sem erro
    nenhum.
  */
  const ocultar = useSyncExternalStore(assinarExibicao, () =>
    ocultaSilenciados(serverId),
  );
  const quantosOcultos = useSyncExternalStore(assinarSilencio, () =>
    !ocultar
      ? 0
      : semVazias.reduce(
          (n, g) =>
            n +
            g.canais.filter((id) => id !== canalAtivo && estaSilenciado(id))
              .length,
          0,
        ),
  );

  /* Só aloca quando a preferência está LIGADA — no caminho comum a lista
     passa direto, sem cópia por render. */
  const visiveis =
    ocultar && quantosOcultos > 0
      ? semVazias
          .map((g) => ({
            ...g,
            canais: g.canais.filter(
              (id) => id === canalAtivo || !estaSilenciado(id),
            ),
          }))
          .filter((g) => podeCriar || g.canais.length > 0)
      : semVazias;

  // Já vêm agrupadas e ordenadas do adapter — a coluna não organiza nada no
  // render, porque organizar exigiria ler entidades que ela não assina.
  /* Sobre o que se VÊ, não sobre o que existe: para quem não administra, um
     servidor só com categoria vazia não tem canal nenhum na tela. */
  const vazio = visiveis.length === 0;

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
        {/*
          ⚠ **O `▾` abre o MESMO menu do clique direito no ladrilho do rail.**

          Eram dois menus sem um item em comum — ver `menus/ItensDoServidor`. E
          o clique direito AQUI, no cabeçalho, caía no menu do navegador: a
          entidade mais visível da coluna era a única sem menu de contexto.

          `MenuDeContexto` e não `DropdownMenu`: o botão despacha o
          `contextmenu` que o gatilho já escuta — o mesmo arranjo do `⋯` da
          barra de ações da mensagem. Com as duas famílias de primitivo, o
          conteúdo teria de ser escrito duas vezes.
        */}
        <MenuDeContexto
          gatilho={
            <button
              type="button"
              className={css.servidor}
              aria-haspopup="menu"
              aria-label={`Opções de ${servidor?.name ?? "servidor"}`}
              onClick={(e) => despacharMenuEm(e.currentTarget, "abaixo")}
            >
              {/* Nome e tag num grupo; a seta fica fora dele e ancora na
                  ponta. Ver `.servidor` e `.identidade`. */}
              <span className={css.identidade}>
                <span className={css.nomeDoServidor}>
                  {servidor?.name ?? "…"}
                </span>

                {/*
                  O badge de identificador curto, ao lado do nome — é do design.

                  A TAG do servidor quando quem administra escolheu uma (do
                  fork); a SIGLA, derivada do nome, quando não há.
                */}
                {servidor ? (
                  <span className={css.tag} aria-hidden>
                    {perfil.tag ?? servidor.sigla}
                  </span>
                ) : null}
              </span>

              <CaretDown aria-hidden className={css.divisaDoMenu} />
            </button>
          }
        >
          <ItensDoServidor serverId={serverId} />
        </MenuDeContexto>
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
        <GatilhoDeBusca
          denso
          rotulo="Buscar"
          className={css.busca}
          onClick={abrirPaleta}
          aria-keyshortcuts="Control+K Meta+K"
          fim={
            <kbd className={css.tecla} aria-hidden>
              {TECLA_DA_PALETA}
            </kbd>
          }
        />
      </div>

      {/*
        ⚠ **A ÁREA VAZIA da coluna também tem menu, e não tinha.** Clicar com o
        botão direito no espaço abaixo dos canais caía no menu do navegador —
        e é onde a mão vai quando se quer criar algo sem mirar um canal
        específico.

        ⚠ **Isto é adição, não paridade.** A referência tem menu de canal, de
        categoria e de DM, e põe "Criar canal"/"Criar categoria" só no dropdown
        do servidor. A área vazia é caminho a mais para as mesmas três ações,
        pedido por quem usa.

        O canal nasce FORA de categoria (`categoriaId: undefined`) porque é o
        que a posição diz: clicar no vão é o oposto de clicar dentro de uma
        categoria, que já tem "Novo canal aqui".

        Sem permissão o menu não é renderizado — a mesma regra da member list:
        item cinza ensina que a ação existe e que você não a tem, ruído
        permanente para quem nunca vai tê-la.
      */}
      <MenuDeContexto
        desabilitado={!podeCriar}
        gatilho={
          /* Ver `MessageList`: rolável sem foco é inoperável por teclado. */
          <div className={css.rolagem} tabIndex={0}>
        {/* Os eventos agendados — primeira linha da coluna, acima das
            categorias, como no design. Componente próprio: ele assina o
            relógio de minuto, e a coluna inteira não precisa acordar junto. */}
        <EntradaDeEventos serverId={serverId} />
        {vazio ? (
          <EstadoVazio
            compacto
            titulo="Este servidor não tem canais"
            detalhe="Quem administra o servidor pode criar o primeiro."
          />
        ) : (
          <nav aria-label="Canais">
            {visiveis.map((grupo) => (
              <Categoria
                key={grupo.id}
                categoria={grupo}
                serverId={serverId}
                canalAtivo={canalAtivo}
              />
            ))}

            {/*
              "Mostrar N canais ocultos" — a linha que fecha a coluna no design.

              ⚠ **O número é REAL, e por isso a linha só existe quando há o que
              mostrar.** A versão anterior era um pendente sem número, com a
              razão escrita: canal sem permissão de ver não chega ao cliente,
              então não havia o que contar, e prometer "6" seria inventar o 6.
              O que se conta agora é outra coisa e existe de verdade — os
              silenciados que a preferência desta coluna está escondendo.

              ⚠ **Não é "Mostrar todos os canais" do menu.** Aquele item pede o
              que o protocolo não entrega; este desfaz uma escolha de quem
              olha, e desfazê-la aqui é o caminho curto — quem escondeu está
              olhando a coluna, não o menu.

              `<button>` e não `<div>`: é ação, e ação precisa alcançar quem
              navega por teclado.
            */}
            {quantosOcultos > 0 ? (
              <button
                type="button"
                className={css.ocultos}
                onClick={() => alternarOcultarSilenciados(serverId)}
              >
                {quantosOcultos === 1
                  ? "Mostrar 1 canal oculto"
                  : `Mostrar ${String(quantosOcultos)} canais ocultos`}
              </button>
            ) : null}
          </nav>
        )}
          </div>
        }
      >
        <ContextMenuContent>
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
            Criar canal de texto
          </ContextMenuItem>
          <ContextMenuItem
            onSelect={() =>
              administrar({
                tipo: "criarCanal",
                serverId,
                categoriaId: undefined,
                voz: true,
              })
            }
          >
            Criar canal de voz
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => administrar({ tipo: "criarCategoria", serverId })}
          >
            Criar categoria
          </ContextMenuItem>
        </ContextMenuContent>
      </MenuDeContexto>
    </div>
  );
}
