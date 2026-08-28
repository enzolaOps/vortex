import { memo } from "react";

import { achatar } from "../markdown/analisar";
import {
  chaveDeMembro,
  type BlocoDeMensagem,
  type TrechoDeMensagem,
} from "../sdk/domain";
import { administrar } from "../store/administracao";
import { useMembro, useServidorAtivo } from "../store/hooks";
import { copiarTexto } from "../lib/copiar";
import css from "./TextoDaMensagem.module.css";

/**
 * O conteúdo de uma mensagem: markdown analisado e menções resolvidas.
 *
 * Existe porque três superfícies renderizavam `message.content` cru — a linha,
 * a citação e o painel de fixados — e no minuto em que o arnês passou a gerar
 * menções de verdade, as três mostraram `<@01JQ000…>` na tela. Um texto cru do
 * protocolo aparecendo para quem usa é pior que a menção não existir.
 *
 * Desde a etapa 1 do plano de paridade ele renderiza a ÁRVORE inteira, não só
 * as menções: negrito, itálico, riscado, código, bloco de código, citação,
 * lista, título e link. Antes disso, `**negrito**` chegava à tela com os
 * asteriscos.
 *
 * Um componente e não três cópias: o que o protocolo puser no meio do texto
 * daqui em diante — canal, cargo, emoji personalizado — entra aqui uma vez.
 */

/**
 * Uma menção, resolvida.
 *
 * O nome vem da member list e NÃO do snapshot da mensagem: guardá-lo lá
 * congelaria um apelido que muda, e puxar a coleção de membros para dentro do
 * mapeamento de mensagem acoplaria as duas coleções por uma linha de texto.
 *
 * `@id` como fallback é feio de propósito. Menção a alguém que saiu do
 * servidor não vira texto invisível — continua sendo uma menção, apontando
 * para alguém que não está mais lá.
 */
const Mencao = memo(function Mencao({
  userId,
  compacto,
}: {
  userId: string;
  compacto: boolean;
}) {
  const serverId = useServidorAtivo();
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const nome = `@${membro?.displayName ?? userId}`;

  // Sem pílula no compacto: preview de uma linha é uma FRASE, e um bloco
  // tingido no meio dela pesa mais que o resto do texto inteiro.
  return compacto ? <>{nome}</> : <span className={css.mencao}>{nome}</span>;
});

/**
 * A chave de um pedaço.
 *
 * Tipo mais deslocamento, e não só o deslocamento: um trecho e o bloco que o
 * contém começam no MESMO caractere, e dois irmãos com a mesma chave fazem o
 * React descartar um deles sem avisar.
 */
function chave(pedaco: { tipo: string; de: number }): string {
  return `${pedaco.tipo}-${pedaco.de}`;
}

/**
 * O texto visível de um trecho, para o aviso de link comparar.
 *
 * O aviso endurece quando o texto ESCRITO é uma URL diferente do destino, e
 * para isso ele precisa do texto — não do JSX.
 */
function textoPlano(trechos: readonly TrechoDeMensagem[]): string {
  let out = "";
  for (const t of trechos) {
    if (t.tipo === "texto" || t.tipo === "codigo") out += t.valor;
    else if (t.tipo === "mencao") out += `@${t.valor}`;
    else if (t.tipo !== "quebra") out += textoPlano(t.filhos);
  }
  return out;
}

function Trechos({
  trechos,
  compacto,
}: {
  trechos: readonly TrechoDeMensagem[];
  compacto: boolean;
}) {
  return (
    <>
      {trechos.map((t) => (
        <Trecho key={chave(t)} trecho={t} compacto={compacto} />
      ))}
    </>
  );
}

function Trecho({
  trecho,
  compacto,
}: {
  trecho: TrechoDeMensagem;
  compacto: boolean;
}) {
  switch (trecho.tipo) {
    case "texto":
      return <>{trecho.valor}</>;

    case "mencao":
      return <Mencao userId={trecho.valor} compacto={compacto} />;

    case "codigo":
      return <code className={css.codigo}>{trecho.valor}</code>;

    case "quebra":
      // Prévia de uma linha não quebra: a quebra vira o espaço que separa as
      // duas frases, senão elas colam uma na outra.
      return compacto ? <>{" "}</> : <br />;

    case "enfase":
      return (
        <em>
          <Trechos trechos={trecho.filhos} compacto={compacto} />
        </em>
      );

    case "forte":
      return (
        <strong>
          <Trechos trechos={trecho.filhos} compacto={compacto} />
        </strong>
      );

    case "riscado":
      return (
        <s>
          <Trechos trechos={trecho.filhos} compacto={compacto} />
        </s>
      );

    case "link":
      /*
        O clique passa pelo AVISO, e isso é segurança e não conveniência.

        `hrefSeguro` já barrou `javascript:` e `data:`. O que ele não pode
        barrar é um `https:` que simplesmente não é para onde a pessoa acha que
        vai — markdown deixa o texto do link dizer uma coisa e o destino ser
        outra, e toda mensagem deste app é escrita por outra pessoa.

        O `href` continua no elemento: é o que faz "copiar endereço do link" e
        o meio-clique funcionarem, e o que mostra o destino na barra de status.
        `preventDefault` só intercepta a navegação NORMAL.

        `noopener noreferrer` fica de qualquer forma — se o `preventDefault`
        falhar por qualquer motivo, a defesa de `window.opener` não pode falhar
        junto.
      */
      return (
        <a
          className={css.link}
          href={trecho.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Modificador segurado = a pessoa pediu explicitamente uma aba
            // nova ou uma janela; interceptar aí seria roubar o gesto.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            administrar({
              tipo: "linkExterno",
              href: trecho.href,
              texto: textoPlano(trecho.filhos),
            });
          }}
        >
          <Trechos trechos={trecho.filhos} compacto={compacto} />
        </a>
      );
  }
}

