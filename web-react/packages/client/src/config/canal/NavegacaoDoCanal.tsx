import { Hash, SpeakerHigh } from "@phosphor-icons/react";

import { copiarTexto } from "../../lib/copiar";
import type { ChannelSnapshot } from "../../sdk/domain";
import { administrar } from "../../store/administracao";
import {
  abrirConfig,
  DE_CANAL,
  fecharConfig,
  NOME_DA_SECAO,
  type SecaoId,
} from "../../store/config";
import css from "./NavegacaoDoCanal.module.css";

/**
 * A coluna de navegação das configurações DE UM CANAL.
 *
 * ⚠ **Ela SUBSTITUI a navegação de usuário e servidor, e essa foi a correção.**
 * A primeira versão pendurava as seções de canal como um terceiro grupo abaixo
 * de "Você" e do servidor — e o design não faz isso. `Vortex Configurações do
 * Canal` desenha uma casca própria: coluna de 248px em `surface-1`, com o TIPO
 * do canal no topo, o nome, o breadcrumb do servidor, três itens, "Excluir
 * canal" e o identificador no rodapé.
 *
 * A diferença não é de arrumação: somando os grupos, quem abriu as
 * configurações de um canal fica a um clique de "Dispositivos", e a tela
 * deixa de dizer sobre o que ela é.
 *
 * ⚠ **Não há seção "Avançado" — eu tinha inventado uma.** O design põe o ID no
 * RODAPÉ da navegação e "Excluir canal" como ITEM dela, em vermelho. São dois
 * elementos de navegação, não uma quarta tela; uma tela para duas linhas de
 * conteúdo é a "superfície construída para caber num menu" que este projeto já
 * evitou no registro de modais.
 */
export function NavegacaoDoCanal({
  canal,
  secao,
  servidor,
}: {
  canal: ChannelSnapshot;
  secao: SecaoId;
  servidor: string | undefined;
}) {
  const ehVoz = canal.tipo === "voz";

  return (
    <nav className={css.coluna} aria-label={`Configurações de ${canal.name}`}>
      <header className={css.cabecalho}>
        <p className={css.tipo}>
          {ehVoz ? "Canal de voz" : "Canal de texto"}
        </p>
        <p className={css.nome}>
          {ehVoz ? <SpeakerHigh aria-hidden /> : <Hash aria-hidden />}
          <span>{canal.name}</span>
        </p>
        {/*
          O breadcrumb é do design, e ele responde "de qual servidor é este
          canal" — que numa pessoa com oito servidores não é óbvio a partir do
          nome. Some quando não há servidor (DM), em vez de mostrar um traço.
        */}
        {servidor ? <p className={css.trilha}>{servidor}</p> : null}
      </header>

      <div className={css.itens}>
        {DE_CANAL.map((id) => (
          <button
            key={id}
            type="button"
            className={css.item}
            aria-current={id === secao}
            onClick={() => abrirConfig(id)}
          >
            {NOME_DA_SECAO[id]}
          </button>
        ))}

        {/*
          "Excluir canal" é ITEM de navegação no design, não seção — e ele
          reusa o modal de apagar que já existe desde a etapa 4, em vez de uma
          segunda confirmação com outro texto.

          Fecha as configurações antes: o modal vive na camada `sobreposto` do
          shell, que está ABAIXO desta tela. É a mesma razão pela qual a tela
          de convites fecha antes de abrir o dela.
        */}
        <button
          type="button"
          className={`${css.item} ${css.perigo}`}
          onClick={() => {
            fecharConfig();
            administrar({ tipo: "apagarCanal", channelId: canal.id });
          }}
        >
          Excluir canal
        </button>
      </div>

      {/*
        O ID no rodapé, como o design.

        `title` e não um tooltip: ele já está inteiro na tela, e o atributo
        serve a quem quer conferir sem depender de a fonte mono caber.
      */}
      <button
        type="button"
        className={css.identificador}
        title={canal.id}
        onClick={() => void copiarTexto(canal.id, "Identificador")}
      >
        ID {canal.id}
      </button>
    </nav>
  );
}
