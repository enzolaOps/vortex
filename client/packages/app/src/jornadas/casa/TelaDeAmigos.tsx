import { publicarRelacoes } from "nucleo/sdk/adapter";
import { aceitarAmizade, bloquear, desbloquear, desfazerAmizade, pedirAmizade } from "nucleo/sdk/social";
import { irParaAmigos } from "nucleo/store/navegacao";
import { useConexao, useEstadoDaChamada, useLocal, usePessoa, useRelacao } from "nucleo/store/hooks";
import { useEffect, useState, type FormEvent } from "react";

import { AreaPrincipal } from "../../shell";
import { casa } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { Alerta, Marcar, MaisHorizontal, Pessoas, SemConexao } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { ConteudoDoMenu, GatilhoDoMenu, ItemDeMenu, MenuSuspenso } from "../../ui/primitivos/Menus";
import { WidgetDaChamadaConectado } from "../voz/WidgetDaChamadaConectado";
import { conversarCom } from "./acoes";
import css from "./Amigos.module.css";
import conversa from "./Conversa.module.css";
import { useAmigosOnline } from "./hooks";

type Aba = "online" | "todos" | "pedidos" | "bloqueados";
type Modo = "amigo" | "recebido" | "enviado" | "bloqueado";

/** Roda uma ação da linha com o botão em "carregando"; a falha já vira aviso no núcleo. */
function useAcao() {
  const [ocupada, setOcupada] = useState(false);
  const executar = (acao: () => Promise<unknown>) => {
    setOcupada(true);
    void acao().finally(() => {
      setOcupada(false);
    });
  };
  return { ocupada, executar };
}

function LinhaDePessoa({ id, modo }: { id: string; modo: Modo }) {
  const pessoa = usePessoa(id);
  const { ocupada, executar } = useAcao();
  if (!pessoa) return null;
  const nome = pessoa.displayName;
  const status = casa.amigos.status[pessoa.status];
  const sub =
    modo === "recebido"
      ? casa.amigos.pedidoRecebido
      : modo === "enviado"
        ? casa.amigos.pedidoEnviado
        : modo === "bloqueado"
          ? `@${pessoa.username}`
          : status;
  return (
    <li className={css.pessoa} role="group" aria-label={`${nome}, ${status}`} data-pessoa={id}>
      <Avatar nome={nome} id={id} tamanho={44} status={modo === "bloqueado" ? undefined : pessoa.status} />
      <span className={css.texto}>
        <span className={css.nome}>{nome}</span>
        <span className={css.sub}>{sub}</span>
      </span>
      <span className={css.acoes}>
        {modo === "amigo" && (
          <>
            <Botao
              variante="secundario"
              tamanho="sm"
              carregando={ocupada}
              aria-label={casa.amigos.acoes.mensagemPara(nome)}
              onClick={() => {
                executar(() => conversarCom(id));
              }}
            >
              {casa.amigos.acoes.mensagem}
            </Botao>
            <MenuSuspenso>
              <GatilhoDoMenu asChild>
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  icone={<MaisHorizontal />}
                  aria-label={casa.amigos.acoes.maisAcoes(nome)}
                />
              </GatilhoDoMenu>
              <ConteudoDoMenu align="end">
                <ItemDeMenu
                  variante="perigo"
                  onSelect={() => {
                    executar(() => bloquear(id));
                  }}
                >
                  {casa.amigos.acoes.bloquear}
                </ItemDeMenu>
                <ItemDeMenu
                  onSelect={() => {
                    executar(() => desfazerAmizade(id));
                  }}
                >
                  {casa.amigos.acoes.removerAmizade}
                </ItemDeMenu>
              </ConteudoDoMenu>
            </MenuSuspenso>
          </>
        )}
        {modo === "recebido" && (
          <>
            <Botao
              tamanho="sm"
              carregando={ocupada}
              aria-label={casa.amigos.acoes.aceitarDe(nome)}
              onClick={() => {
                executar(() => aceitarAmizade(id));
              }}
            >
              {casa.amigos.acoes.aceitar}
            </Botao>
            <Botao
              variante="fantasma"
              tamanho="sm"
              aria-label={casa.amigos.acoes.recusarDe(nome)}
              onClick={() => {
                executar(() => desfazerAmizade(id));
              }}
            >
              {casa.amigos.acoes.recusar}
            </Botao>
          </>
        )}
        {modo === "enviado" && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            carregando={ocupada}
            aria-label={casa.amigos.acoes.cancelarPara(nome)}
            onClick={() => {
              executar(() => desfazerAmizade(id));
            }}
          >
            {casa.amigos.acoes.cancelar}
          </Botao>
        )}
        {modo === "bloqueado" && (
          <Botao
            variante="secundario"
            tamanho="sm"
            carregando={ocupada}
            aria-label={casa.amigos.acoes.desbloquearA(nome)}
            onClick={() => {
              executar(() => desbloquear(id));
            }}
          >
            {casa.amigos.acoes.desbloquear}
          </Botao>
        )}
      </span>
    </li>
  );
}

