import { EstadoVazio } from "../components/ui/EstadoVazio";
import { EyeSlash } from "../components/ui/icones";
import { useChannel } from "../store/hooks";
import { confirmarIdade } from "../store/idade";

/**
 * A porta de um canal +18 (D-CCANAL-06: "exige confirmação na entrada").
 *
 * Ocupa a coluna de conteúdo no lugar da lista, e não um modal sobre ela: o
 * modal deixaria a lista montada atrás — histórico buscado, mídia desenhada —
 * e o aviso existiria só para quem não fechasse a janela pelo `Esc`.
 *
 * Um botão só. Não há "voltar" porque não há para onde: a coluna de canais
 * continua ao lado, e sair daqui é clicar em qualquer outro canal — um botão
 * que adivinhasse o destino levaria a pessoa a um lugar que ela não escolheu.
 *
 * O `EstadoVazio` e não uma tela própria: é a mesma forma de "aqui ainda não
 * há o que ler" que a coluna já usa sem canal aberto, e a diferença é o texto.
 */
export function PortaoDeIdade({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);
  const nome = canal?.name ?? "este canal";

  return (
    <EstadoVazio
      preenche
      icone={<EyeSlash aria-hidden />}
      titulo="Canal com restrição de idade"
      detalhe={`#${nome} foi marcado como +18 por quem administra o servidor. Para ver as mensagens, confirme que você tem 18 anos ou mais.`}
      acao={{
        rotulo: "Tenho 18 anos ou mais",
        aoClicar: () => confirmarIdade(channelId),
      }}
    />
  );
}
