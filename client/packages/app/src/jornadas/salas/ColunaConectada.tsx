import { podeNoServidor, pode } from "nucleo/sdk/permissoes";
import { abrirTexto, lembrarSala } from "nucleo/store/ultimoLugar";
import {
  useCanaisDeTexto,
  useCanaisDeVoz,
  useCanalAtivo,
  useCanalDaChamada,
  useChannel,
  useConexao,
  useDetalheDaConexao,
  useLocal,
  usePessoasDaSala,
  useProntidao,
  useServer,
  useServidorAtivo,
} from "nucleo/store/hooks";
import { useState } from "react";

import { ColunaDeSalas } from "../../shell";
import { salas, shell } from "../../textos";
import { Botao, ItemDeSala } from "../../ui/ds";
import { ConvidarPessoas } from "./ConvidarPessoas";
import { CriarSala } from "./CriarSala";
import css from "./Salas.module.css";

function SalaDaColuna({ serverId, canalId }: { serverId: string; canalId: string }) {
  const canal = useChannel(canalId);
  const pessoas = usePessoasDaSala(serverId, canalId);
  const aqui = useCanalDaChamada() === canalId;
  const desatualizada = useConexao() !== "conectado";
  if (!canal) return null;
  return (
    <li>
      <ItemDeSala
        nome={canal.name}
        pessoas={pessoas.map((p) => ({ id: p.id, nome: p.nome || salas.alguem }))}
        aoVivo={pessoas.some((p) => p.estado === "tela")}
        conectado={aqui}
        desatualizada={desatualizada}
        onClick={() => {
          lembrarSala(serverId, canalId);
        }}
      />
    </li>
  );
}

function CanalDaColuna({ serverId, canalId }: { serverId: string; canalId: string }) {
  const canal = useChannel(canalId);
  const ativo = useCanalAtivo() === canalId;
  if (!canal) return null;
  return (
    <li>
      <ItemDeSala
        tipo="canal"
        nome={canal.name}
        selecionado={ativo}
        naoLida={canal.naoLidas > 0 && !canal.silenciado}
        mencoes={canal.silenciado ? 0 : canal.mencoes}
        onClick={() => {
          abrirTexto(serverId, canalId);
        }}
      />
    </li>
  );
}

/** Esqueleto até o `Ready`: a coluna existe, as linhas ainda não. */
export function EsqueletoDeSalas() {
  return (
    <div className={css.esqueleto} role="status" aria-label={salas.carregandoServidor}>
      <span className={css.bloco} />
      <span className={css.bloco} />
      <span className={css.bloco} />
      <span className={`${css.bloco} ${css.blocoCurto}`} />
    </div>
  );
}

/**
 * Servidor sem nenhuma sala de voz. As ações só existem para quem pode: criar
 * sala exige gerenciar canais; convidar exige poder criar convite em algum
 * canal. Quem não pode vê o aviso, sem botão.
 */
function ServidorSemSalas({ serverId, canalParaConvite }: { serverId: string; canalParaConvite: string | undefined }) {
  const [criando, setCriando] = useState(false);
  const [convidando, setConvidando] = useState(false);
  const podeCriar = podeNoServidor(serverId, "gerenciarCanais");
  const podeConvidar = canalParaConvite !== undefined && pode(canalParaConvite, "criarConvite");
  return (
    <div className={css.vazio}>
      <h3 className={css.vazioTitulo}>{salas.servidorVazio.titulo}</h3>
      <p className={css.vazioTexto}>
        {podeCriar ? salas.servidorVazio.comPermissao : salas.servidorVazio.semPermissao}
      </p>
      {(podeCriar || podeConvidar) && (
        <div className={css.vazioAcoes}>
          {podeCriar && (
            <Botao
              onClick={() => {
                setCriando(true);
              }}
            >
              {salas.criarSala}
            </Botao>
          )}
          {podeConvidar && (
            <Botao
              variante="secundario"
              onClick={() => {
                setConvidando(true);
              }}
            >
              {salas.servidorVazio.convidar}
            </Botao>
          )}
        </div>
      )}
      {podeCriar && <CriarSala serverId={serverId} aberto={criando} aoMudar={setCriando} />}
      {canalParaConvite !== undefined && podeConvidar && (
        <ConvidarPessoas canalId={canalParaConvite} aberto={convidando} aoMudar={setConvidando} />
      )}
    </div>
  );
}

function AvisoDeConexao() {
  const detalhe = useDetalheDaConexao();
  if (detalhe.estado === "conectado") return null;
  return (
    <div className={css.aviso} role="status">
      <span>{detalhe.estado === "reconectando" ? salas.reconectando : salas.semConexao}</span>
      {detalhe.ultimaSincroniaTexto !== undefined && (
        <span className={css.avisoMiudo}>{salas.ultimaSincronia(detalhe.ultimaSincroniaTexto)}</span>
      )}
    </div>
  );
}

function ListaDoServidor({ serverId }: { serverId: string }) {
  const emVoz = useCanaisDeVoz(serverId);
  const emTexto = useCanaisDeTexto(serverId);
  return (
    <>
      <section className={css.secao} aria-label={salas.secaoDeSalas}>
        <h3 className={css.rotuloDaSecao}>{salas.secaoDeSalas}</h3>
        {emVoz.length === 0 ? (
          <ServidorSemSalas serverId={serverId} canalParaConvite={emTexto[0]} />
        ) : (
          <ul className={css.lista}>
            {emVoz.map((id) => (
              <SalaDaColuna key={id} serverId={serverId} canalId={id} />
            ))}
          </ul>
        )}
      </section>
      <section className={css.secao} aria-label={salas.secaoDeTexto}>
        <h3 className={css.rotuloDaSecao}>{salas.secaoDeTexto}</h3>
        {emTexto.length === 0 ? (
          <p className={css.nota}>{salas.semCanaisDeTexto}</p>
        ) : (
          <ul className={css.lista}>
            {emTexto.map((id) => (
              <CanalDaColuna key={id} serverId={serverId} canalId={id} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/**
 * A coluna de salas e canais ligada aos stores. Sem servidor aberto, a coluna
 * vazia do catálogo; antes do `Ready`, esqueleto; com a conexão caída, a faixa
 * que diz que a presença pode estar desatualizada (e as salas, esmaecidas).
 */
export function ColunaConectada() {
  const pronto = useProntidao();
  const local = useLocal();
  const serverId = useServidorAtivo();
  const servidor = useServer(serverId);

  if (!pronto) {
    return (
      <ColunaDeSalas titulo={salas.carregandoServidor}>
        <EsqueletoDeSalas />
      </ColunaDeSalas>
    );
  }
  if (local.tipo !== "servidor" || !servidor) {
    return <ColunaDeSalas>{<p className={css.nota}>{shell.salas.vazio}</p>}</ColunaDeSalas>;
  }
  return (
    <ColunaDeSalas titulo={servidor.name} aviso={<AvisoDeConexao />}>
      <ListaDoServidor serverId={serverId} />
    </ColunaDeSalas>
  );
}
