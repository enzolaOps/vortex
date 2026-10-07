import { pode } from "nucleo/sdk/permissoes";
import { desbloquear } from "nucleo/sdk/social";
import { irParaAmigos } from "nucleo/store/navegacao";
import { alternarSilencio } from "nucleo/store/silencio";
import {
  useChamada,
  useChannel,
  useConexao,
  useFalhaDeVoz,
  usePalco,
  usePessoa,
} from "nucleo/store/hooks";
import { useState } from "react";

import { AreaPrincipal } from "../../shell";
import { casa, shell } from "../../textos";
import { Avatar, Botao } from "../../ui/ds";
import { Cadeado, Camera, Configuracoes, Mensagem, Sino, SinoMudo, Telefone } from "../../ui/icones";
import { AreaDeChat } from "../chat/AreaDeChat";
import { WidgetDaChamadaConectado } from "../voz/WidgetDaChamadaConectado";
import { PalcoDaSala } from "../voz/Palco";
import { ligarNaConversa } from "./acoes";
import css from "./Conversa.module.css";
import { GerenciarGrupo } from "./GerenciarGrupo";
import { PerfilDaConversa } from "./PerfilDaConversa";

function Indisponivel() {
  return (
    <div className={css.vazio}>
      <Mensagem tamanho={20} />
      <p className={css.vazioTexto}>{casa.conversa.indisponivel}</p>
      <Botao
        variante="secundario"
        onClick={() => {
          irParaAmigos("amigo");
        }}
      >
        {casa.conversa.voltarAosAmigos}
      </Botao>
    </div>
  );
}

/** O motivo no lugar do campo: pessoa bloqueada, sem composer. */
function SemEscrita({ userId, nome, euBloqueei }: { userId: string; nome: string; euBloqueei: boolean }) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <p className={css.semEscrita} role="note">
      <span className={css.semEscritaTexto}>
        <Cadeado tamanho={16} />
        {euBloqueei ? casa.conversa.bloqueada(nome) : casa.conversa.bloqueadoPor(nome)}
      </span>
      {euBloqueei && (
        <Botao
          variante="secundario"
          tamanho="sm"
          carregando={ocupado}
          onClick={() => {
            setOcupado(true);
            void desbloquear(userId).finally(() => {
              setOcupado(false);
            });
          }}
        >
          {casa.conversa.desbloquear}
        </Botao>
      )}
    </p>
  );
}

function Chamar({ canalId, nome, grupo }: { canalId: string; nome: string; grupo: boolean }) {
  const conectado = useConexao() === "conectado";
  if (!pode(canalId, "conectar")) return null;
  return (
    <>
      <Botao
        variante="secundario"
        tamanho="sm"
        icone={<Telefone />}
        disabled={!conectado}
        title={conectado ? undefined : casa.conversa.semConexaoParaLigar}
        aria-label={grupo ? casa.conversa.ligarNoGrupo(nome) : casa.conversa.ligarPara(nome)}
        onClick={() => {
          void ligarNaConversa(canalId, false);
        }}
      >
        {casa.conversa.ligar}
      </Botao>
      <Botao
        variante="secundario"
        tamanho="sm"
        icone={<Camera />}
        disabled={!conectado}
        title={conectado ? undefined : casa.conversa.semConexaoParaLigar}
        aria-label={casa.conversa.videoCom(nome)}
        onClick={() => {
          void ligarNaConversa(canalId, true);
        }}
      >
        {casa.conversa.video}
      </Botao>
    </>
  );
}

/**
 * A conversa aberta: cabeçalho com a pessoa (ou o grupo), o chat COMPARTILHADO com
 * os servidores (lista virtualizada e composer — `servidorId` vazio, que o núcleo
 * resolve pelo usuário) e, em área larga, o perfil ao lado.
 *
 * Com a chamada desta conversa de pé e o palco aberto, o palco ocupa a área
 * inteira, igual às salas de um servidor; com o palco fechado, a chamada vira o
 * widget flutuante no canto.
 */
