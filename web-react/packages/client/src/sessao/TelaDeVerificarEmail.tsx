import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { verificarEmail } from "../sdk/conta";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * Confirma o e-mail assim que a tela abre, a partir do token do link.
 *
 * Verifica sozinha e não atrás de um botão: a pessoa já clicou uma vez, no
 * e-mail. Pedir um segundo clique para fazer o que o primeiro prometeu é
 * cerimônia.
 *
 * Os três estados aparecem porque o do meio é real: a chamada leva tempo de
 * rede, e uma tela em branco enquanto ela corre parece link quebrado.
 */
export function TelaDeVerificarEmail({
  token,
  motivo,
}: {
  token: string;
  motivo: string | undefined;
}) {
  const [estado, setEstado] = useState<"verificando" | "ok" | "falhou">(
    "verificando",
  );

  useEffect(() => {
    let vivo = true;
    void verificarEmail(token).then((ok) => {
      // O componente pode ter saído — trocar estado depois disso é aviso do
      // React e vazamento de intenção.
      if (vivo) setEstado(ok ? "ok" : "falhou");
    });
    return () => {
      vivo = false;
    };
  }, [token]);

  return (
    <div className={css.tela}>
      <div className={css.cartao}>
        {estado === "verificando" ? (
          <>
            <h1 className={css.titulo}>Confirmando…</h1>
            <p className={css.recado}>Um instante.</p>
          </>
        ) : estado === "ok" ? (
          <>
            <h1 className={css.titulo}>E-mail confirmado</h1>
            <p className={css.recado}>A conta está pronta. Pode entrar.</p>
            <Botao variante="primario" onClick={voltarParaEntrar}>
              Entrar
            </Botao>
          </>
        ) : (
          <>
            <h1 className={css.titulo}>Não deu para confirmar</h1>
            {/* O motivo do store diz o que houve — link expirado é o caso
                comum, e ele tem conserto: pedir outro. */}
            <p className={css.recado}>
              {motivo ?? "Este link expirou ou já foi usado."}
            </p>
            <Botao variante="neutro" onClick={voltarParaEntrar}>
              Voltar para a entrada
            </Botao>
          </>
        )}
      </div>
    </div>
  );
}
