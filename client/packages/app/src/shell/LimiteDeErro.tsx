import { Component, type ErrorInfo, type ReactNode } from "react";

import { comum, shell } from "../textos";
import { Botao, PainelVidro } from "../ui/ds";
import css from "./Regioes.module.css";

export interface LimiteDeErroProps {
  children: ReactNode;
  /** Nome da região, para o leitor de tela ("Conversa", "Membros online"…). */
  rotulo?: string;
  /** Muda ao trocar de lugar (canal, servidor): o limite esquece o erro e remonta. */
  chave?: string;
}

interface Estado {
  readonly erro: boolean;
  /** Incrementa em "Tentar de novo": é a `key` dos filhos, então eles REMONTAM. */
  readonly tentativa: number;
  readonly chave: string | undefined;
}

/**
 * Limite de erro de uma região do shell. Uma região que lança mostra uma frase
 * sem jargão e "Tentar de novo"; as outras seguem de pé. A mensagem técnica vai
 * ao console, nunca à tela: ela é escrita para quem programa e pode carregar
 * conteúdo de terceiro. Única classe do projeto, porque `componentDidCatch`
 * só existe em classe.
 */
export class LimiteDeErro extends Component<LimiteDeErroProps, Estado> {
  override state: Estado = { erro: false, tentativa: 0, chave: this.props.chave };

  static getDerivedStateFromError(): Partial<Estado> {
    return { erro: true };
  }

  static getDerivedStateFromProps(props: LimiteDeErroProps, estado: Estado): Partial<Estado> | null {
    if (props.chave !== estado.chave) return { chave: props.chave, erro: false };
    return null;
  }

  override componentDidCatch(erro: unknown, info: ErrorInfo): void {
    console.error("Região do shell quebrou", erro, info.componentStack);
  }

  private readonly tentarDeNovo = () => {
    this.setState((e) => ({ erro: false, tentativa: e.tentativa + 1 }));
  };

  override render(): ReactNode {
    if (this.state.erro) {
      return (
        <PainelVidro
          como="section"
          raio="xl"
          aria-label={this.props.rotulo ?? shell.erro.rotulo}
          className={css.painel}
          data-testid="limite-de-erro"
        >
          <div className={css.erro} role="alert">
            <p className={css.erroTexto}>{shell.erro.frase}</p>
            <Botao variante="fantasma" tamanho="sm" onClick={this.tentarDeNovo}>
              {comum.tentarDeNovo}
            </Botao>
          </div>
        </PainelVidro>
      );
    }
    return <div key={this.state.tentativa} className={css.regiao}>{this.props.children}</div>;
  }
}
