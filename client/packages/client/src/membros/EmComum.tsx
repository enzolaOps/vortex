import { memo, useEffect, useState, type ReactNode } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Girador } from "../components/ui/Girador";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { PontoDePresenca } from "../presenca/PontoDePresenca";
import { buscarEmComum, type EmComum as Resposta } from "../sdk/social";
import { usePessoa, useServer } from "../store/hooks";
import { selecionarServidor } from "../store/navegacao";
import css from "./EmComum.module.css";

/**
 * As duas abas de "em comum" do perfil completo — servidores e amigos.
 *
 * ⚠ **Uma busca por abertura do PERFIL, e não por troca de aba.** As duas abas
 * saem da mesma rota (`GET /users/{id}/mutual`), e quem alterna entre elas
 * não pediu duas consultas. Por isso o dono do estado é o perfil, que passa a
 * resposta para cá.
 *
 * O design desenha as abas e não o conteúdo delas; a linha é a linha de
 * pessoa da tela de amigos do mesmo arquivo (`Vortex DMs, Voz e Modais`):
 * avatar 32, vão 12, nome 14/600, detalhe 12 em `text-3`, respiro 10 e raio 8.
 */

/**
 * O estado da consulta, guardando PARA QUEM ela é — o arranjo das telas de
 * convites: derivar "carregando" do alvo evita `setState` em efeito.
 */
type ConsultaDeEmComum =
  | { readonly para: string; readonly resposta: Resposta | undefined }
  | undefined;

export function useEmComum(userId: string): {
  readonly estado: "carregando" | "erro" | "pronto";
  readonly dados: Resposta | undefined;
  readonly tentarDeNovo: () => void;
} {
  const [consulta, setConsulta] = useState<ConsultaDeEmComum>(undefined);
  const [tentativa, setTentativa] = useState(0);
  const chave = `${userId}:${String(tentativa)}`;

  useEffect(() => {
    let vivo = true;
    void buscarEmComum(userId).then((resposta) => {
      if (vivo) setConsulta({ para: chave, resposta });
    });
    return () => {
      vivo = false;
    };
  }, [chave, userId]);

  const atual = consulta?.para === chave ? consulta : undefined;
  return {
    estado:
      atual === undefined
        ? "carregando"
        : atual.resposta === undefined
          ? "erro"
          : "pronto",
    dados: atual?.resposta,
    tentarDeNovo: () => setTentativa((t) => t + 1),
  };
}

export function ServidoresEmComum({
  consulta,
  aoAbrir,
}: {
  consulta: ReturnType<typeof useEmComum>;
  /** Fecha o perfil antes de navegar — ir para trás de um véu é não ir. */
  aoAbrir: () => void;
}) {
  return (
    <Lista
      consulta={consulta}
      ids={consulta.dados?.servidores}
      vazio="Vocês não estão em nenhum servidor em comum."
      rotulo="Servidores em comum"
      linha={(id) => (
        <Servidor
          key={id}
          id={id}
          aoAbrir={() => {
            aoAbrir();
            selecionarServidor(id);
          }}
        />
      )}
    />
  );
}

export function AmigosEmComum({
  consulta,
}: {
  consulta: ReturnType<typeof useEmComum>;
}) {
  return (
    <Lista
      consulta={consulta}
      ids={consulta.dados?.amigos}
      vazio="Vocês não têm amigos em comum."
      rotulo="Amigos em comum"
      linha={(id) => <Amigo key={id} id={id} />}
    />
  );
}

function Lista({
  consulta,
  ids,
  vazio,
  rotulo,
  linha,
}: {
  consulta: ReturnType<typeof useEmComum>;
  ids: readonly string[] | undefined;
  vazio: string;
  rotulo: string;
  linha: (id: string) => ReactNode;
}) {
  if (consulta.estado === "carregando") {
    return (
      <div className={css.estado}>
        <Girador tamanho={14} rotulo={`Carregando ${rotulo.toLowerCase()}`} />
        <span>Carregando…</span>
      </div>
    );
  }

  if (consulta.estado === "erro") {
    /*
      ⚠ **Falha não é "nada em comum".** Dizer "vocês não têm servidores em
      comum" porque a rede caiu seria afirmar algo sobre duas pessoas numa tela
      onde se decide se alguém é conhecido.
    */
    return (
      <div className={css.estado} role="alert">
        <span>Não deu para carregar.</span>
        <button
          type="button"
          className={css.tentar}
          onClick={consulta.tentarDeNovo}
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  if (!ids || ids.length === 0) {
    return <p className={css.estado}>{vazio}</p>;
  }

  return (
    <ul className={css.lista} aria-label={rotulo}>
      {ids.map(linha)}
    </ul>
  );
}

/** Um servidor. Assina a si mesmo — lei nº 1. */
const Servidor = memo(function Servidor({
  id,
  aoAbrir,
}: {
  id: string;
  aoAbrir: () => void;
}) {
  const servidor = useServer(id);
  if (!servidor) return null;

  return (
    <li>
      <button type="button" className={css.linha} onClick={aoAbrir}>
        {/* O mesmo ladrilho do rail: gradiente do ID coberto pelo ícone. */}
        <span
          className={css.ladrilho}
          aria-hidden
          style={{
            backgroundImage: gradienteDe(id),
            color: corDoTextoDe(id),
          }}
        >
          {servidor.sigla}
          {servidor.avatarUrl !== undefined ? (
            <img
              className={css.icone}
              src={servidor.avatarUrl}
              alt=""
              loading="lazy"
            />
          ) : null}
        </span>
        <span className={css.texto}>
          <span className={css.nome}>{servidor.name}</span>
          <span className={css.detalhe}>Abrir servidor</span>
        </span>
      </button>
    </li>
  );
});

/** Um amigo em comum. Assina a própria pessoa — lei nº 1. */
const Amigo = memo(function Amigo({ id }: { id: string }) {
  const pessoa = usePessoa(id);
  if (!pessoa) return null;

  /*
    Sem alvo: a linha diz QUEM, e as ações sobre essa pessoa (mensagem, perfil)
    moram na tela de amigos e no cartão dela. Um botão aqui abriria um segundo
    perfil em cima deste — modal sobre modal, que o registro não permite.
  */
  return (
    <li className={css.linha}>
      <Avatar id={id} sigla={pessoa.sigla} url={pessoa.avatarUrl} tamanho="sm">
        <PontoDePresenca userId={id} className={css.ponto} />
      </Avatar>
      <span className={css.texto}>
        <span className={css.nome}>{pessoa.displayName}</span>
        <span className={css.detalhe}>@{pessoa.username}</span>
      </span>
    </li>
  );
});
