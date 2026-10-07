import { useState } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Confirmado } from "../../ui/icones";
import { AvisoSimples } from "./AvisoDeEntrada";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MedidorDeSenha } from "./MedidorDeSenha";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { MINIMO_DA_SENHA } from "./regras";

export interface TelaDeRedefinirSenhaProps {
  /** Já trocou? Muda a tela inteira: o formulário some. */
  concluida: boolean;
  /** A tentativa em voo. */
  salvando: boolean;
  /** Falha da tentativa, na frase do servidor (link vencido, senha recusada, rede). */
  motivo?: string;
  aoSalvar: (senha: string, derrubarOutrasSessoes: boolean) => void;
  aoPedirNovoLink: () => void;
  aoEntrar: () => void;
}

/**
 * Definir a senha nova, a partir do link do e-mail (`/redefinir/:token`).
 *
 * "Desconectar os outros aparelhos" nasce marcado: quem redefine costuma ter perdido
 * o acesso ou desconfiar dele, e manter as sessões antigas manteria quem invadiu lá
 * dentro. O padrão é o que a maioria aceita sem ler, então ele é o seguro.
 *
 * O servidor não devolve sessão ao redefinir, então não há "Salvar e entrar" como no
 * desenho: depois de salvar, a pessoa vai à entrada e digita a senha nova. Falha de
 * link vencido aparece aqui mesmo, com o caminho para pedir outro.
 */
export function TelaDeRedefinirSenha({
  concluida,
  salvando,
  motivo,
  aoSalvar,
  aoPedirNovoLink,
  aoEntrar,
}: TelaDeRedefinirSenhaProps) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [derrubar, setDerrubar] = useState(true);
  const t = sessao.redefinir;

  const diferentes = confirmar !== "" && confirmar !== senha;
  const iguais = confirmar !== "" && confirmar === senha && senha.length >= MINIMO_DA_SENHA;
  const podeEnviar = senha.length >= MINIMO_DA_SENHA && confirmar === senha && !salvando;

  if (concluida) {
    return (
      <MoldeDaEntrada titulo={t.prontoTitulo}>
        <div className={css.resultado}>
          <span className={css.selo}>
            <Confirmado tamanho={20} />
          </span>
          <p className={css.recado}>{derrubar ? t.prontoTextoDerrubou : t.prontoTexto}</p>
        </div>
        <Botao className={css.largo} onClick={aoEntrar}>
          {t.entrar}
        </Botao>
      </MoldeDaEntrada>
    );
  }

  return (
    <MoldeDaEntrada titulo={t.titulo} subtitulo={t.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) aoSalvar(senha, derrubar);
        }}
      >
        {motivo !== undefined && <AvisoSimples tom="erro">{motivo}</AvisoSimples>}

        <div>
          <CampoDeTexto
            rotulo={t.senha}
            type="password"
            revelavel
            autoComplete="new-password"
            autoFocus
            placeholder={sessao.criar.senhaExemplo}
            value={senha}
            readOnly={salvando}
            onChange={(e) => setSenha(e.target.value)}
          />
          <MedidorDeSenha senha={senha} />
        </div>

        <div>
          <CampoDeTexto
            rotulo={t.confirmar}
            type="password"
            autoComplete="new-password"
            placeholder={t.confirmarExemplo}
            value={confirmar}
            readOnly={salvando}
            erro={diferentes ? t.diferentes : undefined}
            onChange={(e) => setConfirmar(e.target.value)}
          />
          {iguais && (
            <p className={css.confirmacaoIgual} role="status">
              <Confirmado tamanho={14} />
              {t.iguais}
            </p>
          )}
        </div>

        <label className={css.manter}>
          <input
            type="checkbox"
            checked={derrubar}
            disabled={salvando}
            onChange={(e) => setDerrubar(e.target.checked)}
          />
          <span>{t.derrubar}</span>
        </label>

        <Botao type="submit" className={css.largo} carregando={salvando} disabled={!podeEnviar && !salvando}>
          {salvando ? t.salvando : t.salvar}
        </Botao>
      </form>

      <Botao variante="fantasma" className={css.largo} disabled={salvando} onClick={aoPedirNovoLink}>
        {t.pedirNovo}
      </Botao>
    </MoldeDaEntrada>
  );
}
