import {
  ICONE,
  PencilSimple,
} from "../components/ui/icones";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Opcao } from "../components/ui/Marcador";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Selo } from "../components/ui/Selo";
import { CaretLeft, MagnifyingGlass } from "../components/ui/icones";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { Candidata, Ficha, Filtrada, TETO } from "./NovoGrupo";
import cssNovo from "./NovoGrupo.module.css";
import { gradienteDe } from "../lib/gradiente";
import { subirAnexo, temServidorDeMidia } from "../sdk/anexos";
import { toast } from "../components/ui/toastStore";
import {
  adicionarAoGrupo,
  lerGrupo,
  removerDoGrupo,
  renomearGrupo,
  sairDaConversa,
  transferirGrupo,
  trocarIconeDoGrupo,
} from "../sdk/social";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { publicarRelacoes } from "../sdk/adapter";
import {
  NIVEIS_DE_NOTIFICACAO,
  assinarSilencio,
  definirNivelDoCanal,
  nivelDoCanal,
} from "../store/silencio";
import { useChannel, usePessoa, useRelacao } from "../store/hooks";
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
 * Modo do modal.
 *
 * ⚠ **Troca de tela DENTRO do mesmo modal, e não um segundo `Dialog` por
 * cima.** A regra do registro de modais é "um por vez, de propósito": pilha de
 * modais é a tela com três véus onde `Esc` fecha um e ninguém sabe qual. Aqui
 * as três telas são a mesma conversa sobre o mesmo grupo — abrir um modal
 * sobre o outro para escolher três amigos seria maquinário para uma volta.
 */
type Modo = "membros" | "adicionar" | "notificacoes";

/**
 * Escolher quem entra no grupo.
 *
 * ⚠ **Reaproveita `Candidata`, `Filtrada` e `Ficha` do `NovoGrupo`** — foi o
 * que o `depende` desta pendência pediu por extenso. Com os atuais fora da
 * lista: oferecer alguém que já está dentro produz um clique que o servidor
 * recusa, e a recusa chega como erro em vez de como "já está aqui".
 */
