import type { ResultadoDeConta } from "nucleo/sdk/perfil";
import { useState, type FormEvent, type ReactNode } from "react";

import { config } from "../../textos";
import { Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import { CampoDeTexto } from "../sessao/CampoDeTexto";
import { estilosDeConfig as ec } from "./controles";

export interface CampoDoDialogo {
  readonly chave: string;
  readonly rotulo: string;
  readonly tipo?: "text" | "password" | "email";
  readonly autoComplete?: string;
  readonly inicial?: string;
  readonly maxLength?: number;
}

export type Valores = Readonly<Record<string, string>>;

/** Onde uma falha aparece: no campo que a causou, ou no alto dos botões. */
export type ErroNoDialogo = { readonly chave: string; readonly texto: string };

export interface DialogoDeContaProps {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  descricao?: string;
  campos: readonly CampoDoDialogo[];
  confirmar: string;
  perigo?: boolean;
  /** Erros locais por campo, antes de ir ao servidor. `undefined` = pode enviar. */
  validar?: (valores: Valores) => Record<string, string> | undefined;
  enviar: (valores: Valores) => Promise<ResultadoDeConta>;
  /** Traduz a causa classificada no campo e na frase. */
  traduzir: (falha: Extract<ResultadoDeConta, { ok: false }>) => ErroNoDialogo;
  aoConcluir: (valores: Valores) => void;
  /** Texto fixo acima dos campos (consequências, avisos). */
  aviso?: ReactNode;
}

/**
 * Formulário de conta num diálogo: senha atual, novo e-mail, nova senha.
 *
 * O corpo mora num componente que só existe com o diálogo aberto, então fechar
 * e abrir de novo zera tudo — em especial a senha digitada, que nunca deve
 * sobreviver à tela. Erro de senha vai no campo da senha; o que não é de campo
 * nenhum vai acima dos botões, com `role="alert"`.
 */
export function DialogoDeConta(props: DialogoDeContaProps) {
  const { aberto, aoMudar, titulo, descricao } = props;
  return (
    <Dialogo open={aberto} onOpenChange={aoMudar}>
      <ConteudoDoDialogo titulo={titulo} descricao={descricao}>
        <Corpo {...props} />
      </ConteudoDoDialogo>
    </Dialogo>
  );
}

function Corpo({
  aoMudar,
  campos,
  confirmar,
  perigo = false,
  validar,
  enviar,
  traduzir,
  aoConcluir,
  aviso,
}: DialogoDeContaProps) {
  const [valores, setValores] = useState<Valores>(() =>
    Object.fromEntries(campos.map((c) => [c.chave, c.inicial ?? ""])),
  );
  const [erros, setErros] = useState<Readonly<Record<string, string>>>({});
  const [enviando, setEnviando] = useState(false);

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    const locais = validar?.(valores);
    if (locais !== undefined && Object.keys(locais).length > 0) {
      setErros(locais);
      return;
    }
    setErros({});
    setEnviando(true);
    const r = await enviar(valores);
    setEnviando(false);
    if (r.ok) {
      aoConcluir(valores);
      aoMudar(false);
      return;
    }
    const falha = traduzir(r);
    setErros({ [falha.chave]: falha.texto });
    // A senha errada não fica na tela esperando ser corrigida letra a letra.
    setValores((v) => ({
      ...v,
      ...Object.fromEntries(campos.filter((c) => c.tipo === "password").map((c) => [c.chave, ""])),
    }));
  }

  const geral = erros["geral"];
  return (
    <form
      noValidate
      className={ec.bloco}
      onSubmit={(e) => {
        void submeter(e);
      }}
    >
      {aviso}
      {campos.map((c, i) => (
        <CampoDeTexto
          key={c.chave}
          rotulo={c.rotulo}
          type={c.tipo ?? "text"}
          autoComplete={c.autoComplete ?? "off"}
          maxLength={c.maxLength}
          autoFocus={i === 0}
          value={valores[c.chave] ?? ""}
          erro={erros[c.chave]}
          readOnly={enviando}
          onChange={(ev) => {
            setValores((v) => ({ ...v, [c.chave]: ev.target.value }));
          }}
        />
      ))}
      {geral !== undefined && (
        <p className={ec.erro} role="alert">
          {geral}
        </p>
      )}
      <div className={ec.acoes}>
        <Botao
          variante="fantasma"
          disabled={enviando}
          onClick={() => {
            aoMudar(false);
          }}
        >
          {config.contaTela.cancelar}
        </Botao>
        <Botao type="submit" variante={perigo ? "perigo" : "primario"} carregando={enviando}>
          {confirmar}
        </Botao>
      </div>
    </form>
  );
}
