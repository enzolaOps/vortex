import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

import { ligarLogoutDoServidor, restaurarSessao } from "../sdk/autenticacao";
import { lerEntrada } from "../store/entrada";
import { abrirModal } from "../store/modais";
import { assinarSessao, lerSessao, type EstadoDaSessao } from "../store/sessao";
import { Autenticacao } from "./Autenticacao";
import { TelaDeContaDesativada } from "./TelaDeContaDesativada";
import { TelaDeMfa } from "./TelaDeMfa";
import { TelaDeNome } from "./TelaDeNome";

/**
 * O portão: sem sessão não há canal, autor nem permissão.
 *
 * Vem antes do shell de propósito. Montar o app e esconder o conteúdo faria
 * cada painel assinar entidades que não existem, e o adapter abrir subscrições
 * para uma sessão que não há.
 */
export function PortaoDeSessao({ children }: { children: ReactNode }) {
  const sessao = useSyncExternalStore(assinarSessao, lerSessao);
  const jaRestaurou = useRef(false);

  useEffect(() => {
    /*
      A ORDEM importa e está medida: `ligarLogoutDoServidor` ANTES de
      `restaurarSessao`. A restauração abre o socket, e um token revogado é
      recusado durante essa abertura — com o ouvinte instalado depois, o evento
      passaria antes de haver quem o escutasse, e o app ficaria numa tela viva
      com socket morto.
    */
    /*
      ⚠ **A guarda de uma vez só, e ela existe porque o `StrictMode` abria
      DOIS sockets.** O React invoca efeitos duas vezes em desenvolvimento, de
      propósito, para revelar efeito não idempotente. `restaurarSessao` abre
      socket, e abrir dois é exatamente o defeito que ele existe para mostrar.

      Medido com um contador em `conectar()`: **2 sem esta guarda, 1 com ela**.

      Mora AQUI e não em `sdk/autenticacao.ts`, e a primeira versão errou o
      lugar: um latch module-level lá dentro atravessava os testes de
      `login.test.ts`, que instalam a mesma sessão em vários casos, e reprovou
      três deles. O duplo é deste efeito; a guarda também deve ser.

      `useRef` e não `useState`: o valor não pinta nada, e refs sobrevivem ao
      desmonte simulado do `StrictMode` — que é o que faz a guarda funcionar.

      ⚠ Ela NÃO impede reconexão: quem reconecta é o `EventClient` do SDK,
      sozinho, e este efeito roda uma vez por carga de página.
    */
    if (jaRestaurou.current) return;
    jaRestaurou.current = true;

    ligarLogoutDoServidor();
    restaurarSessao();
  }, []);

  /*
    O convite sobrevive ao login.

    Sem isto, quem abre `/convite/abc` sem conta vê a prévia, entra, e cai no
    app sem nenhuma pista de para onde ia — teria de pedir o link de novo. O
    código fica no store de entrada e o modal o consome assim que a sessão
    vale; o `useEffect` depende do estado para rodar na TRANSIÇÃO, não a cada
    render.
  */
  useEffect(() => {
    if (sessao.estado !== "dentro") return;
    if (lerEntrada().tipo !== "convite") return;
    abrirModal("adicionarServidor");
  }, [sessao.estado]);

  /*
    O `Record` fica DENTRO para enxergar o snapshot sem virar prop-drilling, e
    é reconstruído por render — o que custa um objeto de sete funções numa
    árvore que só re-renderiza quando a sessão muda, ou seja, quase nunca.

    ⚠ **A exaustividade é o ponto, e ela não existia.** Isto era um `if`/`else`
    encadeado: `desconhecida` devolvia `null`, `dentro` devolvia o app, e TODO O
    RESTO caía no login. Quando a etapa 2 acrescentou `mfa` e `desativada`, os
    dois teriam caído calados na tela de senha — a pessoa com segundo fator
    veria o formulário de novo, sem explicação, para sempre.

    Com `Record<EstadoDaSessao, …>`, estado novo não compila até ter tela.
    Mesma mecânica de `NOME_DO_PAINEL` sobre `PainelId` e do registro de modais.
  */
  const TELA: Record<EstadoDaSessao, () => ReactNode> = {
    /*
      Nada, e não um carregando.

      A primeira pergunta do app é ao armazenamento local: síncrona, mas não
      instantânea. Renderizar a tela de login enquanto se descobre que já há
      sessão faria a tela piscar em toda abertura, e um spinner de 8ms pisca
      igual.
    */
    desconhecida: () => null,
    dentro: () => <>{children}</>,
    /*
      As três caem no mesmo lugar de propósito: quem escolhe entre entrar,
      criar conta e recuperar senha é o store de entrada, não o de sessão.
      `entrando` e `erro` são a MESMA tela em outro momento.
    */
    fora: () => <Autenticacao entrando={false} motivo={undefined} />,
    entrando: () => <Autenticacao entrando motivo={undefined} />,
    erro: () => <Autenticacao entrando={false} motivo={sessao.motivo} />,
    mfa: () => (
      <TelaDeMfa
        metodos={sessao.metodos}
        entrando={sessao.ocupada}
        motivo={sessao.motivo}
      />
    ),
    nome: () => <TelaDeNome motivo={sessao.motivo} />,
    desativada: () => <TelaDeContaDesativada />,
  };

  return TELA[sessao.estado]();
}
