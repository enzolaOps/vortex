import { useSyncExternalStore, type ReactNode } from "react";

import {
  assinarEntrada,
  lerEntrada,
  type TelaDeEntrada,
} from "../store/entrada";
import { TelaDeConferirEmail } from "./TelaDeConferirEmail";
import { TelaDeConvite } from "./TelaDeConvite";
import { TelaDeCriarConta } from "./TelaDeCriarConta";
import { TelaDeLogin } from "./TelaDeLogin";
import { TelaDeRecuperarSenha } from "./TelaDeRecuperarSenha";
import { TelaDeRedefinirSenha } from "./TelaDeRedefinirSenha";
import { TelaDeVerificarEmail } from "./TelaDeVerificarEmail";

/**
 * Qual das telas de fora aparece.
 *
 * Fica separado do `PortaoDeSessao` porque as duas perguntas são diferentes: o
 * portão responde "quem é você" e este responde "o que você está tentando
 * fazer". Juntá-los daria um `Record` de dez entradas onde metade das
 * combinações não existe.
 *
 * Assina o store aqui e não no portão: trocar de tela de entrada não pode
 * acordar a árvore que contém o app.
 */
export function Autenticacao({
  entrando,
  motivo,
}: {
  entrando: boolean;
  motivo: string | undefined;
}) {
  const tela = useSyncExternalStore(assinarEntrada, lerEntrada);

  /*
    `Record` sobre o TIPO da união, e não `switch`, pela razão de sempre neste
    projeto: tela nova na união não compila até existir. Foi assim que
    `EstadoDaSessao` pegou `mfa` e `nome` antes de eles chegarem à tela errada.
  */
  const TELA: Record<TelaDeEntrada["tipo"], () => ReactNode> = {
    entrar: () => <TelaDeLogin entrando={entrando} motivo={motivo} />,
    criar: () => <TelaDeCriarConta motivo={motivo} />,
    recuperar: () => <TelaDeRecuperarSenha motivo={motivo} />,
    conferirEmail: () => (
      <TelaDeConferirEmail
        email={tela.tipo === "conferirEmail" ? tela.email : undefined}
      />
    ),
    verificar: () => (
      <TelaDeVerificarEmail
        token={tela.tipo === "verificar" ? tela.token : ""}
        motivo={motivo}
      />
    ),
    convite: () => (
      <TelaDeConvite codigo={tela.tipo === "convite" ? tela.codigo : ""} />
    ),
    redefinir: () => (
      <TelaDeRedefinirSenha
        token={tela.tipo === "redefinir" ? tela.token : ""}
        motivo={motivo}
      />
    ),
  };

  return TELA[tela.tipo]();
}
