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

/**
 * Copia uma IMAGEM para a área de transferência.
 *
 * ⚠ **O Radix suprime o menu nativo, e "Copiar imagem" é dele.** Numa
 * superfície onde a mídia vem de outras pessoas, colar a imagem noutro lugar é
 * gesto comum — e o `preventDefault` que abre o menu do app o apagava sem
 * substituto (quebra nº 7 da auditoria de clique direito).
 *
 * ⚠ **Passa por `canvas` quando não é PNG, e não é preciosismo.** A área de
 * transferência do navegador aceita um conjunto curto de tipos, e `image/png`
 * é o único universal; escrever `image/webp` — que é o que o `autumn` costuma
 * devolver — é recusado com `NotAllowedError`. Redesenhar num canvas e exportar
 * PNG é o caminho que funciona, e ele custa uma decodificação que só acontece
 * neste clique.
 *
 * ⚠ **O `ClipboardItem` recebe a PROMESSA do blob e não o blob pronto.** O
 * Safari exige que `write` seja chamado ainda dentro do gesto do usuário; com
 * `await` antes, o gesto já expirou e a escrita é negada. Passar a promessa
 * mantém a chamada síncrona em relação ao clique.
 */
export async function copiarImagem(url: string): Promise<void> {
  try {
    if (typeof ClipboardItem === "undefined") throw new Error("sem ClipboardItem");
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": comoPng(url) }),
    ]);
    toast({ titulo: "Imagem copiada", tipo: "info" });
  } catch {
    /*
      O endereço vai no toast pela mesma razão do texto: a pessoa queria a
      imagem, e o app tem o endereço dela. Sem isso o erro é um beco.
    */
    toast({
      titulo: "Não foi possível copiar a imagem",
      descricao: url,
      tipo: "erro",
    });
  }
}

async function comoPng(url: string): Promise<Blob> {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(String(resposta.status));
  const bruto = await resposta.blob();
  if (bruto.type === "image/png") return bruto;

  const bitmap = await createImageBitmap(bruto);
  const tela = document.createElement("canvas");
  tela.width = bitmap.width;
  tela.height = bitmap.height;
  const pincel = tela.getContext("2d");
  if (!pincel) throw new Error("sem canvas 2d");
  pincel.drawImage(bitmap, 0, 0);
  /* `close()` libera a memória do bitmap na hora: uma imagem de 4000×3000
     decodificada são ~48 MB, e esperar o coletor é o erro nº 5 do briefing
     para quem copia várias seguidas. */
  bitmap.close();

  return await new Promise<Blob>((resolver, rejeitar) => {
    tela.toBlob((b) => {
      if (b) resolver(b);
      else rejeitar(new Error("toBlob vazio"));
    }, "image/png");
  });
}
