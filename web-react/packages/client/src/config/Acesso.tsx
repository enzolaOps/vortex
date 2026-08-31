import { Check, X } from "@phosphor-icons/react";
import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import css from "./Acesso.module.css";

const MODOS = [
  {
    id: "convite",
    titulo: "Qualquer pessoa com convite",
    detalhe: "Padrão. Entrada imediata.",
  },
  {
    id: "aprovacao",
    titulo: "Aprovação manual",
    detalhe: "Cada pedido vai para uma fila revisada pela moderação.",
  },
  {
    id: "fechado",
    titulo: "Fechado",
    detalhe: "Nenhum convite funciona até reabrir.",
  },
] as const;

type Modo = (typeof MODOS)[number]["id"];

/*
  ⚠ **Os pedidos são do DESIGN, não do servidor**, e é por isso que estão aqui
  em vez de virem de uma chamada. Não existe fila de aprovação no protocolo —
  ver o comentário do componente. Eles ficam para que a fila tenha FORMA: um
  painel vazio não mostra a linha de pedido, e a linha é o que precisa estar
  desenhado quando a rota existir.
*/
const PEDIDOS: readonly {
  readonly id: string;
  readonly nome: string;
  readonly detalhe: string;
  readonly risco: boolean;
}[] = [
  {
    id: "01JQ0000000000000000000001",
    nome: "bea.t",
    detalhe: "conta de 2 anos · 4 servidores em comum",
    risco: false,
  },
  {
    id: "01JQ0000000000000000000002",
    nome: "novo_9182",
    detalhe: "conta criada há 3 horas · sem servidores em comum",
    risco: true,
  },
];

/**
 * Acesso — quem consegue entrar e o que precisa fazer antes.
 *
 * ⚠ **Nenhum controle desta página chega ao servidor, e a razão é medida.** O
 * schema do Stoat não tem `verification_level`, `join_request`, `approval` nem
 * `explicit_content_filter` — as quatro dão ZERO ocorrências no
 * `OpenAPI.json`, e as rotas de `/servers/{id}` são só membros, banimentos,
 * convites, cargos, permissões, emojis e auditoria. Modo de entrada e fila de
 * aprovação não são campos que faltam; são conceitos que não existem.
 *
 * ⚠ **E por isso as escolhas NÃO são guardadas nem localmente.** Guardar
 * "Aprovação manual" nesta máquina daria uma política que só quem a marcou
 * enxerga, e que servidor nenhum aplica — é exatamente o defeito que manteve
 * `criar enquete` como pendência em vez de virar store de cliente. Um
 * moderador que visse a escolha grudar acreditaria que o servidor está
 * fechado. Aqui ela nem gruda: o cartão continua no estado REAL (aberto por
 * convite) e o toast diz o que falta.
 *
 * O banner no topo é o que separa isto de um bug: sem ele, três cartões que
 * não mudam parecem quebrados, e "parece quebrado" é o modo de falha que o
 * registro de pendências existe para eliminar.
 */
export function Acesso({ serverId }: { serverId: string }) {
  /*
    O modo é estado LOCAL de componente, e some ao fechar a página de
    propósito: ele existe só para a fila de aprovação aparecer quando alguém
    escolhe "Aprovação manual", que é como o design a revela. Persistir seria
    a mentira descrita acima.
  */
  const [modo, setModo] = useState<Modo>("convite");

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.pagina}>
      <Banner tom="aviso" titulo="Nada aqui chega ao servidor ainda">
        O protocolo Stoat não tem modo de entrada, fila de aprovação nem
        requisito de conta. Os controles estão desenhados; a política real de
        entrada continua sendo “quem tem convite entra”.
      </Banner>

      <div
        className={css.modos}
        role="radiogroup"
        aria-label="Quem consegue entrar"
      >
        {MODOS.map((m) => (
          <CartaoDeOpcao
            key={m.id}
            forte
            marcado={modo === m.id}
            titulo={m.titulo}
            detalhe={m.detalhe}
            aoEscolher={() => {
              setModo(m.id);
              if (m.id !== "convite") aindaNao("modoDeEntrada")();
            }}
          />
        ))}
      </div>

      {/* A fila só existe em "Aprovação manual" — é o `queueStyle` do design,
          que a esconde nos outros dois modos em vez de mostrá-la vazia. */}
      {modo === "aprovacao" ? (
        <div className={css.fila}>
          <div className={css.filaTopo}>
            <div>
              <div className={css.filaTitulo}>Fila de aprovação</div>
              <div className={css.filaDetalhe}>
                {PEDIDOS.length === 1
                  ? "1 pedido aguardando"
                  : `${String(PEDIDOS.length)} pedidos aguardando`}
              </div>
            </div>
            <Botao
              variante="sutil"
              tamanho="pequeno"
              onClick={aindaNao("filaDeAprovacao")}
            >
              Aprovar todos
            </Botao>
          </div>

          {PEDIDOS.map((p) => (
            <div key={p.id} className={css.pedido}>
              <Avatar id={p.id} sigla={p.nome.slice(0, 2)} tamanho="xs" />
              <div className={css.pedidoTextos}>
                <div className={css.pedidoNome}>
                  {p.nome}
                  {p.risco ? <Selo tom="aviso">RISCO</Selo> : null}
                </div>
                <div className={css.pedidoDetalhe}>{p.detalhe}</div>
              </div>
              <div className={css.pedidoAcoes}>
                {/*
                  ⚠ `aria-label` com o NOME de quem é o pedido. Numa fila de
                  três, "Aprovar" repetido três vezes deixa quem navega por
                  lista de controles sem saber qual pedido está aprovando.
                */}
                <button
                  type="button"
                  className={css.aprovar}
                  aria-label={`Aprovar ${p.nome}`}
                  onClick={aindaNao("filaDeAprovacao")}
                >
                  <Check size={14} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  className={css.recusar}
                  aria-label={`Recusar ${p.nome}`}
                  onClick={aindaNao("filaDeAprovacao")}
                >
                  <X size={14} weight="bold" aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className={css.requisitos}>
        <div className={css.requisitosTitulo}>Requisitos de entrada</div>

        <div className={css.requisito}>
          <div>
            <div className={css.requisitoTitulo}>Email verificado</div>
            <div className={css.requisitoDetalhe}>
              Bloqueia contas descartáveis
            </div>
          </div>
          <Interruptor
            ligado={false}
            rotulo="Email verificado"
            aoAlternar={aindaNao("requisitosDeEntrada")}
          />
        </div>

        <div className={css.requisito}>
          <div>
            <div className={css.requisitoTitulo}>Telefone verificado</div>
            <div className={css.requisitoDetalhe}>
              Mais restritivo; reduz entrada legítima
            </div>
          </div>
          <Interruptor
            ligado={false}
            rotulo="Telefone verificado"
            aoAlternar={aindaNao("requisitosDeEntrada")}
          />
        </div>
      </div>
    </div>
  );
}
