import { useSyncExternalStore, type ReactElement } from "react";

import { MenuDeContexto } from "../components/ui/MenuDeContexto";
import { MenuDoUsuario } from "../membros/MenuDoUsuario";
import { useChannel } from "../store/hooks";
import {
  alvoDoEvento,
  assinarMenuDoParticipante,
  definirAlvoDoParticipante,
  lerAlvoDoParticipante,
} from "../store/menuDoParticipante";

/**
 * A superfície que carrega participantes: UM `ContextMenu` para ela inteira.
 *
 * O filho único recebe o clique direito; a mira resolve quem é o alvo pelo
 * `data-participante` mais próximo, e fora de um participante o menu não abre
 * (sem `preventDefault` o Radix abriria uma caixa vazia).
 *
 * ⚠ **A mira roda também no `pointerdown`**, e é o que conserta o toque: o
 * long-press do Radix abre sem `contextmenu` nenhum, então o menu vinha com o
 * participante do gesto anterior. Ver `MenuDeContexto`.
 *
 * ⚠ **O CONTEÚDO deixou de ser próprio, e essa era a terceira variante do
 * menu da mesma pessoa.** A timeline e a member list compartilhavam
 * `MenuDoUsuario`; a sala respondia volume, silêncio local, mover, mudo/surdo
 * do servidor e desconectar — sem cargos, sem apelido, sem castigo, sem
 * expulsar, sem "Copiar ID". Agora é o mesmo menu com um BLOCO a mais, e o
 * bloco é o que só existe dentro de uma sala. Ver `membros/MenuDoUsuario`.
 */
export function ComMenuDoParticipante({
  channelId,
  children,
}: {
  channelId: string;
  children: ReactElement;
}) {
  return (
    <MenuDeContexto
      mirar={(no) => {
        const alvo = alvoDoEvento(no, channelId);
        definirAlvoDoParticipante(alvo);
        return alvo !== null;
      }}
      gatilho={children}
    >
      <MenuDoParticipante />
    </MenuDeContexto>
  );
}

function MenuDoParticipante() {
  const alvo = useSyncExternalStore(
    assinarMenuDoParticipante,
    lerAlvoDoParticipante,
  );
  return alvo ? <Conteudo userId={alvo.userId} channelId={alvo.channelId} /> : null;
}

/**
 * ⚠ **O `serverId` vem do CANAL, e não da navegação.** Uma chamada continua
 * aberta enquanto a pessoa olha outro servidor; ler o ativo faria moderar agir
 * sobre o servidor errado, e numa chamada de DM sobre um que não existe.
 */
function Conteudo({ userId, channelId }: { userId: string; channelId: string }) {
  const canal = useChannel(channelId);
  return (
    <MenuDoUsuario
      userId={userId}
      serverId={canal?.serverId ?? ""}
      voz={channelId}
    />
  );
}
