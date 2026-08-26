import { useMembro } from "../store/hooks";

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
 */
export function NomeDoAutor({ userId }: { userId: string }) {
  const membro = useMembro(userId);
  return (
    <span className="text-md font-medium text-text-1">
      {membro?.displayName ?? userId}
    </span>
  );
}
