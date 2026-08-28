import { memo } from "react";

import { Avatar } from "../components/ui/Avatar";
import { CartaoDePerfil } from "../membros/CartaoDePerfil";
import { chaveDeMembro } from "../sdk/domain";
import { PontoDePresenca } from "./PontoDePresenca";
import { useMembro, useServidorAtivo } from "../store/hooks";

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
      <Avatar id={userId} sigla={membro?.sigla} tamanho="md">
        {/* Presença nunca só por cor — a silhueta do ponto muda com o estado.
            Sem rótulo aqui: o nome já está escrito ao lado, e anunciar
            presença a cada linha seria ruído no leitor de tela. */}
        <PontoDePresenca userId={userId} />
      </Avatar>
    </CartaoDePerfil>
  );
});
