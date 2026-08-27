import {
  CaretRight,
  Check,
  Hash,
  MagnifyingGlass,
  Monitor,
  SpeakerHigh,
  VideoCamera,
} from "@phosphor-icons/react";
import { memo } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "../components/ui/ContextMenu";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Lamina } from "../components/ui/Lamina";
import { contagem, rotuloDeNaoLidas } from "../lib/plural";
import { marcarCanalLido } from "../sdk/adapter";
import { pode } from "../sdk/permissoes";
import {
  chaveDeMembro,
  type CategoriaDeCanais,
  type EstadoDeVoz,
  type ParticipanteDeVoz,
} from "../sdk/domain";
import { alternarColapso } from "../store/colapso";
import { abrirPaleta } from "../store/paleta";
import {
  useCanalAtivo,
  useCategorias,
  useCorDeCargo,
  useColapso,
  useChannel,
  useMembro,
  useServer,
  useServidorAtivo,
  useVozDoCanal,
} from "../store/hooks";
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

  const temNaoLidas = canal.naoLidas > 0;
  const Icone = canal.tipo === "voz" ? SpeakerHigh : Hash;

  return (
    <>
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          className={css.canal}
          aria-current={ativo}
          data-naolidas={temNaoLidas}
          onClick={() => selecionarCanal(id)}
        >
          {/*
            A mesma lâmina do rail. Assinatura só é assinatura quando repete —
            um gesto que aparece uma vez é um acidente.

            E aqui ela carrega DUAS coisas, porque a escala comporta as duas
            sem ambiguidade: posição em acento, não lido em cor de texto. É a
            decisão já registrada no briefing — a lâmina marca não lida e NÃO
            marca menção, porque não lida é posicional e menção é contagem. A
            contagem continua ao lado, em número.
          */}
          <Lamina
            estado={ativo ? "ativa" : temNaoLidas ? "atencao" : "repouso"}
            className={css.lamina}
          />

          {/* Ícones Phosphor, weight regular, 20px — um set só, sem exceção. */}
          <Icone size={20} className={css.icone} aria-hidden />
          <span className={css.nome}>{canal.name}</span>

          {canal.mencoes > 0 ? (
            <span className={css.contador}>{contagem(canal.mencoes)}</span>
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
      </ContextMenuContent>
    </ContextMenu>

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
  const corDeCargo = useCorDeCargo(membro?.cor);
  const Icone = ICONE_DE_VOZ[participante.estado];

  return (
    <li className={css.naSala}>
      <span className={css.avatarDeVoz} aria-hidden>
        {membro?.sigla ?? "?"}
      </span>
      <span
        className={css.nomeNaSala}
        style={corDeCargo ? { color: corDeCargo } : undefined}
      >
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
  const mostrar = !temCabecalho || !colapsada;

  return (
    <div className={css.categoria}>
      {temCabecalho ? (
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
          {categoria.titulo}
        </button>
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
export function ListaDeCanais() {
  const serverId = useServidorAtivo();
  const servidor = useServer(serverId);
  const grupos = useCategorias(serverId);
  const canalAtivo = useCanalAtivo();

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
        <span>{servidor?.name ?? "…"}</span>

        {/*
          O único lugar da interface que diz que a paleta existe.

          A tese do produto é "teclado é a navegação primária" e a paleta faz
          isso desde a fase 5 — mas nada na tela contava. Atalho que não se
          anuncia serve a quem já sabe, e a auditoria deu a nota mais baixa do
          relatório justamente aqui: não havia onde DESCOBRIR atalho nenhum.

          Botão de verdade, não texto de dica, e é o que conserta o segundo
          problema junto: um recurso só por teclado é inalcançável em toque.

          O rótulo carrega a tecla porque ensinar é o trabalho dele. Quem
          aprendeu para de clicar, e o botão passa a ser só um lembrete que não
          atrapalha.
        */}
        <button
          type="button"
          className={css.buscar}
          onClick={abrirPaleta}
          aria-keyshortcuts="Control+K Meta+K"
        >
          <MagnifyingGlass size={20} aria-hidden />
          <span className={css.buscarRotulo}>buscar</span>
          <kbd className={css.tecla} aria-hidden>
            {TECLA_DA_PALETA}
          </kbd>
        </button>
      </header>

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
          </nav>
        )}
      </div>
    </div>
  );
}
