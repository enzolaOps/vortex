import { CartaoDePerfil } from "../membros/CartaoDePerfil";
import { chaveDeMembro } from "../sdk/domain";
import { useCorDeCargo, useMembro, useServidorAtivo } from "../store/hooks";

/**
 * O nome de quem escreveu.
 *
 * Assina o MEMBRO, não a mensagem — e é um componente próprio pela mesma razão
 * do `PontoDePresenca`: se a linha assinasse o autor, alguém trocar de apelido
 * re-renderizaria todas as mensagens daquela pessoa na janela, texto e reações
 * incluídos. Assinando aqui, muda o nome e nada mais.
 *
 * O fallback é o ID cru, e é honesto: até a fase 3 a linha mostrava o ID
 * sempre, porque não havia store de membro. Agora há, e o ID só aparece
 * enquanto a entidade não resolveu — que é o mesmo contrato do placeholder da
 * linha, um nível abaixo.
 *
 * **O servidor vem da navegação, não de uma prop.** A lista só mostra o canal
 * ativo, que está no servidor ativo — então os dois são o mesmo, e `serverId`
 * atravessando `MessageList → MessageRow → aqui` só existiria para dizer o que
 * o store já sabe. `useServidorAtivo` assina a navegação, que muda quando
 * alguém troca de canal e em mais nenhuma ocasião.
 *
 * Fica a nota para a fase 6: DM não tem servidor. Quando ela existir, o
 * fallback correto é o `User`, que é exatamente o que `toMemberSnapshot`
 * devolve sem `ServerMember`.
 */
export function NomeDoAutor({ userId }: { userId: string }) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const corDeCargo = useCorDeCargo(membro?.cor);

  return (
    // O cartão de perfil pendura AQUI e não na linha: o gatilho é o nome, e
    // este componente já é o dono dele. A linha continua sem saber que
    // perfis existem.
    <CartaoDePerfil serverId={serverId} userId={userId}>
    <span
      className="text-md font-medium text-text-1"
      /*
        A única cor literal legítima do app.

        Ela é escolha de quem administra o servidor, não do nosso sistema de
        tokens — um cargo "Moderação" verde é dado, não decisão de design. Vai
        por `style` e não por utility justamente porque é runtime: não há
        classe a gerar, então não é arbitrary value nem furo na lei nº 4.

        Só texto, nunca preenchimento: sobre `--vx-surface-*` conhecida o
        contraste de um texto colorido é previsível; um fundo com cor arbitrária
        não seria, e levaria junto o texto por cima.
      */
      style={corDeCargo ? { color: corDeCargo } : undefined}
    >
      {membro?.displayName ?? userId}
    </span>
    </CartaoDePerfil>
  );
}
