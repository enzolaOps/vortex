import { CartaoDePerfil } from "../membros/CartaoDePerfil";
import { chaveDeMembro } from "../sdk/domain";
import { useCorDeCargo, useMembro, useServidorAtivo } from "../store/hooks";
import css from "./NomeDoAutor.module.css";

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
export function NomeDoAutor({
  userId,
  denso = false,
  citado = false,
}: {
  userId: string;
  /** Dentro da prévia de resposta: 12px / 600, cor de cargo mantida. */
  citado?: boolean;
  /**
   * Modo compacto: o nome vai INLINE com o texto da mensagem.
   *
   * Peso 700 e não 600, que é o número do design — inline, o nome precisa de
   * mais peso para se destacar do corpo do que precisaria numa linha própria,
   * onde a posição já o separa.
   */
  denso?: boolean;
}) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const corDeCargo = useCorDeCargo(membro?.cor);

  return (
    // O cartão de perfil pendura AQUI e não na linha: o gatilho é o nome, e
    // este componente já é o dono dele. A linha continua sem saber que
    // perfis existem.
    <CartaoDePerfil serverId={serverId} userId={userId}>
    <span
      className={
        citado
          ? css.nomeCitado
          : denso
            ? css.nomeInline
            : "text-lg font-semibold text-text-2"
      }
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

/**
 * O crachá de cargo — o "VTX" e o "MOD" do design.
 *
 * ⚠ **Componente separado do nome, e a separação é de subscrição, não de
 * arrumação.** Se ele morasse dentro de `NomeDoAutor`, precisaria do mesmo
 * `useMembro` — o que já acontece — mas o desenho fica mais claro assim: o
 * crachá é irmão do nome na linha de cabeçalho, com o mesmo alinhamento de
 * baseline do timestamp. Aninhado, herdaria o tamanho do nome.
 *
 * ⚠ **Fundo com cor de cargo, e é a EXCEÇÃO à regra do `NomeDoAutor`.** Lá
 * está escrito "só texto, nunca preenchimento", porque contraste sobre cor
 * arbitrária é imprevisível. Aqui o preenchimento é a cor a 18% sobre a
 * superfície conhecida, e o TEXTO continua sendo a cor cheia — que é
 * exatamente a mesma garantia do nome, com um véu por trás. O `color-mix` em
 * `oklab` é o que mantém o véu previsível em qualquer matiz.
 *
 * Sem cargo hasteado não há crachá: ele existe para marcar a minoria.
 */
export function CrachaDeCargo({ userId }: { userId: string }) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const corDeCargo = useCorDeCargo(membro?.cor);

  if (!membro?.cargo) return null;

  return (
    <span
      className={css.cracha}
      style={
        corDeCargo
          ? {
              color: corDeCargo,
              background: `color-mix(in oklab, ${corDeCargo} 18%, transparent)`,
            }
          : undefined
      }
    >
      {membro.cargo}
    </span>
  );
}
