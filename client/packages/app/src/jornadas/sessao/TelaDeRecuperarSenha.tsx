import { useState } from "react";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { Email } from "../../ui/icones";
import { AvisoSimples } from "./AvisoDeEntrada";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { ESPERA_DO_REENVIO } from "./TelaDeConferirEmail";
import { emailPlausivel } from "./regras";
import { useContagem } from "./useContagem";

export interface TelaDeRecuperarSenhaProps {
  /** O servidor consegue mandar e-mail? Sem isso o link nunca chega, e a tela precisa dizer. */
  mandaEmail: boolean;
  /** Falha do último pedido, na frase do servidor. */
  motivo?: string;
  /** Devolve se o servidor aceitou o pedido. */
  aoPedir: (email: string) => Promise<boolean>;
  aoVoltar: () => void;
}

/**
 * Recuperar senha: pedir o link e, na mesma tela, reenviar.
 *
 * A resposta é a mesma exista a conta ou não ("Se houver uma conta..."): dizer que
 * o e-mail não existe entregaria a quem digitar a lista de contas da instância.
 *
 * O terceiro passo do desenho (nova senha) é a tela do link (`/redefinir/:token`),
 * que quase sempre abre noutro aparelho: por isso ela é tela própria, não um passo
 * desta.
 */
export function TelaDeRecuperarSenha({ mandaEmail, motivo, aoPedir, aoVoltar }: TelaDeRecuperarSenhaProps) {
  const [email, setEmail] = useState("");
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const { restante, reiniciar } = useContagem(ESPERA_DO_REENVIO);

  const valido = emailPlausivel(email);
  const t = sessao.recuperar;

  function pedir(reenvio: boolean) {
    if (!valido) {
      setTentou(true);
      return;
    }
    setEnviando(true);
    void aoPedir(email.trim())
      .then((ok) => {
        if (!ok) return;
        setEnviado(true);
        setReenviado(reenvio);
        reiniciar();
      })
      .finally(() => {
        setEnviando(false);
      });
  }

  if (enviado) {
    return (
      <MoldeDaEntrada titulo={t.enviadoTitulo}>
        <div className={css.resultado}>
          <span className={css.selo}>
            <Email tamanho={20} />
          </span>
          <p className={css.recado}>{t.enviadoTexto}</p>
          <p className={css.recado}>{t.enviadoDica}</p>
        </div>
        {!mandaEmail && <AvisoSimples tom="atencao">{t.semEmail}</AvisoSimples>}
        {motivo !== undefined && <AvisoSimples tom="erro">{motivo}</AvisoSimples>}
        {reenviado && <AvisoSimples tom="sucesso">{t.reenviado}</AvisoSimples>}
        <div className={css.acoes}>
          <Botao
            variante="secundario"
            className={css.largo}
            carregando={enviando}
            disabled={restante > 0 && !enviando}
            onClick={() => {
              pedir(true);
            }}
          >
            {restante > 0 ? t.reenviarEm(restante) : t.reenviar}
          </Botao>
          <Botao
            variante="fantasma"
            className={css.largo}
            disabled={enviando}
            onClick={() => {
              setEnviado(false);
              setReenviado(false);
              setEmail("");
              setTentou(false);
            }}
          >
            {t.outroEmail}
          </Botao>
        </div>
      </MoldeDaEntrada>
    );
  }

  return (
    <MoldeDaEntrada titulo={t.titulo} subtitulo={t.subtitulo}>
      {!mandaEmail && <AvisoSimples tom="atencao">{t.semEmail}</AvisoSimples>}
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (!enviando) pedir(false);
        }}
      >
        {motivo !== undefined && <AvisoSimples tom="erro">{motivo}</AvisoSimples>}
        <CampoDeTexto
          rotulo={t.email}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder={t.emailExemplo}
          value={email}
          readOnly={enviando}
          erro={tentou && !valido ? t.emailInvalido : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Botao type="submit" className={css.largo} carregando={enviando} disabled={email.trim() === "" && !enviando}>
          {enviando ? t.enviando : t.enviar}
        </Botao>
      </form>
      <Botao variante="fantasma" className={css.largo} disabled={enviando} onClick={aoVoltar}>
        {t.voltar}
      </Botao>
    </MoldeDaEntrada>
  );
}
