import { quando } from "nucleo/lib/quando";
import { dispensarConvite, pedirPermissao } from "nucleo/notificacao/permissao";
import { abrirConversa, irParaAmigos } from "nucleo/store/navegacao";
import { useAgoraPorMinuto } from "nucleo/store/relogio";
import {
  useChannel,
  useConexao,
  useConversas,
  useLocal,
  useMessage,
  usePessoa,
  useRelacao,
} from "nucleo/store/hooks";
import { useState, type ReactNode } from "react";

import { ColunaDeSalas } from "../../shell";
import { casa } from "../../textos";
import { Avatar, Botao, Pilula } from "../../ui/ds";
import { Mais, Mensagem, Pessoas, SemConexao } from "../../ui/icones";
import { juntar } from "../../ui/juntar";
import { useConviteDeAvisos } from "./hooks";
import css from "./Coluna.module.css";
import { NovoGrupo } from "./NovoGrupo";

function Previa({ ultimaMensagemId, vazia }: { ultimaMensagemId: string | undefined; vazia: string }) {
  const m = useMessage(ultimaMensagemId ?? "");
  const texto = m?.content.trim();
  return <span className={css.previa}>{texto !== undefined && texto !== "" ? texto : vazia}</span>;
}

/** Hora curta da última mensagem; some quando nunca houve uma. */
function Hora({ em }: { em: number }) {
  const agora = useAgoraPorMinuto();
  if (em === 0) return null;
  return <span className={css.hora}>{quando(em, agora, "curto")}</span>;
}

function LinhaDaConversa({
  id,
  nome,
  rosto,
  ultimaMensagemId,
  ultimaEm,
  naoLidas,
  mencoes,
  silenciada,
  selecionada,
  detalhe,
}: {
  id: string;
  nome: string;
  rosto: ReactNode;
  ultimaMensagemId: string | undefined;
  ultimaEm: number;
  naoLidas: number;
  mencoes: number;
  silenciada: boolean;
  selecionada: boolean;
  detalhe?: string;
}) {
  const temNova = naoLidas > 0 && !silenciada;
  const rotulo = [
    nome,
    detalhe,
    temNova ? casa.coluna.naoLidas(naoLidas) : undefined,
    silenciada ? casa.coluna.silenciada : undefined,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <li>
      <button
        type="button"
        data-conversa={id}
        aria-label={rotulo}
        aria-current={selecionada ? "true" : undefined}
        className={juntar(css.linha, selecionada && css.selecionada, temNova && css.naoLida, silenciada && css.silenciada)}
        onClick={() => {
          abrirConversa(id);
        }}
      >
        {rosto}
        <span className={css.texto}>
          <span className={css.nome}>{nome}</span>
          <Previa ultimaMensagemId={ultimaMensagemId} vazia={casa.coluna.semMensagens} />
        </span>
        <span className={css.lado} aria-hidden="true">
          <Hora em={ultimaEm} />
          {temNova && mencoes > 0 ? <Pilula tipo="mencao" valor={mencoes} /> : temNova && <Pilula tipo="naoLida" />}
        </span>
      </button>
    </li>
  );
}

function ConversaDireta({ id, selecionada }: { id: string; selecionada: boolean }) {
  const canal = useChannel(id);
  const pessoa = usePessoa(canal?.destinatarioId ?? "");
  if (!canal) return null;
  const nome = pessoa?.displayName ?? canal.name;
  return (
    <LinhaDaConversa
      id={id}
      nome={nome}
      rosto={<Avatar nome={nome} id={canal.destinatarioId} tamanho={36} status={pessoa?.status} />}
      ultimaMensagemId={canal.ultimaMensagemId}
      ultimaEm={canal.ultimaEm}
      naoLidas={canal.naoLidas}
      mencoes={canal.mencoes}
      silenciada={canal.silenciado}
      selecionada={selecionada}
    />
  );
}

function ConversaEmGrupo({ id, selecionada }: { id: string; selecionada: boolean }) {
  const canal = useChannel(id);
  if (!canal) return null;
  return (
    <LinhaDaConversa
      id={id}
      nome={canal.name}
      rosto={<Avatar nome={canal.name} id={id} tamanho={36} />}
      detalhe={casa.coluna.grupo(canal.participantes)}
      ultimaMensagemId={canal.ultimaMensagemId}
      ultimaEm={canal.ultimaEm}
      naoLidas={canal.naoLidas}
      mencoes={canal.mencoes}
      silenciada={canal.silenciado}
      selecionada={selecionada}
    />
  );
}

function NotasPessoais({ id, selecionada }: { id: string; selecionada: boolean }) {
  const canal = useChannel(id);
  if (!canal) return null;
  return (
    <LinhaDaConversa
      id={id}
      nome={casa.coluna.notas}
      rosto={
        <span className={css.iconeRedondo} aria-hidden="true">
          <Mensagem tamanho={18} />
        </span>
      }
      ultimaMensagemId={canal.ultimaMensagemId}
      ultimaEm={canal.ultimaEm}
      naoLidas={0}
      mencoes={0}
      silenciada={false}
      selecionada={selecionada}
    />
  );
}

