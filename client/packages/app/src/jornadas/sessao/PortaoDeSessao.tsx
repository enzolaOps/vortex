import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cancelarMfa, entrar, responderMfa } from "nucleo/sdk/autenticacao";
import { escolherNome } from "nucleo/sdk/conta";
import { assinarSessao, lerSessao, type EstadoDaSessao } from "nucleo/store/sessao";

import { encerrarSessao, estaEncerrando, iniciarSessao, recarregarPagina } from "./encerrar";
import { TelaDeContaDesativada } from "./TelaDeContaDesativada";
import { TelaDeEntrada } from "./TelaDeEntrada";
import { TelaDeMfa } from "./TelaDeMfa";
import { TelaDeNome } from "./TelaDeNome";
import { TelaDeRestauracao } from "./TelaDeRestauracao";

export interface PortaoDeSessaoProps {
  children: ReactNode;
  /** O que roda uma vez ao abrir. Os testes trocam por nada e dirigem o estado à mão. */
  iniciar?: () => void;
  /** Chamado quando o servidor derruba a sessão que estava dentro. */
  aoSerDerrubada?: () => void;
}

function TelaDeNomeDoPortao({ motivo }: { motivo: string | undefined }) {
  const [salvando, setSalvando] = useState(false);
  return (
    <TelaDeNome
      motivo={motivo}
      salvando={salvando}
      aoEscolher={(nome) => {
        setSalvando(true);
        void escolherNome(nome).finally(() => {
          setSalvando(false);
        });
      }}
      aoCancelar={() => void encerrarSessao()}
    />
  );
}

/**
 * O portão: sem sessão não há canal, autor nem permissão.
 *
 * Vem antes do shell de propósito. Montar o app e esconder o conteúdo faria cada
 * painel assinar entidades que não existem.
 *
 * ⚠ O `Record` é EXAUSTIVO sobre `EstadoDaSessao`: estado novo no núcleo não compila
 * até ter tela aqui. Um `if`/`else` mandaria todo estado esquecido para a tela de
 * senha, e quem tem segundo fator veria o formulário de novo, sem explicação.
 *
 * `desconhecida` (a primeira pergunta ao armazenamento ainda não terminou) mostra o
 * esqueleto do shell, nunca a tela de entrada: abrir o app com sessão guardada não
 * pode piscar um login.
 */
export function PortaoDeSessao({
  children,
  iniciar = iniciarSessao,
  aoSerDerrubada = recarregarPagina,
}: PortaoDeSessaoProps) {
  const sessao = useSyncExternalStore(assinarSessao, lerSessao);
  const jaIniciou = useRef(false);
  const anterior = useRef<EstadoDaSessao>(sessao.estado);

  useEffect(() => {
    // O StrictMode roda o efeito duas vezes; restaurar abre socket e abrir dois é o defeito.
    if (jaIniciou.current) return;
    jaIniciou.current = true;
    iniciar();
  }, [iniciar]);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = sessao.estado;
    // Dentro e, de repente, fora, sem ter sido a pessoa: o servidor derrubou a sessão.
    // Recarrega para a página nascer sem dado nem ouvinte da conta que caiu.
    if (antes === "dentro" && sessao.estado === "fora" && !estaEncerrando()) aoSerDerrubada();
  }, [sessao.estado, aoSerDerrubada]);

  const entrada = (entrando: boolean) => (
    <TelaDeEntrada
      entrando={entrando}
      causa={sessao.causa}
      motivo={sessao.motivo}
      aoEntrar={(identificador, senha, manter) => void entrar(identificador, senha, manter)}
    />
  );

  const TELA: Record<EstadoDaSessao, () => ReactNode> = {
    desconhecida: () => <TelaDeRestauracao />,
    // Entrar e errar são a MESMA tela em outro momento: o mesmo lugar na árvore mantém o que foi digitado.
    fora: () => entrada(false),
    entrando: () => entrada(true),
    erro: () => entrada(false),
    mfa: () => (
      <TelaDeMfa
        metodos={sessao.metodos}
        verificando={sessao.ocupada}
        incorreto={sessao.motivo !== undefined}
        aoVerificar={(metodo, valor) => void responderMfa(metodo, valor)}
        aoCancelar={cancelarMfa}
      />
    ),
    nome: () => <TelaDeNomeDoPortao motivo={sessao.motivo} />,
    desativada: () => <TelaDeContaDesativada aoTrocarDeConta={() => void encerrarSessao()} />,
    dentro: () => <>{children}</>,
  };

  return TELA[sessao.estado]();
}
