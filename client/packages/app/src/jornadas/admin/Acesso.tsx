import {
  aprovarPedido,
  aprovarTodos,
  editarPolitica,
  podeGerenciarSeguranca,
  podeModerarPedidos,
  recarregarFila,
  recusarPedido,
  type ModoDeEntrada,
  type PedidoDeEntrada,
} from "nucleo/sdk/seguranca";
import { useFilaDePedidos, usePolitica } from "nucleo/store/seguranca";
import { useId, useState } from "react";

import { admin } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import css from "./admin.module.css";
import { Carregando, Falhou, Vazio } from "./Estados";

const t = admin.acessoPagina;

const OPCOES: readonly ModoDeEntrada[] = ["convite", "aprovacao", "fechado"];

/**
 * Acesso: como as pessoas entram e a fila de pedidos. Quem só modera pedidos vê
 * só a fila; escolher como se entra é de quem gerencia o servidor. Ação sem
 * permissão não aparece.
 */
export function Acesso({ serverId }: { serverId: string }) {
  const gerencia = podeGerenciarSeguranca(serverId);
  const modera = podeModerarPedidos(serverId);
  if (!gerencia && !modera) {
    return <Vazio titulo={admin.semAcesso.titulo} texto={admin.semAcesso.texto} />;
  }
  return (
    <div className={css.pagina}>
      {gerencia && <EscolhaDeEntrada serverId={serverId} />}
      {modera && <FilaDoServidor serverId={serverId} />}
    </div>
  );
}

function EscolhaDeEntrada({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const rotuloId = useId();
  return (
    <div className={css.campo}>
      <span id={rotuloId} className={css.rotulo}>
        {t.quemEntra}
      </span>
      <div role="radiogroup" aria-labelledby={rotuloId} className={css.abas}>
        {OPCOES.map((modo) => (
          <button
            key={modo}
            type="button"
            role="radio"
            aria-checked={politica.modo === modo}
            aria-selected={politica.modo === modo}
            className={css.aba}
            onClick={() => {
              if (politica.modo !== modo) void editarPolitica(serverId, { modo });
            }}
          >
            {t[modo].titulo}
          </button>
        ))}
      </div>
      <p className={css.dica}>{t[politica.modo].detalhe}</p>
    </div>
  );
}

function FilaDoServidor({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  if (politica.modo !== "aprovacao") {
    return <Vazio titulo={t.semFila} texto={t.semFilaDica} />;
  }
  return <FilaDePedidos serverId={serverId} />;
}

function FilaDePedidos({ serverId }: { serverId: string }) {
  const fila = useFilaDePedidos(serverId);
  /* Um alvo por vez: aprovar dois ao mesmo tempo não adianta, e com a entrada
     congelada o segundo falharia pelo mesmo motivo do primeiro. */
  const [ocupado, setOcupado] = useState(false);

  const agir = (acao: () => Promise<unknown>) => {
    if (ocupado) return;
    setOcupado(true);
    void acao().finally(() => {
      setOcupado(false);
    });
  };

  if (fila === "carregando") return <Carregando texto={t.carregando} />;
  if (fila === "falhou") {
    return (
      <Falhou
        texto={t.erro}
        aoTentar={() => {
          void recarregarFila(serverId);
        }}
      />
    );
  }
  if (fila.length === 0) return <Vazio titulo={t.vazio} texto={t.vazioDica} />;

  return (
    <>
      <div className={css.barra}>
        <p className={css.texto} aria-live="polite">
          {t.contagem(fila.length)}
        </p>
        <Botao
          variante="secundario"
          tamanho="sm"
          carregando={ocupado}
          onClick={() => {
            agir(() => aprovarTodos(serverId));
          }}
        >
          {t.aprovarTodos}
        </Botao>
      </div>
      <ul
        className={css.tabela}
        aria-label={t.fila}
        style={{ ["--colunas" as string]: "minmax(0,1fr) auto" }}
      >
        {fila.map((p) => (
          <LinhaDePedido
            key={p.userId}
            pedido={p}
            aprovar={() => {
              agir(() => aprovarPedido(serverId, p.userId));
            }}
            recusar={() => {
              agir(() => recusarPedido(serverId, p.userId));
            }}
          />
        ))}
      </ul>
    </>
  );
}

function LinhaDePedido({
  pedido: p,
  aprovar,
  recusar,
}: {
  pedido: PedidoDeEntrada;
  aprovar: () => void;
  recusar: () => void;
}) {
  return (
    <li className={css.linha} data-testid="linha-de-pedido" data-pessoa={p.userId}>
      <span className={css.pessoa}>
        <Avatar nome={p.nome} id={p.userId} tamanho={28} imagem={p.avatarUrl} />
        <span className={css.pessoaTextos}>
          <span className={css.pessoaNome}>{p.nome}</span>
          <span className={css.pessoaMeta}>
            {p.detalhe}
            {p.risco ? ` · ${t.contaNova}` : ""}
          </span>
        </span>
      </span>
      <span className={css.acoesDaLinha}>
        <Botao
          variante="primario"
          tamanho="sm"
          aria-label={t.aprovarPessoa(p.nome)}
          onClick={aprovar}
        >
          {t.aprovar}
        </Botao>
        <Botao
          variante="secundario"
          tamanho="sm"
          aria-label={t.recusarPessoa(p.nome)}
          onClick={recusar}
        >
          {t.recusar}
        </Botao>
      </span>
    </li>
  );
}
