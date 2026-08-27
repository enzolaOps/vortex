import type { ReactNode } from "react";

import { PerfilHoverCard } from "../components/ui/HoverCard";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import { chaveDeMembro } from "../sdk/domain";
import { useCorDeCargo, useMembro } from "../store/hooks";
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
      <Corpo serverId={serverId} userId={userId} />
    </PerfilHoverCard>
  );
}

function Corpo({ serverId, userId }: { serverId: string; userId: string }) {
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
        <span className={css.avatar} aria-hidden>
          {membro.sigla}
          <PontoDePresenca userId={userId} rotular />
        </span>

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

      {membro.statusTexto ? (
        <p className={css.status}>{membro.statusTexto}</p>
      ) : null}

      {membro.silenciadoAte !== undefined ? (
        <p className={css.castigo}>em castigo neste servidor</p>
      ) : null}
    </div>
  );
}
