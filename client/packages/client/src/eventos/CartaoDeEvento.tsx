import type { ReactNode } from "react";

import { Avatar } from "../components/ui/Avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import {
  DotsThree,
  Hash,
  Link,
  LinkSimple,
  PencilSimple,
  SpeakerHigh,
  Trash,
} from "../components/ui/icones";
import { copiarTexto } from "../lib/copiar";
import { usuarioLocalId } from "../sdk/adapter";
import { entrarNaChamada } from "../sdk/chamada";
import { chaveDeMembro } from "../sdk/domain";
import {
  alternarInteresse,
  apagarEvento,
  estadoDoEvento,
  quandoCurto,
  ROTULO_DA_REPETICAO,
  type EventoDoServidor,
} from "../sdk/eventos";
import { administrar } from "../store/administracao";
import { useChannel, useMembro } from "../store/hooks";
import { irPara } from "../store/navegacao";
import css from "./Eventos.module.css";

/**
 * Cartão de evento — lista.
 *
 * O mesmo cartão do anúncio e do embed de convite na referência; aqui ele tem
 * um consumidor, a lista, e o detalhe é o painel ao lado. "Ao vivo" troca o
 * horário por um selo e promove "Entrar agora" a ação primária, como a nota
 * do design pede.
 */
export function CartaoDeEvento({
  evento,
  agora,
  selecionado,
  podeGerenciar,
  aoAbrir,
}: {
  evento: EventoDoServidor;
  agora: number;
  selecionado: boolean;
  podeGerenciar: boolean;
  aoAbrir: () => void;
}) {
  const aoVivo = estadoDoEvento(evento, agora) === "aoVivo";
  const eu = usuarioLocalId();
  const interessado = eu !== undefined && evento.interessados.includes(eu);
  const organizador = useMembro(chaveDeMembro(evento.serverId, evento.criadorId));
  const canal = useChannel(evento.local.tipo === "canal" ? evento.local.channelId : "");
  const ehVoz = canal?.tipo === "voz";

  return (
    /*
      `article` com `tabIndex` e não `button`: o cartão CONTÉM botões (interesse,
      compartilhar, menu), e botão dentro de botão é HTML inválido — o
      navegador reestrutura a árvore e o clique interno aciona os dois.
    */
    <article
      className={css.cartao}
      data-aovivo={aoVivo || undefined}
      data-selecionado={selecionado || undefined}
      tabIndex={0}
      aria-label={evento.nome}
      onClick={aoAbrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          aoAbrir();
        }
      }}
    >
      <div className={css.capa}>
        {evento.capaUrl ? <img src={evento.capaUrl} alt="" loading="lazy" /> : "sem capa"}
        {aoVivo ? <span className={css.seloAoVivo}>● AO VIVO</span> : null}
      </div>

      <div className={css.corpoDoCartao}>
        <div className={css.meta}>
          {aoVivo ? (
            <span className={css.quandoAoVivo}>AO VIVO</span>
          ) : (
            <span className={css.quando}>{quandoCurto(evento, agora)}</span>
          )}
          <LugarDoEvento evento={evento} />
          {evento.repeticao ? (
            <span className={css.repeticao}>{ROTULO_DA_REPETICAO[evento.repeticao]}</span>
          ) : null}
        </div>

        <h3 className={css.nomeDoEvento}>{evento.nome}</h3>
        {evento.descricao ? <p className={css.descricao}>{evento.descricao}</p> : null}

        <div className={css.rodapeDoCartao}>
          <div className={css.interessados}>
            <PilhaDeInteressados evento={evento} />
            <span className={css.textoLeve}>
              {evento.interessados.length}{" "}
              {evento.interessados.length === 1 ? "interessado" : "interessados"}
            </span>
          </div>
          <span className={css.textoLeve}>por {organizador?.displayName ?? "…"}</span>

          {/* Os botões param o clique: sem isso, marcar interesse também
              abriria o detalhe, e o foco pularia para longe do botão. */}
          <div className={css.acoes} onClick={(e) => e.stopPropagation()}>
            {aoVivo ? (
              <button
                type="button"
                className={css.botaoDeCartao}
                data-tom="entrar"
                onClick={() => entrarNoEvento(evento, ehVoz)}
              >
                Entrar agora
              </button>
            ) : (
              <BotaoDeInteresse evento={evento} interessado={interessado} />
            )}
            <button
              type="button"
              className={css.botaoDeCartao}
              onClick={() => void copiarTexto(linkDosEventos(evento.serverId), "Link")}
            >
              Compartilhar
            </button>
            <MenuDoEvento evento={evento} podeGerenciar={podeGerenciar} eu={eu} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function BotaoDeInteresse({
  evento,
  interessado,
}: {
  evento: EventoDoServidor;
  interessado: boolean;
}) {
  return (
    <button
      type="button"
      className={css.botaoDeCartao}
      data-tom={interessado ? "interessado" : "interesse"}
      aria-pressed={interessado}
      onClick={() => void alternarInteresse(evento.id, usuarioLocalId())}
    >
      {interessado ? "✓ Tenho interesse" : "Tenho interesse"}
    </button>
  );
}

