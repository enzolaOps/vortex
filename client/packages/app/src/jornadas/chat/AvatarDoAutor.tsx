import { chaveDeMembro } from "nucleo/sdk/domain";
import { useAvatarDoMembro } from "nucleo/store/hooks";
import { memo } from "react";

import { Avatar } from "../../ui/ds";

export interface AvatarDoAutorProps {
  servidorId: string;
  autorId: string;
  nome: string;
}

/**
 * O avatar do autor na linha de mensagem. Assina SÓ a foto do membro: trocar a foto
 * acorda este componente e não a linha (texto, reações e anexos ficam quietos).
 *
 * A foto COBRE o gradiente com as iniciais: o `Avatar` do DS mantém a identidade de
 * sempre enquanto a imagem não chega. `avatarUrl` é a foto do membro ou do usuário,
 * nunca o avatar padrão do servidor.
 */
function AvatarDoAutorBase({ servidorId, autorId, nome }: AvatarDoAutorProps) {
  const imagem = useAvatarDoMembro(chaveDeMembro(servidorId, autorId));
  return <Avatar nome={nome} id={autorId} tamanho={36} imagem={imagem} />;
}

export const AvatarDoAutor = memo(AvatarDoAutorBase);