function Adicionar({
  channelId,
  jaDentro,
  aoVoltar,
}: {
  channelId: string;
  jaDentro: readonly string[];
  aoVoltar: () => void;
}) {
  const amigos = useRelacao("amigo");
  const [escolhidos, setEscolhidos] = useState<readonly string[]>([]);
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState(false);

  /* Mesma razão do `NovoGrupo`: agrupar relações é varredura sobre todo mundo,
     então roda quando alguém OLHA. Quem olha agora também é esta tela, e ela
     não passa pela de amigos. Sem isto a lista nasce vazia. */
  useEffect(() => {
    publicarRelacoes();
  }, []);

  /* De fora quem já está dentro — inclusive você. */
  const dentro = new Set(jaDentro);
  const disponiveis = amigos.filter((id) => !dentro.has(id));

  /* O teto é do GRUPO e não da escolha: dez no total, e os atuais já ocupam
     lugar. Contar só os marcados deixaria passar de dez, e o erro viria do
     servidor depois do clique. */
  const vagas = Math.max(0, TETO - jaDentro.length);
  const cheio = escolhidos.length >= vagas;

  function alternar(id: string) {
    setEscolhidos((atual) =>
      atual.includes(id)
        ? atual.filter((x) => x !== id)
        : atual.length < vagas
          ? [...atual, id]
          : atual,
    );
  }

  return (
    <>
      <div className={css.tituloDaLista}>
        <button type="button" className={css.acao} onClick={aoVoltar}>
          <CaretLeft size={ICONE.selo} aria-hidden /> Voltar
        </button>
        <span className={css.sobrancelha}>
          {vagas === 1 ? "1 vaga" : `${String(vagas)} vagas`}
        </span>
      </div>

      {escolhidos.length > 0 ? (
        <div className={cssNovo.fichas}>
          {escolhidos.map((id) => (
            <Ficha key={id} id={id} aoTirar={() => alternar(id)} />
          ))}
        </div>
      ) : null}

      <div className={cssNovo.campo}>
        <MagnifyingGlass size={ICONE.controle} aria-hidden />
        <input
          type="search"
          className={cssNovo.entrada}
          placeholder="Buscar amigos"
          aria-label="Buscar amigos"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {disponiveis.length === 0 ? (
        <EstadoVazio
          titulo="Todo mundo já está aqui"
          detalhe="Seus amigos já fazem parte deste grupo. Peça amizade a mais gente para convidar."
        />
      ) : (
        <div className={cssNovo.lista} role="group" aria-label="Amigos">
          {disponiveis.map((id) => (
            <Filtrada key={id} id={id} busca={busca}>
              <Candidata
                id={id}
                marcada={escolhidos.includes(id)}
                bloqueada={cheio && !escolhidos.includes(id)}
                aoAlternar={() => alternar(id)}
              />
            </Filtrada>
          ))}
        </div>
      )}

      <div className={css.rodape}>
        <Botao
          variante="primario"
          disabled={escolhidos.length === 0}
          carregando={enviando}
          rotuloCarregando="Adicionando…"
          onClick={() => {
            setEnviando(true);
            /*
              ⚠ **Uma chamada por pessoa, e `allSettled` e não `all`.** O
              protocolo não tem adicionar em lote — `PUT /channels/{id}/recipients/{user}`
              é um por vez. Com `all`, a primeira recusa abandonaria o
              resultado das outras já em voo e a tela voltaria sem dizer quem
              entrou; `allSettled` deixa contar as que passaram.
            */
            void Promise.allSettled(
              escolhidos.map((id) => adicionarAoGrupo(channelId, id)),
            )
              .then((r) => {
                const falhas = r.filter((x) => x.status === "rejected").length;
                if (falhas > 0) {
                  toast({
                    tipo: "erro",
                    titulo:
                      falhas === escolhidos.length
                        ? "Ninguém foi adicionado"
                        : `${String(falhas)} não puderam entrar`,
                    descricao: "Tente de novo em instantes.",
                  });
                }
                aoVoltar();
              })
              .finally(() => setEnviando(false));
          }}
        >
          {escolhidos.length === 0
            ? "Adicionar"
            : `Adicionar ${String(escolhidos.length)}`}
        </Botao>
      </div>
    </>
  );
}

/**
 * O que notifica neste grupo.
 *
 * ⚠ **Três níveis e não a matriz da tela global.** A pergunta aqui é "quanto
 * deste grupo me interessa", que tem três respostas; a global cruza evento ×
 * forma de entrega porque ali a pergunta é "como eu quero ser avisado".
 * Repetir a matriz por canal daria dezenas de células para uma escolha de três
 * valores, e a pessoa abandonaria antes de responder.
 */
