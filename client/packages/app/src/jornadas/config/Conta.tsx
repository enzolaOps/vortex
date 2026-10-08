import {
  lerMeuEmail,
  pedirExclusaoComMotivo,
  servidoresQueEuDono,
  trocarEmailComMotivo,
  trocarNomeDeUsuarioComMotivo,
  trocarSenhaComMotivo,
  type CausaDeConta,
} from "nucleo/sdk/perfil";
import { useEffect, useState } from "react";

import { config } from "../../textos";
import { Botao } from "../../ui/ds";
import { toast } from "../../ui/primitivos/Avisos";
import {
  Bloco,
  Divisor,
  estilosDeConfig as ec,
  LinhaDeAjuste,
  Pagina,
  PaginaCarregando,
  PaginaComFalha,
} from "./controles";
import { DialogoDeConta, type ErroNoDialogo } from "./DialogoDeConta";
import { avisarPerfilMudou } from "./perfilMudou";
import { useMeuPerfil } from "./useMeuPerfil";

const t = config.contaTela;

/** `r***@exemplo.com`: o suficiente para reconhecer, nunca para copiar de uma captura de tela. */
export function mascararEmail(email: string): string {
  const arroba = email.lastIndexOf("@");
  if (arroba <= 0) return email;
  return `${email.slice(0, 1)}***${email.slice(arroba)}`;
}

/** Onde cada causa aparece e o que diz. `campoSenha` é a chave do campo de senha do diálogo. */
const FRASE_DA_CAUSA: Record<CausaDeConta, string> = {
  senhaIncorreta: t.erroSenhaAtual,
  senhaFraca: t.erroSenhaFraca,
  emailEmUso: t.erroEmailEmUso,
  nomeEmUso: t.erroNomeEmUso,
  limite: t.erroLimite,
  outra: t.erroGenerico,
};

function traduzirCausa(
  causa: CausaDeConta,
  campos: {
    readonly senha: string;
    readonly email?: string;
    readonly nome?: string;
    readonly nova?: string;
  },
): ErroNoDialogo {
  const chave =
    causa === "senhaIncorreta"
      ? campos.senha
      : causa === "emailEmUso"
        ? (campos.email ?? "geral")
        : causa === "nomeEmUso"
          ? (campos.nome ?? "geral")
          : causa === "senhaFraca"
            ? (campos.nova ?? "geral")
            : "geral";
  return { chave, texto: FRASE_DA_CAUSA[causa] };
}

type Aberto = "nome" | "email" | "senha" | "excluir" | undefined;

