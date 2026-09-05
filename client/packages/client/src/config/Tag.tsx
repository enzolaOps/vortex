import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { CartaoDeAjustes, LinhaDeAjuste } from "./Pagina";
import { aindaNao } from "../pendente/pendencias";
import css from "./Tag.module.css";

/**
 * Tag do servidor — o identificador curto ao lado do nome de quem a exibe.
 *
 * ⚠ **NADA aqui é guardado, nem localmente, e o protocolo não tem o
 * conceito.** `tag` não é campo de `Server` nem de `DataEditServer` no
 * `stoat-api`; é página inteira da referência sem uma linha de back-end
 * atrás. Ela existe pela regra de quem toca o produto — construir 1:1 agora,
 * com o que não funciona registrado em `pendencias.ts` dizendo o que fará.
 *
 * ⚠ **Não confundir com a SIGLA do rail.** A sigla é derivada do nome e é
 * verdade sobre ele; a tag é escolha de quem administra, e é por isso que ela
 * precisa de um campo no servidor para existir de verdade.
 *
 * A prévia à direita não é decoração: a tag aparece em três superfícies com
 * pesos diferentes, e escolher quatro caracteres sem ver onde eles caem é
 * como escolher cor sem ver o fundo.
 */
export function Tag({ serverId }: { serverId: string }) {
  /*
    O estado é local e morre ao fechar a tela — é o que "não guardado"
    significa. Um store de cliente daria uma tag que só quem a digitou
    enxerga, e servidor nenhum aplica: pior que a ausência, porque parece
    funcionar. Mesma decisão de Acesso e Segurança.
  */
  const [tag, setTag] = useState("VTX");
  const [exigirCargo, setExigirCargo] = useState(false);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.tela}>
      <div className={css.coluna}>
        <Banner tom="aviso" acoes={<Botao variante="neutro" onClick={aindaNao("tagDoServidor")}>O que falta</Botao>}>
          O protocolo do Stoat não tem tag de servidor. Esta tela mostra a
          forma final; nada aqui é guardado.
        </Banner>

        <Campo
          rotulo="Tag"
          dica="2 a 4 caracteres · letras e números · sem espaços"
          className={css.campoDaTag}
          value={tag}
          /*
            A limpeza acontece na ENTRADA e não na validação: um campo que
            aceita espaço e depois reclama ensina o erro duas vezes. Aqui o
            caractere inválido simplesmente não entra, que é como o campo se
            explica sozinho.
          */
          onChange={(e) =>
            setTag(
              e.currentTarget.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 4)
                .toUpperCase(),
            )
          }
          autoComplete="off"
          spellCheck={false}
        />

        <div>
          <p className={css.sobrancelha}>Emblema</p>
          <div className={css.emblema}>
            <span aria-hidden className={css.emblemaVazio} />
            <Botao variante="neutro" onClick={aindaNao("emblemaDaTag")}>
              Enviar emblema
            </Botao>
          </div>
        </div>

        <CartaoDeAjustes>
          <LinhaDeAjuste
            titulo="Exigir cargo para exibir"
            detalhe="Só membros com o cargo escolhido podem usar a tag."
          >
            <Interruptor
              rotulo="Exigir cargo para exibir"
              ligado={exigirCargo}
              aoAlternar={setExigirCargo}
            />
          </LinhaDeAjuste>
        </CartaoDeAjustes>
      </div>

      {/*
        Onde a tag aparece — as três superfícies, com o peso de cada uma.

        ⚠ **Reproduz os componentes reais, não desenhos deles.** `Avatar` e
        `Selo` são os mesmos que a member list e a timeline usam, então uma
        troca de token aparece aqui junto — que é a promessa que a referência
        escreve por extenso na prévia do card de convite.
      */}
      <aside className={css.previa}>
        <p className={css.sobrancelha}>Onde a tag aparece</p>

        <div className={css.previaCaixa}>
          <div>
            <p className={css.previaRotulo}>Na timeline</p>
            <div className={css.previaLinha}>
              <span className={css.autor}>Marina</span>
              <Selo tom="acento">{tag}</Selo>
              <span className={css.hora}>14:02</span>
            </div>
            <p className={css.corpo}>Fechamos o escopo do rail.</p>
          </div>

          <div className={css.previaBloco}>
            <p className={css.previaRotulo}>Na lista de membros</p>
            <div className={css.previaLinhaCentrada}>
              <Avatar id="previa-marina" sigla="M" />
              <span className={css.nomeDeMembro}>Marina</span>
              <Selo tom="acento">{tag}</Selo>
            </div>
          </div>

          <div className={css.previaBloco}>
            <p className={css.previaRotulo}>No perfil</p>
            <div className={css.previaLinhaCentrada}>
              <span className={css.nomeDePerfil}>Marina Alcântara</span>
              <Selo tom="acento">{tag}</Selo>
            </div>
          </div>
        </div>

        <p className={css.nota}>
          A tag usa a fonte mono em 10px sobre acento a 16% — nunca a cor do
          cargo, para não competir com a hierarquia.
        </p>
      </aside>
    </div>
  );
}