function Conversa({ id, selecionada }: { id: string; selecionada: boolean }) {
  const tipo = useChannel(id)?.tipo;
  if (tipo === "grupo") return <ConversaEmGrupo id={id} selecionada={selecionada} />;
  if (tipo === "notas") return <NotasPessoais id={id} selecionada={selecionada} />;
  return <ConversaDireta id={id} selecionada={selecionada} />;
}

function EntradaDeAmigos() {
  const local = useLocal();
  const pedidos = useRelacao("recebido").length;
  const selecionada = local.tipo === "casa" || local.tipo === "amigos";
  return (
    <button
      type="button"
      aria-label={pedidos > 0 ? casa.coluna.amigosComPedidos(pedidos) : casa.coluna.amigos}
      aria-current={selecionada ? "true" : undefined}
      className={juntar(css.linha, selecionada && css.selecionada)}
      onClick={() => {
        irParaAmigos(local.tipo === "amigos" ? local.aba : "amigo");
      }}
    >
      <span className={css.iconeRedondo} aria-hidden="true">
        <Pessoas tamanho={18} />
      </span>
      <span className={css.texto}>
        <span className={css.nome}>{casa.coluna.amigos}</span>
      </span>
      {pedidos > 0 && (
        <span className={css.lado} aria-hidden="true">
          <Pilula tipo="contagem" valor={pedidos} />
        </span>
      )}
    </button>
  );
}

/**
 * O convite para ativar avisos do sistema. Só pergunta ao clicar: o navegador
 * ignora pedido de permissão sem gesto, e a pessoa decide quando.
 */
function ConviteDeAvisos() {
  const visivel = useConviteDeAvisos();
  const [pedindo, setPedindo] = useState(false);
  if (!visivel) return null;
  return (
    <section className={css.convite} aria-label={casa.avisos.titulo}>
      <p className={css.conviteTexto}>{casa.avisos.texto}</p>
      <div className={css.conviteAcoes}>
        <Botao
          tamanho="sm"
          carregando={pedindo}
          onClick={() => {
            setPedindo(true);
            void pedirPermissao().finally(() => {
              setPedindo(false);
            });
          }}
        >
          {casa.avisos.ativar}
        </Botao>
        <Botao variante="fantasma" tamanho="sm" onClick={dispensarConvite}>
          {casa.avisos.agoraNao}
        </Botao>
      </div>
    </section>
  );
}

function CorpoDaCasa() {
  const ids = useConversas();
  const local = useLocal();
  const conexao = useConexao();
  const aberta = local.tipo === "dm" ? local.channelId : undefined;
  return (
    <>
      {conexao !== "conectado" && (
        <div className={css.aviso} role="status">
          <SemConexao tamanho={16} />
          <span>{casa.coluna.semConexao}</span>
        </div>
      )}
      <div className={css.corpo}>
        <EntradaDeAmigos />
        <div className={css.separador} />
        <h3 className={css.rotuloDaSecao}>{casa.coluna.secaoDeConversas}</h3>
        {ids.length === 0 ? (
          <div className={css.vazio}>
            <h4 className={css.vazioTitulo}>{casa.coluna.semConversas.titulo}</h4>
            <p className={css.vazioTexto}>{casa.coluna.semConversas.texto}</p>
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={() => {
                irParaAmigos("amigo");
              }}
            >
              {casa.coluna.semConversas.verAmigos}
            </Botao>
          </div>
        ) : (
          <ul className={css.lista} aria-label={casa.coluna.secaoDeConversas}>
            {ids.map((id) => (
              <Conversa key={id} id={id} selecionada={id === aberta} />
            ))}
          </ul>
        )}
      </div>
      <ConviteDeAvisos />
    </>
  );
}

/**
 * A coluna da casa: o caminho para os amigos e as conversas por recência (DM,
 * grupo e notas). Cada linha assina a própria conversa; a lista só assina os
 * IDs, já ordenados quando a casa abre.
 */
export function ColunaDaCasa({ rodape }: { rodape?: ReactNode }) {
  const [criando, setCriando] = useState(false);
  return (
    <>
      <ColunaDeSalas
        titulo={casa.coluna.titulo}
        rodape={rodape}
        acoes={
          <Botao
            variante="fantasma"
            tamanho="sm"
            icone={<Mais />}
            aria-label={casa.coluna.novoGrupo}
            onClick={() => {
              setCriando(true);
            }}
          />
        }
      >
        <CorpoDaCasa />
      </ColunaDeSalas>
      <NovoGrupo aberto={criando} aoMudar={setCriando} />
    </>
  );
}
