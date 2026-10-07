import { useEffect, useRef, useState } from "react";
import type { CausaDeErro } from "nucleo/store/sessao";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { AvisoDeEntrada, fraseDaCausa } from "./AvisoDeEntrada";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";

export interface TelaDeEntradaProps {
  /** Entrada em voo: o botão vira `carregando` e os campos ficam só de leitura. */
  entrando: boolean;
  causa?: CausaDeErro;
  /** Frase pronta da camada de rede, para a causa que a tela não conhece. */
  motivo?: string;
  aoEntrar: (identificador: string, senha: string, manterConectado: boolean) => void;
}

/**
 * Entrar com e-mail ou usuário e senha.
 *
 * `<form>` de verdade: Enter envia, o gerenciador de senhas reconhece os campos e
 * o navegador oferece preencher. Os valores digitados NÃO são limpos quando a
 * tentativa falha: o estado de erro é a mesma tela, no mesmo lugar da árvore, e é
 * isso que mantém o que a pessoa escreveu.
 *
 * Credencial errada marca os dois campos (não dá para saber qual está errado) e a
 * frase fica junto da senha. Rede, limite e servidor não são culpa dos campos:
 * viram aviso no alto, e os campos continuam intactos.
 *
 * Criar conta, recuperar senha e entrar por QR não estão aqui: são do M8, e um
 * controle que ainda não leva a lugar nenhum é pior que a ausência dele.
 */
export function TelaDeEntrada({ entrando, causa, motivo, aoEntrar }: TelaDeEntradaProps) {
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [manter, setManter] = useState(true);
  const campoDaSenha = useRef<HTMLInputElement>(null);

  const credenciais = causa?.tipo === "credenciais";
  const aviso = causa !== undefined || motivo !== undefined;
  const podeEnviar = identificador.trim() !== "" && senha !== "" && !entrando;

  // Depois de errar a senha o foco volta para ela: é o campo que se corrige.
  useEffect(() => {
    if (credenciais) campoDaSenha.current?.focus();
  }, [credenciais, causa]);

  return (
    <MoldeDaEntrada titulo={sessao.entrada.titulo} subtitulo={sessao.entrada.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) aoEntrar(identificador.trim(), senha, manter);
        }}
      >
        {aviso && !credenciais && <AvisoDeEntrada causa={causa} motivo={motivo} />}

        <CampoDeTexto
          rotulo={sessao.entrada.identificador}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder={sessao.entrada.identificadorExemplo}
          value={identificador}
          readOnly={entrando}
          invalido={credenciais}
          onChange={(e) => setIdentificador(e.target.value)}
        />

        <CampoDeTexto
          campoRef={campoDaSenha}
          rotulo={sessao.entrada.senha}
          type="password"
          revelavel
          autoComplete="current-password"
          placeholder={sessao.entrada.senhaExemplo}
          value={senha}
          readOnly={entrando}
          erro={credenciais ? fraseDaCausa(causa, motivo) : undefined}
          onChange={(e) => setSenha(e.target.value)}
        />

        <label className={css.manter}>
          <input
            type="checkbox"
            checked={manter}
            disabled={entrando}
            onChange={(e) => setManter(e.target.checked)}
          />
          <span>{sessao.entrada.manterConectado}</span>
        </label>

        <Botao type="submit" className={css.largo} carregando={entrando} disabled={!podeEnviar && !entrando}>
          {entrando ? sessao.entrada.entrando : sessao.entrada.entrar}
        </Botao>
      </form>
    </MoldeDaEntrada>
  );
}
