import { useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Escolha } from "../components/ui/Escolha";
import { Interruptor } from "../components/ui/Interruptor";
import { aindaNao } from "../pendente/pendencias";
import { fecharConfig } from "../store/config";
import { useRelacao } from "../store/hooks";
import { irParaAmigos } from "../store/navegacao";
import {
  assinarPrivacidade,
  definirPrivacidade,
  lerPrivacidade,
  POLITICAS_DE_PEDIDO,
  ROTULO_DA_POLITICA,
} from "../store/privacidade";
import {
  CabecalhoDeSecao,
  classes as pg,
  GrupoDeAjustes,
  LinhaDeAjuste,
  PaginaDeAjustes,
} from "./Pagina";
import css from "./Privacidade.module.css";

const ROTULOS = POLITICAS_DE_PEDIDO.map((p) => ROTULO_DA_POLITICA[p]);

/**
 * Privacidade.
 *
 * ⚠ **Três das quatro preferências não existem no protocolo Stoat**, e a
 * diferença importa: não é "ainda não implementei", é que o Revolt guarda
 * `UserSettings` como blob opaco por chave, sem esquema para "quem pode me
 * mandar pedido". Elas são conceito de CLIENTE aqui, como `pastas.ts`. Ver
 * `store/privacidade.ts`.
 *
 * O que é REAL nesta tela é a contagem de bloqueados e o caminho até eles: a
 * lista vem do store de relações, e "Gerenciar" leva à aba — que passou a ser
 * um lugar nomeável por causa deste botão.
 */
export function Privacidade() {
  const p = useSyncExternalStore(assinarPrivacidade, lerPrivacidade);
  const bloqueados = useRelacao("bloqueado");

  return (
    <PaginaDeAjustes>
      <CabecalhoDeSecao titulo="Quem pode falar comigo" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Filtrar mensagens de desconhecidos"
          detalhe="Vão para a caixa de solicitações em vez da lista de DMs"
        >
          <Interruptor
            ligado={p.filtrarDesconhecidos}
            rotulo="Filtrar mensagens de desconhecidos"
            aoAlternar={(v) => definirPrivacidade({ filtrarDesconhecidos: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste titulo="Pedidos de amizade" detalhe="Quem pode enviar">
          {/*
            ⚠ Sem rótulo VISÍVEL: quem nomeia o controle é o título da linha,
            a 20px à esquerda. Repetir daria a mesma palavra duas vezes, e o
            leitor de tela anunciaria as duas.
          */}
          <Escolha
            rotulo="Quem pode enviar pedido de amizade"
            rotuloOculto
            className={css.seletor}
            valor={ROTULO_DA_POLITICA[p.politicaDePedido]}
            opcoes={ROTULOS}
            aoEscolher={(v) => {
              const id = POLITICAS_DE_PEDIDO.find(
                (k) => ROTULO_DA_POLITICA[k] === v,
              );
              if (id) definirPrivacidade({ politicaDePedido: id });
            }}
          />
        </LinhaDeAjuste>

        {/*
          A contagem é REAL — sai do mesmo store que a aba de bloqueados
          desenha. Dizer "4 contas" com um número inventado seria pior que não
          dizer, porque a pessoa decide se abre a lista por causa dele.
        */}
        <LinhaDeAjuste
          titulo="Bloqueados"
          detalhe={
            bloqueados.length === 1
              ? "1 conta"
              : `${String(bloqueados.length)} contas`
          }
        >
          <Botao
            tamanho="pequeno"
            onClick={() => {
              /*
                Fecha as configurações ANTES de navegar: elas cobrem o shell
                inteiro, e ir para uma tela que fica atrás de um véu opaco é o
                mesmo que não ir.
              */
              irParaAmigos("bloqueado");
              fecharConfig();
            }}
          >
            Gerenciar
          </Botao>
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <CabecalhoDeSecao titulo="Dados" />

      <GrupoDeAjustes>
        <LinhaDeAjuste
          titulo="Enviar dados de uso anônimos"
          detalhe="Ajuda a priorizar o que quebra mais; nunca inclui conteúdo de mensagem"
        >
          <Interruptor
            ligado={p.telemetria}
            rotulo="Enviar dados de uso anônimos"
            aoAlternar={(v) => definirPrivacidade({ telemetria: v })}
          />
        </LinhaDeAjuste>

        <LinhaDeAjuste
          titulo="Solicitar meus dados"
          detalhe="Recebe um arquivo por e-mail em até 30 dias"
        >
          <Botao tamanho="pequeno" onClick={aindaNao("exportarDados")}>
            Solicitar
          </Botao>
        </LinhaDeAjuste>
      </GrupoDeAjustes>

      <p className={pg.recado}>
        Estas escolhas valem nesta máquina: o protocolo guarda preferência de
        usuário como blob sem esquema, e não há campo para nenhuma das três.
        Bloqueio é a exceção — esse o servidor conhece.
      </p>
    </PaginaDeAjustes>
  );
}
