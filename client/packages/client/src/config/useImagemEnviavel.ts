import { useEffect, useState } from "react";

import { subirAnexo, type TagDeAnexo } from "../sdk/anexos";
import { toast } from "../components/ui/toastStore";

/**
 * Escolher, enviar e remover UMA imagem de identidade.
 *
 * ⚠ **Extraído de `config/Servidor.tsx`, e a razão é a das seis cópias do
 * `Avatar`.** O ícone e o banner do servidor já dividiam este comportamento;
 * o avatar e o banner do PERFIL (D-AUTH-38/39) seriam a terceira e a quarta
 * cópia, com as mesmas cinco armadilhas para acertar de novo em cada uma — a
 * prévia local ganhando do servidor, o `revokeObjectURL`, a URL removida
 * guardada por VALOR, a falha desfazendo a prévia, e o estado de três termos.
 * A primeira a divergir seria a que ninguém abriu naquela semana.
 *
 * O que o chamador traz é só o que difere: em que tag do `autumn` o arquivo
 * mora, como se escreve no protocolo, o que o servidor diz hoje, e como a
 * coisa se chama em português para a frase do toast.
 *
 * ⚠ **A troca é IMEDIATA, fora de qualquer barra de salvar.** Escolher um
 * arquivo JÁ é a intenção inteira, e prendê-lo atrás de "Salvar" obrigaria a
 * guardar um `File` e a acender "alterações não salvas" por um upload que já
 * aconteceu — o `autumn` guardou o arquivo no instante do envio, e descartar
 * não o desfaria.
 *
 * ⚠ **Sem recorte, e a ausência é das duas fontes.** Nem a referência nem o
 * design desenham um passo de recorte; as superfícies mostram a imagem em
 * `object-fit: cover`, centrada — que é o recorte que todo cliente aplica ao
 * ler, e a prévia mostra exatamente ele.
 */
export type ImagemEnviavel = {
  /** A URL a desenhar: a prévia local primeiro, depois a do servidor. */
  readonly url: string | undefined;
  readonly estado: "parado" | "subindo" | "removendo";
  readonly escolher: (arquivo: File) => void;
  readonly remover: () => void;
};

export function useImagemEnviavel({
  tag,
  nome,
  doServidor,
  aplicar,
}: {
  readonly tag: TagDeAnexo;
  /** "ícone", "banner", "avatar" — entra nas frases de falha. */
  readonly nome: string;
  /** O que a fonte da verdade diz hoje. */
  readonly doServidor: string | undefined;
  /** Escreve no protocolo. `undefined` = remover. Devolve se colou. */
  readonly aplicar: (anexoId: string | undefined) => Promise<boolean>;
}): ImagemEnviavel {
  const [previa, setPrevia] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<"parado" | "subindo" | "removendo">(
    "parado",
  );
  /*
    A URL que acabou de ser removida, e não um booleano.

    O servidor responde "removido" antes de o evento republicar o snapshot; sem
    isto a imagem antiga voltaria até ele chegar. Guardar QUAL foi removida, e
    não "foi removida", é o que deixa uma imagem NOVA posta em outra aba
    aparecer — um booleano a esconderia até a tela ser reaberta.
  */
  const [removida, setRemovida] = useState<string | undefined>(undefined);

  /* Cada `createObjectURL` prende o arquivo na memória da aba até ser
     revogado — o erro nº 5 do briefing, numa tela que se reabre. */
  useEffect(() => {
    return () => {
      if (previa !== undefined) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  function escolher(arquivo: File) {
    if (!arquivo.type.startsWith("image/")) {
      toast({
        tipo: "erro",
        titulo: "Isso não é uma imagem.",
        descricao: "Use PNG, JPG, GIF ou WebP.",
      });
      return;
    }
    setPrevia(URL.createObjectURL(arquivo));
    setRemovida(undefined);
    setEstado("subindo");
    void subirAnexo(arquivo, tag)
      .then((id) => aplicar(id))
      .then((colou) => {
        if (!colou) setPrevia(undefined);
      })
      .catch((e: unknown) => {
        setPrevia(undefined);
        toast({
          tipo: "erro",
          titulo: `Não deu para enviar o ${nome}.`,
          descricao: e instanceof Error ? e.message : "Tente outra imagem.",
        });
      })
      .finally(() => setEstado("parado"));
  }

  function remover() {
    const antes = doServidor;
    setEstado("removendo");
    void aplicar(undefined)
      .then((ok) => {
        if (!ok) return;
        setPrevia(undefined);
        setRemovida(antes);
      })
      .finally(() => setEstado("parado"));
  }

  /* A prévia local primeiro; depois o servidor, menos o que acabou de sair. */
  const url =
    previa ??
    (doServidor !== undefined && doServidor === removida ? undefined : doServidor);

  return { url, estado, escolher, remover };
}
