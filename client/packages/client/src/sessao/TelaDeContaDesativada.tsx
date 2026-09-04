import { Botao } from "../components/ui/Botao";
import { sair } from "../sdk/autenticacao";
import css from "./TelaDeLogin.module.css";

/**
 * A conta foi desativada.
 *
 * O protocolo devolve `result: "Disabled"` no login, e o upstream responde a
 * isso com `alert("Account is disabled, run special logic here.")` e um
 * `// TODO`. Uma caixa do sistema com texto escrito para quem programa é o
 * pior lugar possível para a notícia mais séria que este fluxo dá.
 *
 * Estado próprio e não `erro` porque a AÇÃO é outra: senha errada se resolve
 * tentando de novo, e é isso que a tela de entrada oferece. Conta desativada
 * não se resolve em tela nenhuma — o que resta é saber a quem falar.
 *
 * O texto não acusa e não pede desculpa: quem lê isto já está numa situação
 * ruim, e "Ops, algo deu errado" seria falso além de inútil. Diz o que houve e
 * qual é o único caminho.
 */
export function TelaDeContaDesativada() {
  return (
    <div className={css.tela}>
      <div className={css.cartao}>
        <h1 className={css.titulo}>Esta conta está desativada</h1>

        <p className={css.recado}>
          O acesso foi suspenso pela administração do servidor. Nada do que você
          escreveu foi apagado.
        </p>

        <p className={css.recado}>
          Quem administra esta instância é quem pode reverter — fale com essa
          pessoa.
        </p>

        {/*
          Sair é a única ação real desta tela, e ela existe para o caso comum:
          a máquina tem mais de uma conta. Sem o botão, o token desativado fica
          guardado e toda abertura cai aqui de novo.
        */}
        <Botao variante="neutro" onClick={() => void sair()}>
          Entrar com outra conta
        </Botao>
      </div>
    </div>
  );
}
