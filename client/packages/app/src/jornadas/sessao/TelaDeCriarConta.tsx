import { useState } from "react";
import { exigeConvite } from "nucleo/sdk/config";

import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { AvisoSimples } from "./AvisoDeEntrada";
import { CampoDeTexto } from "./CampoDeTexto";
import css from "./Entrada.module.css";
import { MedidorDeSenha } from "./MedidorDeSenha";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { MINIMO_DA_SENHA, emailPlausivel, problemaDoUsuario } from "./regras";

export interface DadosDoCadastro {
  usuario: string;
  email: string;
  senha: string;
  convite: string | undefined;
}

export interface TelaDeCriarContaProps {
  /** Falha da tentativa anterior, na frase do servidor. */
  motivo?: string;
  criando: boolean;
  aoCriar: (dados: DadosDoCadastro) => void;
  aoEntrar: () => void;
}

function frase(p: ReturnType<typeof problemaDoUsuario>, tamanho: number): string | undefined {
  const t = sessao.nome;
  if (p === "curto") return t.curto(2 - tamanho);
  if (p === "longo") return t.longo;
  if (p === "invalido") return t.invalido;
  return undefined;
}

/**
 * Criar conta: usuário, e-mail, senha, convite opcional.
 *
 * O protocolo só aceita e-mail, senha e convite na criação; o nome de usuário
 * escolhido aqui espera a conta existir e é aplicado no primeiro acesso (o núcleo o
 * guarda, ver `guardarEscolhaDeIdentidade`). Quem se cadastra decide quem é uma vez
 * só: partir em duas telas seria expor um detalhe de transporte.
 *
 * Não há selo de "disponível": nenhuma rota pergunta se um nome está livre, e um
 * selo verde que não consultou nada afirma o que não sabe. A colisão aparece no
 * envio, com a frase do servidor. "Termos" e "política" do desenho não existem
 * nesta instância; a frase fala das regras dela, sem link para lugar nenhum.
 */
export function TelaDeCriarConta({ motivo, criando, aoCriar, aoEntrar }: TelaDeCriarContaProps) {
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [convite, setConvite] = useState("");
  const obrigatorio = exigeConvite();

  const usuarioLimpo = usuario.trim();
  const problema = problemaDoUsuario(usuarioLimpo);
  const podeEnviar =
    usuarioLimpo.length >= 2 &&
    problema === undefined &&
    emailPlausivel(email) &&
    senha.length >= MINIMO_DA_SENHA &&
    (!obrigatorio || convite.trim() !== "") &&
    !criando;

  return (
    <MoldeDaEntrada titulo={sessao.criar.titulo} subtitulo={sessao.criar.subtitulo}>
      <form
        className={css.formulario}
        noValidate
        onSubmit={(evento) => {
          evento.preventDefault();
          if (podeEnviar) {
            aoCriar({
              usuario: usuarioLimpo,
              email: email.trim(),
              senha,
              convite: convite.trim() === "" ? undefined : convite.trim(),
            });
          }
        }}
      >
        {motivo !== undefined && <AvisoSimples tom="erro">{motivo}</AvisoSimples>}

        <CampoDeTexto
          rotulo={sessao.criar.usuario}
          prefixo="@"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          placeholder={sessao.criar.usuarioExemplo}
          dica={problema === undefined ? sessao.criar.usuarioDica : undefined}
          erro={frase(problema, usuarioLimpo.length)}
          value={usuario}
          readOnly={criando}
          onChange={(e) => setUsuario(e.target.value)}
        />

        <CampoDeTexto
          rotulo={sessao.criar.email}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={sessao.criar.emailExemplo}
          value={email}
          readOnly={criando}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <CampoDeTexto
            rotulo={sessao.criar.senha}
            type="password"
            revelavel
            autoComplete="new-password"
            placeholder={sessao.criar.senhaExemplo}
            value={senha}
            readOnly={criando}
            onChange={(e) => setSenha(e.target.value)}
          />
          <MedidorDeSenha senha={senha} />
        </div>

        <CampoDeTexto
          rotulo={obrigatorio ? sessao.criar.convite : `${sessao.criar.convite} ${sessao.criar.conviteOpcional}`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={sessao.criar.conviteExemplo}
          dica={obrigatorio ? sessao.criar.conviteObrigatorio : undefined}
          value={convite}
          readOnly={criando}
          onChange={(e) => setConvite(e.target.value)}
        />

        <p className={css.dica}>{sessao.criar.regras}</p>

        <Botao type="submit" className={css.largo} carregando={criando} disabled={!podeEnviar && !criando}>
          {criando ? sessao.criar.criando : sessao.criar.criar}
        </Botao>
      </form>

      <p className={css.rodape}>
        {sessao.criar.jaTemConta}{" "}
        <button type="button" className={css.link} disabled={criando} onClick={aoEntrar}>
          {sessao.criar.entrar}
        </button>
      </p>
    </MoldeDaEntrada>
  );
}
