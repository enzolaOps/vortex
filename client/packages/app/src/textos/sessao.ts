import { plural } from "nucleo/lib/plural";

/**
 * Textos da jornada de sessão (PRD 4.1): restaurar, entrar, segundo fator,
 * conta desativada, escolher nome e sair.
 *
 * Os erros de entrada são escolhidos por CATEGORIA (`CausaDeErro`, no núcleo): a
 * frase mora aqui, não na camada de rede. Quem digitou a senha precisa saber se
 * errou ou se o servidor não respondeu, porque as duas coisas pedem ações
 * opostas.
 */
export const sessao = {
  sair: "Sair",

  restaurando: {
    rotulo: "Restaurando sua sessão",
    mensagem: "Restaurando sua sessão…",
  },

  entrada: {
    titulo: "Entrar no Vortex",
    subtitulo: "Sua turma está esperando na sala.",
    identificador: "E-mail ou usuário",
    identificadorExemplo: "rafa@exemplo.com ou rafa",
    senha: "Senha",
    senhaExemplo: "Sua senha",
    mostrarSenha: "Mostrar senha",
    manterConectado: "Manter conectado",
    entrar: "Entrar",
    entrando: "Entrando…",
    // Os dois erros que marcam os campos ficam junto da senha, não acima do formulário.
    erro: {
      credenciais: "E-mail ou senha incorretos.",
      rede: "Sem conexão com o servidor. Confira sua internet e tente de novo.",
      servidor: "O servidor não conseguiu responder. Tente de novo em instantes.",
      naoVerificada: "Confirme seu e-mail antes de entrar.",
      soAutenticador:
        "Esta conta exige um aplicativo autenticador, e o Vortex não aceita esse método. Entre por outro aplicativo para desativá-lo.",
      limiteSemTempo: "Tentativas demais. Espere um pouco antes de tentar de novo.",
      limite: (segundos: number) =>
        `Tentativas demais. Espere ${plural(segundos, "segundo", "segundos")} antes de tentar de novo.`,
      generico: "Não deu para entrar. Tente de novo em instantes.",
    },
  },

  mfa: {
    titulo: "Verificação em duas etapas",
    subtitulo: "Confirme que é você para terminar de entrar.",
    comoVerificar: "Como verificar",
    senha: {
      aba: "Senha",
      rotulo: "Senha",
      dica: "A mesma senha da conta.",
      incorreto: "Senha incorreta.",
    },
    recuperacao: {
      aba: "Código de recuperação",
      rotulo: "Código de recuperação",
      dica: "Um dos códigos que você guardou ao ativar a verificação. Cada um serve uma vez.",
      incorreto: "Código incorreto.",
    },
    verificar: "Verificar",
    verificando: "Verificando…",
    outraConta: "Usar outra conta",
  },

  desativada: {
    titulo: "Esta conta está desativada",
    texto: "O acesso foi suspenso pela administração do servidor. Nada do que você escreveu foi apagado.",
    quemResolve: "Quem administra esta instância pode reverter. Fale com essa pessoa.",
    outraConta: "Entrar com outra conta",
  },

  nome: {
    titulo: "Escolha seu nome de usuário",
    subtitulo: "É como as pessoas encontram você. Dá para mudar o nome de exibição depois.",
    rotulo: "Nome de usuário",
    exemplo: "rafa",
    continuar: "Continuar",
    salvando: "Salvando…",
    outraConta: "Usar outra conta",
  },
} as const;
