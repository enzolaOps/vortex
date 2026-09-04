import { toast } from "../components/ui/toastStore";

/**
 * Copia texto, e AVISA — nos dois desfechos.
 *
 * Copiar é a ação mais silenciosa que existe numa interface: nada se move, nada
 * muda de cor, e o resultado só aparece quando a pessoa cola em outro lugar. Sem
 * confirmação, o sucesso é indistinguível da falha até ser tarde.
 *
 * E falhar é comum, não hipotético: `navigator.clipboard` não existe fora de
 * contexto seguro, e o navegador pode negar a permissão. É o primeiro caminho
 * de erro real do app, e o primeiro consumidor do toast — que existia desde a
 * fase 2 sem nenhum chamador.
 */
export async function copiarTexto(texto: string, oQue: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(texto);
    toast({ titulo: `${oQue} copiado`, tipo: "info" });
  } catch {
    /*
      O texto vai no toast de propósito.

      "Não foi possível copiar" sozinho é um beco sem saída: a pessoa queria o
      texto, e o app tem o texto. Mostrá-lo devolve o caminho manual — selecionar
      e copiar — em vez de só informar a derrota.
    */
    toast({
      titulo: "Não foi possível copiar",
      descricao: texto,
      tipo: "erro",
    });
  }
}