/** Conta (PRD 4.6): nome de usuário, e-mail, senha e excluir. */
export function Conta() {
  const { eu, falhou, tentarDeNovo } = useMeuPerfil();
  const [aberto, setAberto] = useState<Aberto>(undefined);
  const [email, setEmail] = useState<
    | { estado: "carregando" }
    | { estado: "falhou" }
    | { estado: "ok"; valor: string }
  >({
    estado: "carregando",
  });
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    let vivo = true;
    void lerMeuEmail().then((v) => {
      if (vivo)
        setEmail(
          v === undefined ? { estado: "falhou" } : { estado: "ok", valor: v },
        );
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (!eu) return falhou ? <PaginaComFalha aoTentarDeNovo={tentarDeNovo} /> : <PaginaCarregando />;
  const fechar = (a: boolean) => {
    if (!a) setAberto(undefined);
  };

  return (
    <Pagina>
      <Bloco>
        <LinhaDeAjuste nome={t.nomeDeUsuario} descricao={`@${eu.username}`}>
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => {
              setAberto("nome");
            }}
          >
            {t.trocarNome}
          </Botao>
        </LinhaDeAjuste>
      </Bloco>

      <Divisor />

      <Bloco>
        <LinhaDeAjuste
          nome={t.email}
          descricao={
            email.estado === "carregando"
              ? config.carregando
              : email.estado === "falhou"
                ? t.emailIndisponivel
                : mostrar
                  ? email.valor
                  : mascararEmail(email.valor)
          }
        >
          <div className={ec.acoes}>
            {email.estado === "ok" && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                aria-pressed={mostrar}
                onClick={() => {
                  setMostrar((m) => !m);
                }}
              >
                {mostrar ? t.emailEsconder : t.emailMostrar}
              </Botao>
            )}
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => {
                setAberto("email");
              }}
            >
              {t.trocarEmail}
            </Botao>
          </div>
        </LinhaDeAjuste>
      </Bloco>

      <Divisor />

      <Bloco>
        <LinhaDeAjuste nome={t.senha} descricao={t.senhaMascara}>
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => {
              setAberto("senha");
            }}
          >
            {t.trocarSenha}
          </Botao>
        </LinhaDeAjuste>
      </Bloco>

      <Divisor />

      <Bloco>
        <h3 className={ec.titulo}>{t.excluir}</h3>
        <p className={ec.texto}>{t.excluirDica}</p>
        <div className={ec.acoes}>
          <Botao
            variante="perigo"
            tamanho="sm"
            onClick={() => {
              setAberto("excluir");
            }}
          >
            {t.excluirBotao}
          </Botao>
        </div>
      </Bloco>

      {aberto === "nome" && (
        <DialogoDeConta
          aberto
          aoMudar={fechar}
          titulo={t.nomeDeUsuario}
          descricao={t.nomeDeUsuarioDica}
          campos={[
            {
              chave: "nome",
              rotulo: t.nomeDeUsuario,
              inicial: eu.username,
              autoComplete: "username",
            },
            {
              chave: "senha",
              rotulo: t.senhaAtual,
              tipo: "password",
              autoComplete: "current-password",
            },
          ]}
          confirmar={t.trocarNome}
          validar={(v) =>
            v["nome"]?.trim() && v["senha"]
              ? undefined
              : { geral: t.erroGenerico }
          }
          enviar={(v) =>
            trocarNomeDeUsuarioComMotivo(
              (v["nome"] ?? "").trim(),
              v["senha"] ?? "",
            )
          }
          traduzir={(f) =>
            traduzirCausa(f.causa, { senha: "senha", nome: "nome" })
          }
          aoConcluir={() => {
            avisarPerfilMudou();
            toast({ tipo: "info", titulo: t.nomeTrocado });
          }}
        />
      )}

      {aberto === "email" && (
        <DialogoDeConta
          aberto
          aoMudar={fechar}
          titulo={t.emailNovo}
          descricao={t.emailDica}
          campos={[
            {
              chave: "email",
              rotulo: t.emailNovo,
              tipo: "email",
              autoComplete: "email",
            },
            {
              chave: "senha",
              rotulo: t.senhaAtual,
              tipo: "password",
              autoComplete: "current-password",
            },
          ]}
          confirmar={t.trocarEmail}
          validar={(v) =>
            v["email"]?.trim() && v["senha"]
              ? undefined
              : { geral: t.erroGenerico }
          }
          enviar={(v) =>
            trocarEmailComMotivo((v["email"] ?? "").trim(), v["senha"] ?? "")
          }
          traduzir={(f) =>
            traduzirCausa(f.causa, { senha: "senha", email: "email" })
          }
          aoConcluir={() => {
            toast({ tipo: "info", titulo: t.emailTrocado });
          }}
        />
      )}

      {aberto === "senha" && (
        <DialogoDeConta
          aberto
          aoMudar={fechar}
          titulo={t.trocarSenhaTitulo}
          descricao={t.trocarSenhaDescricao}
          campos={[
            {
              chave: "atual",
              rotulo: t.senhaAtual,
              tipo: "password",
              autoComplete: "current-password",
            },
            {
              chave: "nova",
              rotulo: t.senhaNova,
              tipo: "password",
              autoComplete: "new-password",
            },
            {
              chave: "confirmar",
              rotulo: t.senhaConfirmar,
              tipo: "password",
              autoComplete: "new-password",
            },
          ]}
          confirmar={t.trocarSenha}
          validar={(v) => {
            const erros: Record<string, string> = {};
            if (!v["atual"]) erros["atual"] = t.erroSenhaAtual;
            if ((v["nova"] ?? "").length < 8) erros["nova"] = t.erroSenhaCurta;
            else if (v["nova"] !== v["confirmar"])
              erros["confirmar"] = t.erroSenhasDiferentes;
            return Object.keys(erros).length > 0 ? erros : undefined;
          }}
          enviar={(v) =>
            trocarSenhaComMotivo(v["nova"] ?? "", v["atual"] ?? "")
          }
          traduzir={(f) =>
            traduzirCausa(f.causa, { senha: "atual", nova: "nova" })
          }
          aoConcluir={() => {
            toast({ tipo: "info", titulo: t.senhaTrocada });
          }}
        />
      )}

      {aberto === "excluir" && (
        <ExcluirConta nomeDeUsuario={eu.username} aoMudar={fechar} />
      )}
    </Pagina>
  );
}

function ExcluirConta({
  nomeDeUsuario,
  aoMudar,
}: {
  nomeDeUsuario: string;
  aoMudar: (aberto: boolean) => void;
}) {
  // A posse de servidor não muda enquanto o diálogo está aberto: lê-se uma vez.
  const [donos] = useState(() => servidoresQueEuDono());
  const bloqueada = donos.length > 0;

  return (
    <DialogoDeConta
      aberto
      aoMudar={aoMudar}
      titulo={t.excluirTitulo}
      campos={
        bloqueada
          ? []
          : [
              { chave: "confirmar", rotulo: t.excluirConfirmarNome },
              {
                chave: "senha",
                rotulo: t.senhaAtual,
                tipo: "password",
                autoComplete: "current-password",
              },
            ]
      }
      aviso={
        <p className={ec.texto}>
          {bloqueada ? t.excluirDono(donos.length) : t.excluirAviso}
        </p>
      }
      confirmar={t.excluirConfirmar}
      perigo
      validar={(v): Record<string, string> | undefined => {
        if (bloqueada) return { geral: t.excluirDono(donos.length) };
        if (
          (v["confirmar"] ?? "").trim().toLowerCase() !==
          nomeDeUsuario.toLowerCase()
        ) {
          return { confirmar: t.excluirConfirmarNome };
        }
        return v["senha"] ? undefined : { senha: t.erroSenhaAtual };
      }}
      enviar={(v) => pedirExclusaoComMotivo("senha", v["senha"] ?? "")}
      traduzir={(f) => traduzirCausa(f.causa, { senha: "senha" })}
      aoConcluir={() => {
        toast({ tipo: "info", titulo: t.excluirEnviado });
      }}
    />
  );
}
