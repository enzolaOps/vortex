import { PencilSimple } from "@phosphor-icons/react";
import { useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import { gradienteDe } from "../lib/gradiente";
import {
  lerGrupo,
  removerDoGrupo,
  renomearGrupo,
  sairDaConversa,
  transferirGrupo,
} from "../sdk/social";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { usePessoa } from "../store/hooks";
import { assinarSessao, lerSessao } from "../store/sessao";
import css from "./GerenciarGrupo.module.css";

/** Uma pessoa do grupo. Assina a si mesma. */
function Membro({
  id,
  dono,
  souDono,
  aoRemover,
  aoTransferir,
}: {
  id: string;
  dono: boolean;
  souDono: boolean;
  aoRemover: () => void;
  aoTransferir: () => void;
}) {
  const pessoa = usePessoa(id);

  return (
    <div className={css.membro}>
      <Avatar id={id} sigla={pessoa?.sigla} url={pessoa?.avatarUrl} tamanho="sm" />
      <div className={css.textos}>
        <div className={css.nome}>{pessoa?.displayName ?? "alguém"}</div>
        {dono ? <div className={css.papel}>dona do grupo</div> : null}
      </div>

      {dono ? (
        <Selo forma="etiqueta" tom="acento">
          Dono
        </Selo>
      ) : souDono ? (
        <>
          {/*
            ⚠ **Transferir aparece por MEMBRO e não numa lista à parte**, e é
            o que faz a ação ser possível sem uma segunda tela: transferir é
            escolher UMA pessoa, e o lugar onde se escolhe uma pessoa é a
            linha dela.
          */}
          <button
            type="button"
            className={css.acao}
            onClick={aoTransferir}
          >
            Transferir
          </button>
          <button
            type="button"
            className={css.acaoPerigo}
            onClick={aoRemover}
          >
            Remover
          </button>
        </>
      ) : null}
    </div>
  );
}

/**
 * Gerenciar grupo.
 *
 * ⚠ **Quatro das cinco ações são escrita de PROTOCOLO de verdade** — renomear
 * (`edit({name})`), adicionar (`addMember`), remover (`removeMember`) e
 * transferir (`edit({owner})`). O ícone é a única que não: ele precisa de
 * upload ao servidor de mídia, a mesma dependência de `anexar` e dos emojis.
 *
 * ⚠ **Sair do grupo sendo dono TRANSFERE antes**, e a frase do design explica
 * por quê: *"nunca deixa o grupo sem dono"*. O protocolo não faz isso sozinho —
 * `DELETE /channels/{id}` sai e pronto —, então a regra é do cliente e roda
 * aqui: o membro mais antigo herda. "Mais antigo" é o primeiro de
 * `recipientIds` depois de tirar você, que é a ordem em que o servidor os
 * devolve.
 */
export function GerenciarGrupo({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const meuId = useSyncExternalStore(assinarSessao, lerSessao).userId ?? "";
  const channelId = alvo?.tipo === "grupo" ? alvo.channelId : "";

  /*
    Leitura direta e não store: a lista de um grupo muda por ação humana, e o
    modal é remontado a cada abertura. Um store por grupo seria maquinário para
    um dado que ninguém observa enquanto o modal está fechado.
  */
  const grupo = lerGrupo(channelId);
  const [nome, setNome] = useState(grupo?.nome ?? "");
  const [ocupado, setOcupado] = useState(false);

  if (!grupo) return null;

  const souDono = grupo.donoId === meuId;
  const outros = grupo.membrosIds.filter((id) => id !== grupo.donoId);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Gerenciar grupo"
        tituloOculto
        className={css.painel}
      >
        <div className={css.cabecalho}>
          <div className={css.icone}>
            {/*
              ⚠ O gradiente do ID, como todo avatar deste app — e não um
              quadrado cinza. Um grupo sem ícone precisa ser reconhecível na
              lista de conversas tanto quanto uma pessoa.
            */}
            <span
              className={css.ladrilho}
              style={{ backgroundImage: gradienteDe(channelId) }}
              aria-hidden
            />
            <button
              type="button"
              className={css.trocarIcone}
              aria-label="Trocar ícone do grupo"
              onClick={aindaNao("iconeDeGrupo")}
            >
              <PencilSimple size={11} aria-hidden />
            </button>
          </div>

          <div className={css.identidade}>
            {/*
              Campo de verdade e não texto com lápis: renomear é a coisa mais
              frequente aqui, e um passo a mais para chegar ao campo é atrito
              na ação principal da tela.

              ⚠ Salva no BLUR e não a cada tecla: uma escrita de protocolo por
              caractere é a mesma conta que fez a busca esperar o Enter.
            */}
            <input
              className={css.campoDeNome}
              aria-label="Nome do grupo"
              value={nome}
              disabled={!souDono}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => {
                const limpo = nome.trim();
                if (limpo.length === 0 || limpo === grupo.nome) {
                  setNome(grupo.nome);
                  return;
                }
                void renomearGrupo(channelId, limpo);
              }}
            />
            <p className={css.contagem}>
              {grupo.membrosIds.length} membros ·{" "}
              {souDono ? "criado por você" : "você é membro"}
            </p>
          </div>
        </div>

        <div className={css.tituloDaLista}>
          <span className={css.sobrancelha}>Membros</span>
          {souDono ? (
            <button
              type="button"
              className={css.acao}
              onClick={aindaNao("adicionarAoGrupo")}
            >
              ＋ Adicionar
            </button>
          ) : null}
        </div>

        <div className={css.lista}>
          <Membro
            id={grupo.donoId}
            dono
            souDono={souDono}
            aoRemover={() => undefined}
            aoTransferir={() => undefined}
          />
          {outros.map((id) => (
            <Membro
              key={id}
              id={id}
              dono={false}
              souDono={souDono}
              aoRemover={() => void removerDoGrupo(channelId, id)}
              aoTransferir={() => void transferirGrupo(channelId, id)}
            />
          ))}
        </div>

        <div className={css.rodape}>
          <button
            type="button"
            className={css.itemDeRodape}
            onClick={aindaNao("notificacoesDoGrupo")}
          >
            Notificações do grupo
          </button>
          <button
            type="button"
            className={css.itemDestrutivo}
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              /*
                ⚠ **Transfere ANTES de sair, quando você é dono.** A frase do
                design é literal: "nunca deixa o grupo sem dono". O protocolo
                não faz isso sozinho, então a ordem importa — sair primeiro e
                transferir depois seria transferir um grupo do qual você já não
                faz parte.
              */
              const herdeiro = souDono ? outros[0] : undefined;
              const antes =
                herdeiro !== undefined
                  ? transferirGrupo(channelId, herdeiro)
                  : Promise.resolve(true);

              void antes
                .then((ok) => (ok ? sairDaConversa(channelId) : false))
                .then((ok) => {
                  if (ok) aoFechar();
                })
                .finally(() => setOcupado(false));
            }}
          >
            Sair do grupo
          </button>
        </div>

        {souDono && outros.length > 0 ? (
          <p className={css.recado}>
            Sair de um grupo do qual você é dono transfere a propriedade para o
            membro mais antigo — nunca deixa o grupo sem dono.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
