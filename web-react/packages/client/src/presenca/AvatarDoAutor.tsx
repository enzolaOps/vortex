import { memo } from "react";

import { Avatar } from "../components/ui/Avatar";
import { CartaoDePerfil } from "../membros/CartaoDePerfil";
import { chaveDeMembro } from "../sdk/domain";
import { PontoDePresenca } from "./PontoDePresenca";
import { useMembro, useServidorAtivo } from "../store/hooks";
import css from "./AvatarDoAutor.module.css";

/**
 * O avatar de quem escreveu.
 *
 * Componente próprio pela MESMA razão do `NomeDoAutor` e do `PontoDePresenca`:
 * se a linha assinasse o autor para pegar a sigla, alguém trocar de apelido
 * re-renderizaria todas as mensagens daquela pessoa na janela — texto, reações
 * e anexos incluídos. Assinando aqui, muda o avatar e mais nada.
 *
 * ⚠ **Antes isto era uma caixa cinza VAZIA.** A calha existia, tinha o tamanho
 * certo e não desenhava ninguém — era o que mais separava a tela do design, e
 * fazia toda conversa parecer a mesma pessoa falando. Agora carrega o gradiente
 * derivado do ID e as iniciais.
 *
 * `memo` porque ele é filho da linha mais quente do app: sem ele, um
 * re-render da linha por reação ou por permissão remontaria o avatar junto.
 */
export const AvatarDoAutor = memo(function AvatarDoAutor({
  userId,
}: {
  userId: string;
}) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));

  return (
    /*
      O cartão de perfil pendura aqui também, como no nome.

      É o que o design mostra e o que a pessoa tenta: no `Vortex App` o avatar
      é alvo tanto quanto o nome. Ter só o nome como gatilho é a metade do alvo
      que alguém mira primeiro — o avatar é maior e está antes na leitura.
    */
    <CartaoDePerfil serverId={serverId} userId={userId}>
      {/*
        ⚠ **BOTÃO, e o clique abria NADA antes disto.**

        O avatar tinha cartão no HOVER e menu no botão DIREITO — e clique
        esquerdo, que é o primeiro gesto que alguém tenta num avatar, não fazia
        coisa alguma. Em TOQUE era pior: sem hover e sem botão direito, o menu
        do usuário era inalcançável. A referência abre o menu no clique, e é
        assim que a seção dela se chama.

        `button` e não a `span` do `Avatar`: ela é `aria-hidden` e não recebe
        foco. Sem elemento focável aqui, o menu seria de ponteiro só — o mesmo
        defeito que a auditoria já apontou na paleta de comandos.

        Ele despacha o `contextmenu` que o `Trigger` no nível da lista já
        escuta, em vez de montar um segundo menu: o evento borbulha, passa pelo
        handler que escreve o alvo, e o menu se resolve pelo mesmo caminho do
        clique direito. É o mecanismo que o `⋯` da barra de ações já usa —
        dois menus com os mesmos itens divergem no dia em que alguém
        acrescenta um item num só.
      */}
      <button
        type="button"
        className={css.gatilho}
        aria-label={`Ações de ${membro?.displayName ?? "quem escreveu"}`}
        onClick={(e) => {
          const alvo = e.currentTarget;
          const r = alvo.getBoundingClientRect();
          alvo.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: Math.round(r.left),
              clientY: Math.round(r.bottom),
            }),
          );
        }}
      >
        <Avatar id={userId} sigla={membro?.sigla} tamanho="md">
          {/* Presença nunca só por cor — a silhueta do ponto muda com o estado.
              Sem rótulo aqui: o nome já está escrito ao lado, e anunciar
              presença a cada linha seria ruído no leitor de tela. */}
          <PontoDePresenca userId={userId} />
        </Avatar>
      </button>
    </CartaoDePerfil>
  );
});
