import { subirAnexo, type TagDeAnexo } from "nucleo/sdk/anexos";
import { useEffect, useState } from "react";

import { config } from "../../textos";
import { toast } from "../../ui/primitivos/Avisos";

/**
 * Escolher, enviar e remover UMA imagem de identidade (foto ou banner).
 *
 * A troca é IMEDIATA, fora da barra de salvar: escolher o arquivo já é a
 * intenção inteira, e o servidor de mídia o guardou no instante do envio.
 * Acender "alterações não salvas" por um envio que já aconteceu seria mentir.
 *
 * O que o chamador traz é só o que difere: a tag do servidor de mídia, o que o
 * servidor diz hoje e como escrever no perfil. Prévia local primeiro (some se a
 * gravação falhar), `revokeObjectURL` ao trocar e a URL removida guardada por
 * VALOR — um booleano esconderia uma imagem nova posta em outra aba.
 */
export type ImagemEnviavel = {
  /** O que desenhar: a prévia local, depois a do servidor. */
  readonly url: string | undefined;
  readonly estado: "parado" | "subindo" | "removendo";
  readonly escolher: (arquivo: File) => void;
  readonly remover: () => void;
};

export function useImagemEnviavel({
  tag,
  doServidor,
  aplicar,
  aoMudar,
}: {
  readonly tag: TagDeAnexo;
  readonly doServidor: string | undefined;
  /** Escreve no perfil. `undefined` = remover. Devolve se colou. */
  readonly aplicar: (anexoId: string | undefined) => Promise<boolean>;
  /** Depois de gravar ou remover com sucesso. */
  readonly aoMudar?: () => void;
}): ImagemEnviavel {
  const [previa, setPrevia] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<"parado" | "subindo" | "removendo">("parado");
  const [removida, setRemovida] = useState<string | undefined>(undefined);

  // Cada `createObjectURL` prende o arquivo na memória da aba até ser revogado.
  useEffect(() => {
    return () => {
      if (previa !== undefined) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  function escolher(arquivo: File) {
    if (!arquivo.type.startsWith("image/")) {
      toast({ tipo: "erro", titulo: config.perfilTela.imagemInvalida });
      return;
    }
    setPrevia(URL.createObjectURL(arquivo));
    setRemovida(undefined);
    setEstado("subindo");
    void subirAnexo(arquivo, tag)
      .then((id) => aplicar(id))
      .then((colou) => {
        if (colou) aoMudar?.();
        else setPrevia(undefined);
      })
      .catch((e: unknown) => {
        setPrevia(undefined);
        toast({
          tipo: "erro",
          titulo: config.perfilTela.falhouImagem,
          descricao: e instanceof Error ? e.message : undefined,
        });
      })
      .finally(() => {
        setEstado("parado");
      });
  }

  function remover() {
    const antes = doServidor;
    setEstado("removendo");
    void aplicar(undefined)
      .then((ok) => {
        if (!ok) return;
        setPrevia(undefined);
        setRemovida(antes);
        aoMudar?.();
      })
      .finally(() => {
        setEstado("parado");
      });
  }

  const url = previa ?? (doServidor !== undefined && doServidor === removida ? undefined : doServidor);
  return { url, estado, escolher, remover };
}
