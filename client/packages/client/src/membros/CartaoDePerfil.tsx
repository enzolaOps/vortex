import type { ReactNode } from "react";

import { PerfilHoverCard } from "../components/ui/HoverCard";
import { Avatar } from "../components/ui/Avatar";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import { chaveDeMembro } from "../sdk/domain";
import { useCorDeCargo, useMembro } from "../store/hooks";
import { PilulasDeCargo } from "./PilulasDeCargo";
import css from "./CartaoDePerfil.module.css";

/**
 * O cartão de perfil, em hover sobre um nome ou avatar.
 *
 * Existe porque três campos do protocolo não tinham onde aparecer —
 * `pronouns`, `status.text` e o `username` por baixo do apelido. A varredura
 * os classificou juntos como "o custo é a SUPERFÍCIE, não o campo": nenhum é
 * difícil, e nenhum tinha lugar.
 *
 * O `HoverCard` é o wrapper que a fase 2 construiu e que **nunca foi usado** —
 * um dos três primitivos que justificaram escolher Radix em vez de Base UI.
 *
 * **Assina o membro AQUI, não no gatilho.** O nome na linha de mensagem já
 * assina o dele; se este cartão recebesse o snapshot por prop, toda linha
 * carregaria o custo de um perfil que quase nunca abre. Assinando aqui, o
 * gatilho só passa um ID.
 */
export function CartaoDePerfil({
  serverId,
  userId,
  children,
}: {
  serverId: string;
  userId: string;
  children: ReactNode;
}) {
  return (
    // `Corpo` só monta quando o card ABRE — o Content do Radix desmonta
    // fechado. É o que torna barato pendurar isto em todo nome da lista:
    // a subscrição do membro nasce no hover e morre ao sair.
    <PerfilHoverCard gatilho={children}>
      <CorpoDePerfil serverId={serverId} userId={userId} />
    </PerfilHoverCard>
  );
}

/**
 * O conteúdo do perfil, sem a casca.
 *
 * ⚠ **Exportado porque o MODAL usa o mesmo**, e não porque alguém previu
 * reuso: `ModalDePerfil` fecha `perfilCompleto` e `perfilNaChamada`, e as duas
 * mostram exatamente isto mais a nota privada e o silêncio. Duas cópias
 * divergiriam no primeiro campo novo — foi o que aconteceu com as seis do
 * `Avatar`, e o `pnpm utilities` levou seis rodadas para acusá-las.
 */
export function CorpoDePerfil({
  serverId,
  userId,
}: {
  serverId: string;
  userId: string;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  // Antes do retorno antecipado: hook não pode ficar atrás de condicional.
  const corDeCargo = useCorDeCargo(membro?.cor);

  if (!membro) {
    return <p className={css.carregando}>carregando…</p>;
  }

  // O apelido do servidor e o username global são coisas diferentes, e só
  // vale mostrar os dois quando de fato divergem — repetir o mesmo nome duas
  // vezes em tamanhos diferentes é ruído com cara de dado.
  const temApelido = membro.displayName !== membro.username;

  return (
    <div className={css.cartao}>
      <div className={css.topo}>
        <Avatar id={userId} sigla={membro.sigla} url={membro.avatarUrl} tamanho="lg">
          <PontoDePresenca userId={userId} rotular />
        </Avatar>

        <div className={css.identidade}>
          <p
            className={css.nome}
            style={corDeCargo ? { color: corDeCargo } : undefined}
          >
            {membro.displayName}
          </p>
          {temApelido ? <p className={css.username}>{membro.username}</p> : null}
        </div>
      </div>

      {/* Pronomes ao lado do nome, não escondidos num rodapé: quem os declara
          está dizendo como quer ser tratado, e o lugar disso é junto de quem
          a pessoa é. */}
      {membro.pronomes ? (
        <p className={css.pronomes}>{membro.pronomes}</p>
      ) : null}

      {/*
        As pílulas de cargo — o que a fase 6 destravou.

        Depois do status e antes do castigo: cargo é IDENTIDADE dentro do
        servidor, e castigo é estado. A ordem do cartão vai do que a pessoa é
        para o que está acontecendo com ela.
      */}
      <PilulasDeCargo serverId={serverId} cargosIds={membro.cargosIds} />

      {membro.statusTexto ? (
        <p className={css.status}>{membro.statusTexto}</p>
      ) : null}

      {membro.silenciadoAte !== undefined ? (
        <p className={css.castigo}>em castigo neste servidor</p>
      ) : null}
    </div>
  );
}
