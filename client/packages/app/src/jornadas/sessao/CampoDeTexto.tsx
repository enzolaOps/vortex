import { useId, useState, type InputHTMLAttributes, type Ref } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Alerta, Olho, OlhoFechado } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import css from "./Entrada.module.css";

export interface CampoDeTextoProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className" | "children"> {
  rotulo: string;
  dica?: string;
  /** Marca a borda e `aria-invalid`. A frase do erro é de quem agrupa os campos. */
  invalido?: boolean;
  /** Frase do erro, ligada ao campo por `aria-describedby`. Implica `invalido`. */
  erro?: string;
  /** Mostra o botão de revelar (só faz sentido em `type="password"`). */
  revelavel?: boolean;
  campoRef?: Ref<HTMLInputElement>;
  /** Texto fixo antes do valor (o "@" do nome de usuário). Decorativo: o rótulo já diz o que é. */
  prefixo?: string;
}

/**
 * Campo de formulário da jornada de sessão: rótulo, dica, erro e revelar senha.
 *
 * Mora aqui e não em `ui/ds` porque o DS (os 12 componentes aprovados) não tem
 * campo de texto, e as telas de sessão são o primeiro consumidor. Quando um
 * segundo consumidor aparecer, sobe para o DS.
 */
export function CampoDeTexto({
  rotulo,
  dica,
  invalido,
  erro,
  revelavel,
  campoRef,
  prefixo,
  type = "text",
  ...resto
}: CampoDeTextoProps) {
  const id = useId();
  const idDoErro = `${id}-erro`;
  const idDaDica = `${id}-dica`;
  const [revelado, setRevelado] = useState(false);
  const marcado = invalido === true || erro !== undefined;
  const descricao = [dica ? idDaDica : undefined, erro ? idDoErro : undefined]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={css.campo}>
      <label className={css.rotulo} htmlFor={id}>
        {rotulo}
      </label>
      <div className={css.envoltorio}>
        {prefixo !== undefined && (
          <span className={css.prefixo} aria-hidden="true">
            {prefixo}
          </span>
        )}
        <input
          {...resto}
          ref={campoRef}
          id={id}
          type={revelavel && revelado ? "text" : type}
          className={juntar(css.entrada, revelavel && css.comRevelar, prefixo !== undefined && css.comPrefixo)}
          aria-invalid={marcado ? true : undefined}
          aria-describedby={descricao || undefined}
        />
        {revelavel && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            className={css.revelar}
            icone={revelado ? <OlhoFechado /> : <Olho />}
            aria-label={sessao.entrada.mostrarSenha}
            aria-pressed={revelado}
            onClick={() => setRevelado((v) => !v)}
          />
        )}
      </div>
      {dica && (
        <p id={idDaDica} className={css.dica}>
          {dica}
        </p>
      )}
      {erro && (
        <p id={idDoErro} role="alert" className={css.erroDoCampo}>
          <Alerta tamanho={14} />
          <span>{erro}</span>
        </p>
      )}
    </div>
  );
}