function Secao({
  titulo,
  ids,
  modo,
}: {
  titulo: string;
  ids: readonly string[];
  modo: Modo;
}) {
  return (
    <section aria-label={titulo}>
      <h3 className={css.secao}>{titulo}</h3>
      <ul className={css.lista}>
        {ids.map((id) => (
          <LinhaDePessoa key={id} id={id} modo={modo} />
        ))}
      </ul>
    </section>
  );
}

function AdicionarPorNome() {
  const conexao = useConexao();
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: boolean; texto: string } | undefined>();

  const limpo = nome.trim().replace(/^@/, "");

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (limpo === "" || enviando) return;
    if (conexao !== "conectado") {
      setRetorno({ ok: false, texto: casa.amigos.adicionar.semConexao });
      return;
    }
    setEnviando(true);
    setRetorno(undefined);
    const ok = await pedirAmizade(limpo);
    setEnviando(false);
    if (ok) {
      setRetorno({ ok: true, texto: casa.amigos.adicionar.enviado(limpo) });
      setNome("");
    } else {
      setRetorno({ ok: false, texto: casa.amigos.adicionar.recusado });
    }
  };

  return (
    <form
      className={css.adicionar}
      onSubmit={(e) => {
        void enviar(e);
      }}
    >
      <label className={css.adicionarRotulo} htmlFor="adicionar-amigo">
        {casa.amigos.adicionar.rotulo}
      </label>
      <div className={css.adicionarLinha}>
        <input
          id="adicionar-amigo"
          className={css.campo}
          value={nome}
          placeholder={casa.amigos.adicionar.placeholder}
          autoComplete="off"
          aria-invalid={retorno !== undefined && !retorno.ok}
          onChange={(e) => {
            setNome(e.target.value);
            setRetorno(undefined);
          }}
        />
        <Botao type="submit" carregando={enviando} disabled={limpo === ""}>
          {casa.amigos.adicionar.botao}
        </Botao>
      </div>
      {retorno?.ok === true && (
        <p className={juntar(css.retorno, css.ok)} role="status">
          <Marcar tamanho={16} />
          {retorno.texto}
        </p>
      )}
      {retorno?.ok === false && (
        <p className={juntar(css.retorno, css.falha)} role="alert">
          <Alerta tamanho={16} />
          {retorno.texto}
        </p>
      )}
    </form>
  );
}

function ListaDaAba({ aba }: { aba: Aba }) {
  const amigos = useRelacao("amigo");
  const online = useAmigosOnline(amigos);
  const recebidos = useRelacao("recebido");
  const enviados = useRelacao("enviado");
  const bloqueados = useRelacao("bloqueado");

  if (aba === "online" || aba === "todos") {
    const ids = aba === "online" ? online : amigos;
    if (ids.length === 0) return <p className={css.vazio}>{casa.amigos.vazio[aba]}</p>;
    return (
      <Secao
        titulo={aba === "online" ? casa.amigos.secao.online(ids.length) : casa.amigos.secao.todos(ids.length)}
        ids={ids}
        modo="amigo"
      />
    );
  }
  if (aba === "pedidos") {
    if (recebidos.length === 0 && enviados.length === 0) {
      return <p className={css.vazio}>{casa.amigos.vazio.pedidos}</p>;
    }
    return (
      <>
        {recebidos.length > 0 && (
          <Secao titulo={casa.amigos.secao.recebidos(recebidos.length)} ids={recebidos} modo="recebido" />
        )}
        {enviados.length > 0 && (
          <Secao titulo={casa.amigos.secao.enviados(enviados.length)} ids={enviados} modo="enviado" />
        )}
      </>
    );
  }
  if (bloqueados.length === 0) return <p className={css.vazio}>{casa.amigos.vazio.bloqueados}</p>;
  return <Secao titulo={casa.amigos.secao.bloqueados(bloqueados.length)} ids={bloqueados} modo="bloqueado" />;
}

