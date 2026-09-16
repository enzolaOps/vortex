import { Check, ICONE, X } from "../components/ui/icones";
import { useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import {
  aprovarPedido,
  aprovarTodos,
  editarPolitica,
  podeGerenciarSeguranca,
  podeModerarPedidos,
  recusarPedido,
  type ModoDeEntrada,
} from "../sdk/seguranca";
import { useFilaDePedidos, usePolitica } from "../store/seguranca";
import css from "./Acesso.module.css";

const MODOS: readonly {
  readonly id: ModoDeEntrada;
  readonly titulo: string;
  readonly detalhe: string;
}[] = [
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
];

/**
 * Acesso — quem consegue entrar e o que precisa fazer antes.
 *
 * ⚠ **Tudo aqui é política do SERVIDOR, guardada no fork do `api`** (`security`
 * em `Server`) e aplicada nas rotas de entrada: `Closed` recusa o convite,
 * `Approval` o transforma em pedido na fila, e o e-mail verificado é conferido
 * contra a conta antes de qualquer um dos dois. Servidor que nunca abriu esta
 * página não tem `security` e se comporta como o Stoat.
 *
 * O telefone continua pendente, e não por falta de tela: o sistema de contas
 * não tem telefone. O interruptor mostra o estado verdadeiro (desligado) e o
 * clique diz do que ele depende.
 */
export function Acesso({ serverId }: { serverId: string }) {
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }
  return <AcessoDoServidor serverId={serverId} />;
}

function AcessoDoServidor({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const gerencia = podeGerenciarSeguranca(serverId);

  return (
    <div className={css.pagina}>
      <div
        className={css.modos}
        role="radiogroup"
        aria-label="Quem consegue entrar"
      >
        {MODOS.map((m) => (
          <CartaoDeOpcao
            key={m.id}
            forte
            marcado={politica.modo === m.id}
            titulo={m.titulo}
            detalhe={m.detalhe}
            disabled={!gerencia}
            aoEscolher={() => {
              if (politica.modo !== m.id) void editarPolitica(serverId, { modo: m.id });
            }}
          />
        ))}
      </div>

      {/* A fila só existe em "Aprovação manual" — é o `queueStyle` do design,
          que a esconde nos outros dois modos em vez de mostrá-la vazia. E só
          para quem pode moderá-la: a rota recusa os outros, e uma fila que
          abre em erro para quem não modera é ruído. */}
      {politica.modo === "aprovacao" && podeModerarPedidos(serverId) ? (
        <FilaDeAprovacao serverId={serverId} />
      ) : null}

      {/* Sobrancelha e fora do cartão — o mesmo arranjo da referência e das
          três seções de Segurança. */}
      <div className={css.sobrancelha}>Requisitos de entrada</div>
      <div className={css.requisitos}>
        <div className={css.requisito}>
          <div>
            <div className={css.requisitoTitulo}>Email verificado</div>
            <div className={css.requisitoDetalhe}>
              Bloqueia contas descartáveis
            </div>
          </div>
          <Interruptor
            ligado={politica.exigeEmailVerificado}
            rotulo="Email verificado"
            disabled={!gerencia}
            aoAlternar={(ligado) =>
              void editarPolitica(serverId, { exigeEmailVerificado: ligado })
            }
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
            aoAlternar={aindaNao("telefoneVerificado")}
          />
        </div>
      </div>
    </div>
  );
}

function FilaDeAprovacao({ serverId }: { serverId: string }) {
  const fila = useFilaDePedidos(serverId);
  /* Um alvo por vez: aprovar dois ao mesmo tempo não é mais rápido para quem
     modera, e com a emergência congelando entradas a segunda falharia pelo
     mesmo motivo da primeira. */
  const [ocupado, setOcupado] = useState(false);

  const agir = (acao: () => Promise<unknown>) => {
    setOcupado(true);
    void acao().finally(() => setOcupado(false));
  };

  const pedidos = typeof fila === "object" ? fila : [];

  let detalhe: string;
  if (fila === "carregando") detalhe = "Carregando pedidos…";
  else if (fila === "falhou") detalhe = "Não deu para ler a fila";
  else if (pedidos.length === 0) detalhe = "Nenhum pedido aguardando";
  else if (pedidos.length === 1) detalhe = "1 pedido aguardando";
  else detalhe = `${String(pedidos.length)} pedidos aguardando`;

  return (
    <div className={css.fila}>
      <div className={css.filaTopo}>
        <div>
          <div className={css.filaTitulo}>Fila de aprovação</div>
          <div className={css.filaDetalhe} aria-live="polite">
            {detalhe}
          </div>
        </div>
        {pedidos.length > 0 ? (
          <Botao
            variante="sutil"
            tamanho="pequeno"
            carregando={ocupado}
            onClick={() => agir(() => aprovarTodos(serverId))}
          >
            Aprovar todos
          </Botao>
        ) : null}
      </div>

      {pedidos.map((p) => (
        <div key={p.userId} className={css.pedido}>
          <Avatar id={p.userId} sigla={p.sigla} url={p.avatarUrl} tamanho="xs" />
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
              disabled={ocupado}
              onClick={() => agir(() => aprovarPedido(serverId, p.userId))}
            >
              <Check size={ICONE.metadado} weight="bold" aria-hidden />
            </button>
            <button
              type="button"
              className={css.recusar}
              aria-label={`Recusar ${p.nome}`}
              disabled={ocupado}
              onClick={() => agir(() => recusarPedido(serverId, p.userId))}
            >
              <X size={ICONE.metadado} weight="bold" aria-hidden />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