function Notificacoes({
  channelId,
  aoVoltar,
}: {
  channelId: string;
  aoVoltar: () => void;
}) {
  const nivel = useSyncExternalStore(assinarSilencio, () =>
    nivelDoCanal(channelId),
  );

  return (
    <>
      <div className={css.tituloDaLista}>
        <button type="button" className={css.acao} onClick={aoVoltar}>
          <CaretLeft size={ICONE.selo} aria-hidden /> Voltar
        </button>
        <span className={css.sobrancelha}>Notificações</span>
      </div>

      <div
        className={css.lista}
        role="radiogroup"
        aria-label="Notificações do grupo"
      >
        {/*
          ⚠ **"Padrão" é uma opção de verdade, e não a ausência das outras
          três.** Quem nunca escolheu deve acompanhar a mudança do padrão
          global; quem escolheu "todas" quer todas mesmo que o padrão mude.
          Sem esta linha não haveria como VOLTAR ao padrão depois de escolher.
        */}
        <Opcao
          marcado={nivel === undefined}
          aoEscolher={() => definirNivelDoCanal(channelId, undefined)}
        >
          Usar o padrão
        </Opcao>
        {NIVEIS_DE_NOTIFICACAO.map((n) => (
          <Opcao
            key={n.id}
            marcado={nivel === n.id}
            aoEscolher={() => definirNivelDoCanal(channelId, n.id)}
          >
            {n.rotulo}
          </Opcao>
        ))}
      </div>
    </>
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
  const [modo, setModo] = useState<Modo>("membros");

  /* ------------------------------------------------------------- ícone */

  const seletorDeIcone = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<string | undefined>(undefined);
  const [subindo, setSubindo] = useState(false);
  const temMidia = temServidorDeMidia();

  /*
    A prévia local ganha do que veio do servidor enquanto o upload está em
    voo: quem acabou de escolher a imagem precisa vê-la, e o snapshot só troca
    depois que o `ChannelUpdate` dá a volta.
  */
  const canal = useChannel(channelId);
  const imagem = previa ?? canal?.iconeUrl;

  /* `revokeObjectURL` no desmonte — cada `createObjectURL` prende o arquivo na
     memória da aba até ser revogado. É o erro nº 5 do briefing. */
  useEffect(() => {
    return () => {
      if (previa !== undefined) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  /**
   * Sobe a imagem e a aplica ao grupo.
   *
   * ⚠ **Aqui a troca é IMEDIATA, ao contrário do ícone ao criar servidor.** Lá
   * o servidor ainda não existia e o ícone só podia ser vestido depois; aqui o
   * grupo existe, então escolher já é trocar — não há botão de salvar nesta
   * tela, e inventar um só para o ícone contradiria o campo de nome ao lado,
   * que salva ao sair.
   *
   * A prévia local aparece antes da rede e é desfeita se algo falhar: mostrar
   * uma imagem que não colou é pior que não mostrar nenhuma.
   */
  function escolherIcone(arquivo: File) {
    const anterior = previa;
    const url = URL.createObjectURL(arquivo);
    setPrevia(url);
    setSubindo(true);
    if (anterior !== undefined) URL.revokeObjectURL(anterior);

    void subirAnexo(arquivo, "icons")
      .then((id) => trocarIconeDoGrupo(channelId, id))
      .then((colou) => {
        if (colou) return;
        URL.revokeObjectURL(url);
        setPrevia(undefined);
      })
      .catch((e: unknown) => {
        URL.revokeObjectURL(url);
        setPrevia(undefined);
        toast({
          tipo: "erro",
          titulo: "Não deu para enviar o ícone.",
          descricao: e instanceof Error ? e.message : "Tente outra imagem.",
        });
      })
      .finally(() => setSubindo(false));
  }

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
            >
              {/*
                A imagem COBRE o gradiente em vez de substituí-lo, como no
                `Avatar`: ela vem do servidor de mídia e pode demorar ou
                falhar, e com o gradiente por baixo o intervalo mostra a
                identidade de sempre.
              */}
              {imagem !== undefined ? (
                <img className={css.imagem} src={imagem} alt="" />
              ) : null}
            </span>
            <button
              type="button"
              className={css.trocarIcone}
              aria-label="Trocar ícone do grupo"
              disabled={subindo || !temMidia}
              onClick={() => seletorDeIcone.current?.click()}
            >
              <PencilSimple size={ICONE.selo} aria-hidden />
            </button>

            {/* Escondido e acionado pelo botão — ver o composer: nativo é
                renderizado pelo sistema e não aceita os oito estados. */}
            <input
              ref={seletorDeIcone}
              type="file"
              accept="image/*"
              className={css.seletorDeIcone}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) escolherIcone(arquivo);
              }}
            />
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

        {modo === "adicionar" ? (
          <Adicionar
            channelId={channelId}
            jaDentro={grupo.membrosIds}
            aoVoltar={() => setModo("membros")}
          />
        ) : modo === "notificacoes" ? (
          <Notificacoes
            channelId={channelId}
            aoVoltar={() => setModo("membros")}
          />
        ) : (
          <>
        <div className={css.tituloDaLista}>
          <span className={css.sobrancelha}>Membros</span>
          {souDono ? (
            <button
              type="button"
              className={css.acao}
              onClick={() => setModo("adicionar")}
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
            onClick={() => setModo("notificacoes")}
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
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
