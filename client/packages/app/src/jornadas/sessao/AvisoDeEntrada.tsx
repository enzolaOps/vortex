import type { ReactNode } from "react";
import type { CausaDeErro } from "nucleo/store/sessao";

import { sessao } from "../../textos";
import { Alerta, Confirmado, SemConexao } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import css from "./Entrada.module.css";

/** A frase de cada causa. `credenciais` não passa por aqui: ela marca os campos. */
export function fraseDaCausa(
  causa: CausaDeErro | undefined,
  motivo: string | undefined,
): string {
  const e = sessao.entrada.erro;
  switch (causa?.tipo) {
    case "credenciais":
      return e.credenciais;
    case "rede":
      return e.rede;
    case "servidor":
      return e.servidor;
    case "naoVerificada":
      return e.naoVerificada;
    case "soAutenticador":
      return e.soAutenticador;
    case "limite":
      return causa.esperaSegundos === undefined ? e.limiteSemTempo : e.limite(causa.esperaSegundos);
    case "outra":
    case undefined:
      // Último recurso: a frase que a camada de rede já traduziu para o caso.
      return motivo ?? e.generico;
  }
}

/**
 * Aviso acima do formulário. Rede e limite são "tente depois" (atenção); o resto é
 * algo que a pessoa precisa resolver (erro). `role="alert"` porque responde a uma
 * ação que ela acabou de fazer.
 */
export function AvisoDeEntrada({ causa, motivo }: { causa: CausaDeErro | undefined; motivo: string | undefined }) {
  const atencao = causa?.tipo === "rede" || causa?.tipo === "limite" || causa?.tipo === "servidor";
  return (
    <div
      role="alert"
      className={juntar(css.aviso, atencao ? css.avisoDeAtencao : css.avisoDeErro)}
    >
      {causa?.tipo === "rede" ? <SemConexao tamanho={16} /> : <Alerta tamanho={16} />}
      <span>{fraseDaCausa(causa, motivo)}</span>
    </div>
  );
}

export type TomDoAviso = "erro" | "atencao" | "info" | "sucesso";

const CLASSE_DO_TOM: Record<TomDoAviso, string> = {
  erro: css.avisoDeErro ?? "",
  atencao: css.avisoDeAtencao ?? "",
  info: css.avisoDeInfo ?? "",
  sucesso: css.avisoDeSucesso ?? "",
};

/**
 * Aviso com a frase pronta de quem chama. `erro` e `atencao` anunciam como alerta (respondem
 * a uma ação); `info` e `sucesso` são estado, anunciados sem interromper.
 */
export function AvisoSimples({ tom, children }: { tom: TomDoAviso; children: ReactNode }) {
  return (
    <div role={tom === "erro" || tom === "atencao" ? "alert" : "status"} className={juntar(css.aviso, CLASSE_DO_TOM[tom])}>
      {tom === "sucesso" ? <Confirmado tamanho={16} /> : <Alerta tamanho={16} />}
      <span>{children}</span>
    </div>
  );
}