/**
 * A tela de pessoas: amigos online ou todos, pedidos (recebidos e enviados) e
 * bloqueados, com o campo para pedir amizade pelo nome de usuário.
 *
 * A aba "Online" é um recorte de "Todos": as duas são a mesma relação (amigo) e a
 * diferença vive aqui, na tela. Pedidos junta o que chegou e o que foi enviado.
 */
export function TelaDeAmigos() {
  const local = useLocal();
  const conexao = useConexao();
  const [soOnline, setSoOnline] = useState(true);
  const pedidos = useRelacao("recebido").length;
  const emChamada = useEstadoDaChamada() !== "fora";

  // A aba inteira é varredura sobre todo mundo que o cliente conhece: publica ao abrir a tela.
  useEffect(() => {
    publicarRelacoes();
  }, []);

  const relacao = local.tipo === "amigos" ? local.aba : "amigo";
  const aba: Aba =
    relacao === "recebido" || relacao === "enviado"
      ? "pedidos"
      : relacao === "bloqueado"
        ? "bloqueados"
        : soOnline
          ? "online"
          : "todos";

  const ABAS: ReadonlyArray<{ id: Aba; rotulo: string; ir: () => void }> = [
    {
      id: "online",
      rotulo: casa.amigos.abas.online,
      ir: () => {
        setSoOnline(true);
        irParaAmigos("amigo");
      },
    },
    {
      id: "todos",
      rotulo: casa.amigos.abas.todos,
      ir: () => {
        setSoOnline(false);
        irParaAmigos("amigo");
      },
    },
    {
      id: "pedidos",
      rotulo: pedidos > 0 ? casa.amigos.abas.pedidosComNumero(pedidos) : casa.amigos.abas.pedidos,
      ir: () => {
        irParaAmigos("recebido");
      },
    },
    {
      id: "bloqueados",
      rotulo: casa.amigos.abas.bloqueados,
      ir: () => {
        irParaAmigos("bloqueado");
      },
    },
  ];

  return (
    <AreaPrincipal
      camada={
        emChamada ? (
          <div className={conversa.camadaDeWidgets}>
            <WidgetDaChamadaConectado servidorAberto="" />
          </div>
        ) : undefined
      }
    >
      <div className={css.tela}>
        <header className={css.cabeca}>
          <h2 className={css.titulo}>
            <Pessoas tamanho={18} />
            {casa.amigos.titulo}
          </h2>
          <div role="tablist" aria-label={casa.amigos.abas.rotulo} className={css.abas}>
            {ABAS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="tab"
                id={`aba-${a.id}`}
                aria-selected={a.id === aba}
                aria-controls="painel-de-amigos"
                className={css.aba}
                onClick={a.ir}
              >
                {a.rotulo}
              </button>
            ))}
          </div>
        </header>
        <div className={css.corpo} tabIndex={0}>
          <div className={css.coluna}>
            <AdicionarPorNome />
            {conexao !== "conectado" && (
              <p className={css.aviso} role="status">
                <SemConexao tamanho={16} />
                {casa.amigos.semConexao}
              </p>
            )}
            <div id="painel-de-amigos" role="tabpanel" aria-labelledby={`aba-${aba}`}>
              <ListaDaAba aba={aba} />
            </div>
          </div>
        </div>
      </div>
    </AreaPrincipal>
  );
}
