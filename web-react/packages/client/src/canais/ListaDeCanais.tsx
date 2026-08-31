import {
  CaretDown,
  BellSimple,
  BellSimpleSlash,
  CaretRight,
  Check,
  GearSix,
  Hash,
  LinkSimple,
  Lock,
  Monitor,
  PencilSimple,
  Plus,
  MicrophoneSlash,
  SpeakerSlash,
  SpeakerHigh,
  UserPlus,
  Trash,
  VideoCamera,
} from "@phosphor-icons/react";
import { memo, useEffect, useState, useSyncExternalStore } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
import { assinarChamada, falando, lerChamada } from "../store/chamada";
import { administrar } from "../store/administracao";
import { abrirConfigDeCanal } from "../store/config";
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
import {
  alternarSilencio,
  assinarSilencio,
  DURACOES_DE_SILENCIO,
  silencioAte,
} from "../store/silencio";
import { abrirPaleta } from "../store/paleta";
import { ItemDeId } from "../components/ui/ItemDeId";
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
    <div className={css.linhaDeCanal}>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className={css.canal}
          aria-current={ativo}
          data-conectado={conectadoAqui}
          data-naolidas={temNaoLidas && !canal.silenciado}
          data-silenciado={canal.silenciado}
          /*
            ⚠ **Em canal de VOZ o clique ENTRA; o segundo clique abre o chat.**

            A régua anterior era só `selecionarCanal`, e ela seguia a nota do
            design ("continua clicável para abrir o chat embutido"). O que ela
            não resolvia: entrar na sala existia num lugar só, o menu de botão
            direito — a afordância que este projeto já apontou como a que menos
            gente descobre, quando moveu convite e tópico para o hover da linha.
            E por TOQUE não havia caminho nenhum.

            Agora o gesto mais barato faz a ação mais frequente, e o chat
            embutido — que é o que o design pede — fica no clique seguinte, com
            "Abrir o chat" no menu para quem quiser ler sem entrar.

            `conectadoAqui` cobre CONECTANDO também, de propósito: clicar duas
            vezes depressa não deve tentar entrar de novo, e `entrarNaChamada`
            já trataria isso como no-op — o que deixaria o segundo clique sem
            efeito nenhum em vez de abrir o chat.
          */
          onClick={() => {
            if (canal.tipo !== "voz" || conectadoAqui) {
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

          {canal.silenciado ? <RestanteDoSilencio channelId={id} /> : null}

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

        {/*
          Silenciar é preferência de LEITURA, não permissão: qualquer pessoa
          pode silenciar qualquer canal que enxerga.

          ⚠ **Silenciado vira ITEM e não submenu.** Reativar é uma coisa só —
          um submenu com uma opção pede dois gestos para fazer o que um faz, e
          é o tipo de simetria que parece organizada e custa um clique por uso.
        */}
        {canal.silenciado ? (
          <ContextMenuItem onSelect={() => alternarSilencio(id)}>
            <BellSimple size={20} aria-hidden />
            Reativar avisos
          </ContextMenuItem>
        ) : (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <BellSimpleSlash size={20} aria-hidden />
              Silenciar canal
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {DURACOES_DE_SILENCIO.map((d) => (
                <ContextMenuItem
                  key={d.rotulo}
                  onSelect={() => alternarSilencio(id, d.ms)}
                >
                  {d.rotulo}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

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
            {/*
              ⚠ **Existe porque o clique deixou de abrir o chat.** Sem este
              item, ler a conversa de uma sala em que você NÃO está perderia o
              único caminho que tinha — uma capacidade some sem que nada na
              tela diga que ela sumiu, que é o pior jeito de perder uma.
            */}
            <ContextMenuItem onSelect={() => selecionarCanal(id)}>
              <Hash size={20} aria-hidden />
              Abrir o chat
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
            {/*
              ⚠ **Renomear e CONFIGURAR são dois destinos, e o design os
              separa.** O modal de editar resolve o caso de um campo — trocar o
              nome sem sair do lugar. As configurações são quatro telas com
              permissões e exclusão, e enfiá-las num modal repetiria o erro que
              o upstream comete com as 42 páginas dele: nada linkável, voltar
              que não fecha e F5 que cai na inicial.
            */}
            <ContextMenuItem
              onSelect={() => abrirConfigDeCanal("canal", id)}
            >
              <GearSix size={20} aria-hidden />
              Configurações do canal
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

        <ItemDeId id={id} />
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
    <li className={css.naSala} data-falando={falandoAgora}>
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
      {participante.mudoPeloServidor ? (
        <>
          <MicrophoneSlash size={20} aria-hidden className={css.estadoSrv} />
          <span className={css.srv} aria-hidden>
            SRV
          </span>
          <span className="sr-only">silenciado pelo servidor</span>
        </>
      ) : null}

      {participante.surdo ? (
        <>
          <SpeakerSlash size={20} aria-hidden className={css.estadoMudo} />
          <span className="sr-only">sem ouvir</span>
        </>
      ) : participante.mudo ? (
        <>
          <MicrophoneSlash size={20} aria-hidden className={css.estadoMudo} />
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
}: {
  channelId: string;
}) {
  const ate = useSyncExternalStore(assinarSilencio, () => silencioAte(channelId));
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
        <BellSimpleSlash size={20} aria-hidden />
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

            <ItemDeId id={categoria.id} />
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
  acesso: "gerenciarServidor",
  banimentos: "banir",
  seguranca: "gerenciarServidor",
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
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!podeCriar}>
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
        </ContextMenuTrigger>

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
      </ContextMenu>
    </div>
  );
}