/** O ícone e o nome do lugar. Canal assinado aqui, só por quem o mostra. */
export function LugarDoEvento({
  evento,
  className = css.lugar,
}: {
  evento: EventoDoServidor;
  className?: string;
}) {
  const channelId = evento.local.tipo === "canal" ? evento.local.channelId : "";
  const canal = useChannel(channelId);
  let icone: ReactNode;
  let nome: string;
  if (evento.local.tipo === "externo") {
    icone = <LinkSimple aria-hidden />;
    nome = hostDe(evento.local.url);
  } else if (canal?.tipo === "voz") {
    icone = <SpeakerHigh aria-hidden />;
    nome = canal.name;
  } else {
    icone = <Hash aria-hidden />;
    nome = canal ? canal.name : "canal removido";
  }
  return (
    <span className={className}>
      {icone}
      {nome}
    </span>
  );
}

function PilhaDeInteressados({ evento }: { evento: EventoDoServidor }) {
  return (
    <span className={css.pilha} aria-hidden>
      {evento.interessados.slice(0, 3).map((userId) => (
        <AvatarDeInteressado key={userId} serverId={evento.serverId} userId={userId} />
      ))}
    </span>
  );
}

export function AvatarDeInteressado({
  serverId,
  userId,
  tamanho = "2xs",
}: {
  serverId: string;
  userId: string;
  tamanho?: "2xs" | "xs";
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  return (
    <Avatar
      id={userId}
      sigla={membro?.sigla}
      url={membro?.avatarUrl}
      tamanho={tamanho === "2xs" ? "xxs" : "xs"}
      className={css.anel}
    />
  );
}

function MenuDoEvento({
  evento,
  podeGerenciar,
  eu,
}: {
  evento: EventoDoServidor;
  podeGerenciar: boolean;
  eu: string | undefined;
}) {
  const meu = eu !== undefined && evento.criadorId === eu;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={css.botaoDeCartao}
          data-tom="icone"
          aria-label={`Mais ações de ${evento.nome}`}
        >
          <DotsThree aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => void copiarTexto(linkDosEventos(evento.serverId), "Link")}
        >
          <Link aria-hidden />
          Copiar link
        </DropdownMenuItem>
        {/* Editar e excluir: do organizador ou de quem gerencia eventos — a
            mesma regra que o servidor aplica. Sem direito, o item não existe. */}
        {podeGerenciar || meu ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                administrar({
                  tipo: "evento",
                  serverId: evento.serverId,
                  eventoId: evento.id,
                })
              }
            >
              <PencilSimple aria-hidden />
              Editar evento
            </DropdownMenuItem>
            <DropdownMenuItem perigo onSelect={() => void apagarEvento(evento.id)}>
              <Trash aria-hidden />
              Excluir evento
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Entrar: sala de voz liga a chamada, texto abre o canal, externo avisa do link.
 *
 * O link externo passa pelo MESMO aviso do link de mensagem: o evento é
 * escrito por outra pessoa, e o nome dele pode dizer uma coisa com o destino
 * sendo outra.
 */
export function entrarNoEvento(evento: EventoDoServidor, ehVoz: boolean): void {
  if (evento.local.tipo === "externo") {
    administrar({ tipo: "linkExterno", href: evento.local.url, texto: evento.nome });
    return;
  }
  const { channelId } = evento.local;
  if (ehVoz) {
    void entrarNaChamada(channelId);
    return;
  }
  irPara(evento.serverId, channelId);
}

export function linkDosEventos(serverId: string): string {
  return `${location.origin}/servidor/${serverId}/eventos`;
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
