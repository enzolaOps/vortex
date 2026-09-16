import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { toast } from "../components/ui/toastStore";
import { motivoDoErro } from "../sdk/erros";
import {
  descreverExportacao,
  lerExportacao,
  pedirExportacao,
  type Exportacao,
} from "../sdk/exportacao";
import { LinhaDeAjuste } from "./Pagina";

/** Enquanto gera, pergunta de novo neste intervalo. */
const PERGUNTA_MS = 5000;

/**
 * "Solicitar meus dados" — a linha da página de privacidade.
 *
 * O estado mora no SERVIDOR, e não aqui: quem pede e fecha a aba volta dias
 * depois e encontra o link, e quem pede no celular vê o arquivo pronto no
 * computador. Esta linha só pergunta.
 *
 * `undefined` é "ainda não sei" e `null` é "nunca pediu" — a diferença é o
 * que impede o botão "Solicitar" de aparecer por um quadro para quem já tem um
 * arquivo pronto.
 */
export function ExportarDados() {
  const [exportacao, setExportacao] = useState<Exportacao | null | undefined>(undefined);
  const [pedindo, setPedindo] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const emCurso =
    exportacao?.fase === "naFila" || exportacao?.fase === "gerando";

  useEffect(() => {
    let vivo = true;
    const perguntar = () =>
      void lerExportacao().then((e) => {
        if (!vivo) return;
        // Falha de rede não apaga o que já se sabia.
        if (e !== undefined) setExportacao(e);
        setAgora(Date.now());
      });
    perguntar();
    if (!emCurso) {
      return () => {
        vivo = false;
      };
    }
    const t = setInterval(perguntar, PERGUNTA_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [emCurso]);

  const { detalhe, acao } = descreverExportacao(exportacao ?? null, agora);

  function solicitar() {
    setPedindo(true);
    pedirExportacao()
      .then((e) => {
        setExportacao(e);
        setAgora(Date.now());
      })
      .catch((e: unknown) =>
        toast({ tipo: "erro", titulo: "Não deu para pedir a exportação.", descricao: motivoDoErro(e) }),
      )
      .finally(() => setPedindo(false));
  }

  return (
    <LinhaDeAjuste
      titulo="Solicitar meus dados"
      detalhe={exportacao === undefined ? "Consultando…" : detalhe}
    >
      {acao === "baixar" && exportacao?.link ? (
        <Botao
          tamanho="pequeno"
          variante="primario"
          onClick={() => window.open(exportacao.link, "_blank", "noopener,noreferrer")}
        >
          Baixar
        </Botao>
      ) : (
        <Botao
          tamanho="pequeno"
          disabled={exportacao === undefined || acao === "aguardar"}
          carregando={pedindo || acao === "gerando"}
          onClick={solicitar}
        >
          Solicitar
        </Botao>
      )}
    </LinhaDeAjuste>
  );
}