export function AreaDaDm({ canalId }: { canalId: string }) {
  const canal = useChannel(canalId);
  const chamada = useChamada();
  const palco = usePalco();
  const falha = useFalhaDeVoz();
  const pessoa = usePessoa(canal?.tipo === "dm" ? (canal.destinatarioId ?? "") : "");
  const [gerenciando, setGerenciando] = useState(false);

  if (!canal || (canal.tipo !== "dm" && canal.tipo !== "grupo" && canal.tipo !== "notas")) {
    return (
      <AreaPrincipal>
        <Indisponivel />
      </AreaPrincipal>
    );
  }

  const naChamadaAqui = chamada.estado !== "fora" && chamada.channelId === canalId;
  if (palco.tipo !== "fechado" && (naChamadaAqui || falha?.channelId === canalId)) {
    return (
      <main aria-label={shell.principal.rotulo} className={css.areaDoPalco}>
        <PalcoDaSala serverId="" canalId={canalId} />
      </main>
    );
  }

  const ehDm = canal.tipo === "dm";
  const ehGrupo = canal.tipo === "grupo";
  const nome = ehDm ? (pessoa?.displayName ?? canal.name) : ehGrupo ? canal.name : casa.conversa.notasTitulo;
  const subtitulo = ehDm
    ? pessoa !== undefined
      ? casa.amigos.status[pessoa.status]
      : undefined
    : ehGrupo
      ? casa.coluna.grupo(canal.participantes)
      : casa.conversa.notasTexto;
  const bloqueada = ehDm && (pessoa?.relacao === "bloqueado" || pessoa?.relacao === "bloqueadoPor");

  return (
    <AreaPrincipal
      camada={
        chamada.estado !== "fora" ? (
          <div className={css.camadaDeWidgets}>
            <WidgetDaChamadaConectado servidorAberto="" />
          </div>
        ) : undefined
      }
    >
      <div className={css.conversa}>
        <header className={css.cabeca}>
          <div className={css.identidade}>
            {ehDm ? (
              <Avatar nome={nome} id={canal.destinatarioId} tamanho={36} status={pessoa?.status} />
            ) : (
              <Avatar nome={nome} id={canalId} tamanho={36} />
            )}
            <div className={css.nomes}>
              <h2 className={css.titulo}>{nome}</h2>
              {subtitulo !== undefined && <span className={css.subtitulo}>{subtitulo}</span>}
            </div>
          </div>
          <div className={css.acoes}>
            {(ehDm || ehGrupo) && !bloqueada && <Chamar canalId={canalId} nome={nome} grupo={ehGrupo} />}
            {(ehDm || ehGrupo) && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={canal.silenciado ? <SinoMudo /> : <Sino />}
                aria-label={casa.conversa.silenciar}
                aria-pressed={canal.silenciado}
                onClick={() => {
                  alternarSilencio(canalId);
                }}
              />
            )}
            {ehGrupo && (
              <Botao
                variante="fantasma"
                tamanho="sm"
                icone={<Configuracoes />}
                aria-label={casa.grupo.gerenciar}
                onClick={() => {
                  setGerenciando(true);
                }}
              />
            )}
          </div>
        </header>
        <div className={css.corpo}>
          <div className={css.chat}>
            <AreaDeChat
              key={canalId}
              canalId={canalId}
              servidorId=""
              rodape={
                bloqueada && canal.destinatarioId !== undefined ? (
                  <SemEscrita
                    userId={canal.destinatarioId}
                    nome={nome}
                    euBloqueei={pessoa?.relacao === "bloqueado"}
                  />
                ) : undefined
              }
            />
          </div>
          {(ehDm || ehGrupo) && (
            <PerfilDaConversa canalId={canalId} tipo={ehDm ? "dm" : "grupo"} destinatarioId={canal.destinatarioId} nome={nome} />
          )}
        </div>
      </div>
      {ehGrupo && <GerenciarGrupo canalId={canalId} aberto={gerenciando} aoMudar={setGerenciando} />}
    </AreaPrincipal>
  );
}