function Blocos({ blocos }: { blocos: readonly BlocoDeMensagem[] }) {
  return (
    <>
      {blocos.map((b) => (
        <Bloco key={chave(b)} bloco={b} />
      ))}
    </>
  );
}

function Bloco({ bloco }: { bloco: BlocoDeMensagem }) {
  switch (bloco.tipo) {
    case "paragrafo":
      return (
        <p className={css.paragrafo}>
          <Trechos trechos={bloco.filhos} compacto={false} />
        </p>
      );

    case "titulo":
      /*
        `div` com `role="heading"` e não `h1`/`h2`/`h3`.

        Um título dentro de uma mensagem não é um título do DOCUMENTO: dez mil
        linhas com `<h1>` destruiriam o esboço da página para quem navega por
        títulos no leitor de tela. O nível declarado começa em 3 porque acima
        dele está a estrutura do app, não a conversa.
      */
      return (
        <div
          className={css.titulo}
          data-nivel={bloco.nivel}
          role="heading"
          aria-level={bloco.nivel + 2}
        >
          <Trechos trechos={bloco.filhos} compacto={false} />
        </div>
      );

    case "blocoDeCodigo":
      /*
        A rolagem horizontal vive AQUI, no `pre`, e isso é a lei nº 3.

        A coluna de conteúdo é `minmax(0, 1fr)`, e uma linha de código de 400
        caracteres sem espaço é exatamente o caso patológico do briefing: sem
        `overflow-x` no próprio container, ela empurra a trilha e estoura o
        grid inteiro.
      */
      return (
        /*
          O bloco ganhou CABEÇALHO — língua de um lado, copiar do outro.

          ⚠ A língua era um selo flutuando sobre o canto do código, e ela
          disputava lugar com a primeira linha. O design põe uma barra própria
          acima: a língua deixa de cobrir texto, e "copiar" ganha um alvo de
          verdade em vez de a pessoa selecionar o bloco à mão.

          Copiar é REAL — `copiarTexto` já existe e é o mesmo caminho do
          "Copiar texto" do menu da mensagem.
        */
        <div className={css.blocoPacote}>
          <div className={css.blocoCabecalho}>
            {/* Sem língua o espaço fica: a barra tem altura fixa, e um
                cabeçalho que aparece e some mudaria a altura da linha
                conforme o markdown — numa lista ancorada isso move a âncora. */}
            <span className={css.lingua}>{bloco.lingua ?? ""}</span>
            <button
              type="button"
              className={css.copiar}
              onClick={() => void copiarTexto(bloco.valor, "Código")}
            >
              copiar
            </button>
          </div>

          {/*
            A rolagem horizontal vive no `pre`, e isso é a lei nº 3: a coluna
            é `minmax(0, 1fr)`, e uma linha de 400 caracteres sem espaço
            empurraria a trilha e estouraria o grid.
          */}
          <pre className={css.bloco}>
            <code>{bloco.valor}</code>
          </pre>
        </div>
      );

    case "citacao":
      return (
        <blockquote className={css.citacao}>
          <Blocos blocos={bloco.filhos} />
        </blockquote>
      );

    case "lista":
      return bloco.ordenada ? (
        <ol className={css.lista} start={bloco.inicio}>
          {bloco.itens.map((item) => (
            <li key={item.de}>
              <Blocos blocos={item.filhos} />
            </li>
          ))}
        </ol>
      ) : (
        <ul className={css.lista}>
          {bloco.itens.map((item) => (
            <li key={item.de}>
              <Blocos blocos={item.filhos} />
            </li>
          ))}
        </ul>
      );

    case "regra":
      return <hr className={css.regra} />;
  }
}

export function TextoDaMensagem({
  blocos,
  compacto = false,
}: {
  blocos: readonly BlocoDeMensagem[];
  /** Citação e painel de fixados: uma linha, sem estrutura de bloco. */
  compacto?: boolean;
}) {
  /*
    O compacto ACHATA em vez de renderizar blocos.

    Uma prévia de uma linha não tem onde pôr um bloco de código nem uma lista —
    a caixa sairia esmagada em 20px de altura. Achatar preserva o que se lê e
    descarta o que se vê, que é a decisão certa para um resumo.
  */
  if (compacto) {
    return <Trechos trechos={achatar(blocos)} compacto />;
  }
  return <Blocos blocos={blocos} />;
}
