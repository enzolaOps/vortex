import { useState } from "react";
import type { MetodoDeMfa } from "nucleo/store/sessao";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

export interface TelaDeMfaProps {
  /** Os fatores que o servidor aceita para ESTA conta, na ordem em que ele os oferece. */
  metodos: readonly MetodoDeMfa[];
  /** Verificação em voo. */
  verificando: boolean;
  /** Há erro de uma tentativa anterior (o código não confere). */
  incorreto: boolean;
  aoVerificar: (metodo: MetodoDeMfa, valor: string) => void;
  aoCancelar: () => void;
}

/**
 * O segundo fator: senha ou código de recuperação.
 *
 * Aplicativo autenticador não é respondido pelo Vortex. Uma conta só com ele nem
 * chega aqui: a entrada termina em erro com a causa `soAutenticador`, e a tela de
 * entrada explica — em vez de este formulário aparecer e só poder falhar.
 *
 * Mesma moldura da entrada: é a mesma tela em outro passo.
 */
export function TelaDeMfa({ metodos, verificando, incorreto, aoVerificar, aoCancelar }: TelaDeMfaProps) {
  // O primeiro da lista do servidor, não um preferido nosso.
  const [metodo, setMetodo] = useState<MetodoDeMfa>(metodos[0] ?? "senha");
  const [valor, setValor] = useState("");

  const textos = sessao.mfa[metodo];
  const podeEnviar = valor.trim() !== "" && !verificando;

  return (
    <MoldeDaEntrada titulo={sessao.mfa.titulo} subtitulo={sessao.mfa.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) aoVerificar(metodo, valor.trim());
        }}
      >
        {/* Só aparece quando há escolha: uma opção só seria um rótulo disfarçado de controle. */}
        {metodos.length > 1 && (
          <div className={css.fatores} role="group" aria-label={sessao.mfa.comoVerificar}>
            {metodos.map((m) => (
              <button
                key={m}
                type="button"
                className={css.fator}
                aria-pressed={m === metodo}
                disabled={verificando}
                onClick={() => {
                  setMetodo(m);
                  // O valor não sobrevive à troca: um código no campo de senha é tentativa perdida.
                  setValor("");
                }}
              >
                {sessao.mfa[m].aba}
              </button>
            ))}
          </div>
        )}

        <CampoDeTexto
          rotulo={textos.rotulo}
          dica={textos.dica}
          type={metodo === "senha" ? "password" : "text"}
          revelavel={metodo === "senha"}
          autoComplete={metodo === "senha" ? "current-password" : "one-time-code"}
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={valor}
          readOnly={verificando}
          erro={incorreto ? textos.incorreto : undefined}
          onChange={(e) => setValor(e.target.value)}
        />

        <Botao
          type="submit"
          className={css.largo}
          carregando={verificando}
          disabled={!podeEnviar && !verificando}
        >
          {verificando ? sessao.mfa.verificando : sessao.mfa.verificar}
        </Botao>

        <Botao variante="fantasma" className={css.largo} disabled={verificando} onClick={aoCancelar}>
          {sessao.mfa.outraConta}
        </Botao>
      </form>
    </MoldeDaEntrada>
  );
}
