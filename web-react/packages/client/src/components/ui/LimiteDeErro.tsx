import { Component, type ErrorInfo, type ReactNode } from "react";

import { EstadoVazio } from "./EstadoVazio";

/**
 * Limite de erro por painel.
 *
 * A auditoria de design encontrou `error` existindo em UM lugar do app
 * inteiro, contra `empty` em cinco. Este é o `error` que já pode acontecer
 * hoje, sem rede: **um painel que lança leva o shell junto**, e o que a pessoa
 * vê é a página em branco.
 *
 * É pior aqui do que seria em outro app por causa da lei nº 6. O shell é feito
 * de slots, e a promessa da fase 4 é que cada painel é uma peça independente
 * que o usuário move, esconde e troca. Um painel derrubando os outros quatro
 * desmente isso — a independência era só de posição.
 *
 * Fica em `components/ui/` e não no shell porque o dono do limite é o painel,
 * não a coluna: um painel que vira popout na fase 4 leva o seu junto.
 *
 * **Classe, e é a única do projeto.** Limite de erro não tem equivalente em
 * hook — `componentDidCatch` só existe em classe, e o React não oferece outra
 * porta. Não é código legado nem preferência: é a API.
 */
type Props = {
  /** Aparece no lugar do painel. "A lista de mensagens", "O rail". */
  oQue: string;
  children: ReactNode;
};

type Estado = { erro: Error | null };

export class LimiteDeErro extends Component<Props, Estado> {
  override state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    /*
      Console, e nada além disso por enquanto.

      Enviar para um serviço é decisão de produto com implicação de
      privacidade — o app renderiza conteúdo escrito por qualquer pessoa, e
      stack de render pode carregar dado dentro. Fica para quando houver a
      quem enviar.
    */
    console.error(`[vortex] ${this.props.oQue} falhou:`, erro, info.componentStack);
  }

  override render() {
    if (!this.state.erro) return this.props.children;

    return (
      <EstadoVazio
        compacto
        titulo={`${this.props.oQue} parou de funcionar`}
        /*
          A mensagem do erro NÃO aparece. Ela é escrita para quem programa e
          não diz nada a quem usa — e no caminho de render pode conter conteúdo
          de terceiro. Vai para o console, que é onde ela serve.
        */
        detalhe="Os outros painéis seguem funcionando. Tentar de novo costuma resolver."
        acao={{
          rotulo: "Tentar de novo",
          // Remontar é o que "tentar de novo" quer dizer aqui: o estado vive
          // no store, fora do React, então o painel volta com o dado que já
          // existe em vez de recarregar coisa nenhuma.
          aoClicar: () => this.setState({ erro: null }),
        }}
      />
    );
  }
}
