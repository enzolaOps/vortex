import { useRef, useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { UploadSimple } from "../components/ui/icones";
import { cn } from "../lib/cn";
import { enviarMensagem } from "../sdk/adapter";
import { temServidorDeMidia } from "../sdk/anexos";
import { criarTopico, nomeDeTopicoDe } from "../sdk/topicos";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useForum, useMessage } from "../store/hooks";
import { selecionarCanal } from "../store/navegacao";
import css from "./ModalDeTopico.module.css";

/**
 * Abrir um tópico, criar um post e enviar mídia — o MESMO gesto de protocolo.
 *
 * Os três são `POST /channels/:id/threads`; o post e a mídia mandam em seguida
 * a primeira mensagem de dentro. Três formulários num modal pela mesma razão
 * de `ModalDeCanal`: três modais seriam três cópias do campo de nome que
 * precisariam concordar.
 *
 * ⚠ **O design NÃO desenha estes formulários.** O artboard do fórum tem o
 * botão "Novo post", o da galeria tem "Enviar mídia", e nenhum dos dois mostra
 * o que abre. A referência também deixa os dois sem `onClick`. O que está aqui
 * é o menor formulário que o protocolo exige, com as peças que o projeto já
 * tem — e é divergência registrada, não 1:1.
 */
export function ModalDeTopico({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);

  const titulo =
    alvo?.tipo === "novoPost"
      ? "Novo post"
      : alvo?.tipo === "enviarMidia"
        ? "Enviar mídia"
        : "Abrir tópico";

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent titulo={titulo} className={css.painel}>
        {alvo?.tipo === "criarTopico" ? (
          <FormaDeTopico
            aoFechar={aoFechar}
            channelId={alvo.channelId}
            mensagemId={alvo.mensagemId}
          />
        ) : alvo?.tipo === "novoPost" ? (
          <FormaDePost aoFechar={aoFechar} forumId={alvo.forumId} />
        ) : alvo?.tipo === "enviarMidia" ? (
          <FormaDeMidia aoFechar={aoFechar} forumId={alvo.forumId} inicial={alvo.arquivo} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function FormaDeTopico({
  aoFechar,
  channelId,
  mensagemId,
}: {
  aoFechar: () => void;
  channelId: string;
  mensagemId: string | undefined;
}) {
  const mensagem = useMessage(mensagemId ?? "");
  // O nome nasce do texto da mensagem: é o assunto que a pessoa já escreveu.
  const [nome, setNome] = useState(() => (mensagem ? nomeDeTopicoDe(mensagem.content) : ""));
  const [enviando, setEnviando] = useState(false);
  const limpo = nome.trim();

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (limpo.length === 0 || enviando) return;
        setEnviando(true);
        void criarTopico(channelId, limpo, { mensagemId })
          .then((id) => {
            if (!id) return;
            selecionarCanal(id);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Nome do tópico"
        dica="As respostas ficam no tópico e não notificam o canal."
        autoFocus
        maxLength={100}
        value={nome}
        disabled={enviando}
        onChange={(e) => setNome(e.target.value)}
      />
      <div className={css.acoes}>
        <Botao variante="neutro" type="button" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao variante="primario" type="submit" disabled={limpo.length === 0} carregando={enviando}>
          Abrir tópico
        </Botao>
      </div>
    </form>
  );
}

/** Cinco tags por post — o teto que o servidor valida. */
const TETO_DE_TAGS = 5;

function FormaDePost({ aoFechar, forumId }: { aoFechar: () => void; forumId: string }) {
  const forum = useForum(forumId);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [tags, setTags] = useState<readonly string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const limpo = titulo.trim();

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (limpo.length === 0 || enviando) return;
        setEnviando(true);
        void criarTopico(forumId, limpo, { tags })
          .then((id) => {
            if (!id) return;
            /*
              ⚠ **Duas escritas.** O protocolo não aceita corpo na criação do
              tópico: a primeira mensagem de dentro É a abertura do post. Se a
              segunda falhar, o post existe sem corpo — melhor que apagar o
              que a pessoa pediu; o rascunho fica no composer do tópico.
            */
            if (corpo.trim()) enviarMensagem(id, corpo);
            selecionarCanal(id);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      <Campo
        rotulo="Título"
        autoFocus
        maxLength={100}
        value={titulo}
        disabled={enviando}
        onChange={(e) => setTitulo(e.target.value)}
      />

      {forum && forum.tags.length > 0 ? (
        <div className={css.grupo}>
          <span className={css.sobrancelha}>Tags</span>
          <div className={css.tags} role="group" aria-label="Tags do post">
            {forum.tags.map((t) => {
              const marcada = tags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={marcada}
                  disabled={enviando || (!marcada && tags.length >= TETO_DE_TAGS)}
                  className={cn(css.tag, marcada && css.tagMarcada)}
                  /* A cor é dado do servidor, já validada como `#rrggbb` na
                     tradução — ver `corDeTag`. */
                  style={marcada && t.cor ? ({ "--cor-da-tag": t.cor } as React.CSSProperties) : undefined}
                  onClick={() =>
                    setTags((atual) =>
                      atual.includes(t.id) ? atual.filter((x) => x !== t.id) : [...atual, t.id],
                    )
                  }
                >
                  {t.nome}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <label className={css.grupo}>
        <span className={css.sobrancelha}>Mensagem</span>
        <textarea
          className={css.area}
          rows={5}
          value={corpo}
          disabled={enviando}
          placeholder="O que você quer discutir?"
          onChange={(e) => setCorpo(e.target.value)}
        />
      </label>

      <div className={css.acoes}>
        <Botao variante="neutro" type="button" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao variante="primario" type="submit" disabled={limpo.length === 0} carregando={enviando}>
          Publicar post
        </Botao>
      </div>
    </form>
  );
}

function FormaDeMidia({
  aoFechar,
  forumId,
  inicial,
}: {
  aoFechar: () => void;
  forumId: string;
  inicial: File | undefined;
}) {
  const [arquivo, setArquivo] = useState<File | undefined>(inicial);
  const [legenda, setLegenda] = useState("");
  const [enviando, setEnviando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const limpo = legenda.trim();
  const temMidia = temServidorDeMidia();

  return (
    <form
      className={css.corpo}
      onSubmit={(e) => {
        e.preventDefault();
        if (!arquivo || limpo.length === 0 || enviando) return;
        setEnviando(true);
        /*
          O item da galeria é um post cuja primeira mensagem É a mídia — o
          servidor recusa a primeira mensagem sem anexo num canal de mídia. A
          legenda é o nome do post, e é por isso que ela é obrigatória.
        */
        void criarTopico(forumId, limpo)
          .then((id) => {
            if (!id) return;
            enviarMensagem(id, "", undefined, [arquivo]);
            aoFechar();
          })
          .finally(() => setEnviando(false));
      }}
    >
      {!temMidia ? (
        <p className={css.aviso}>
          Esta instância não tem servidor de mídia, então não há para onde enviar o arquivo.
        </p>
      ) : null}

      {/* O `input` de arquivo escondido e acionado pelo botão — a mesma
          decisão do composer: o nativo é desenhado pelo sistema. */}
      <input
        ref={seletor}
        type="file"
        accept="image/*,video/*"
        className={css.seletor}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          setArquivo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={css.soltar}
        disabled={!temMidia || enviando}
        onClick={() => seletor.current?.click()}
      >
        <UploadSimple aria-hidden />
        {arquivo ? arquivo.name : "Escolher imagem ou vídeo"}
      </button>

      <Campo
        rotulo="Legenda"
        dica="Obrigatória — é o nome do item e o que a busca da galeria encontra."
        maxLength={100}
        value={legenda}
        disabled={!temMidia || enviando}
        onChange={(e) => setLegenda(e.target.value)}
      />

      <div className={css.acoes}>
        <Botao variante="neutro" type="button" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao
          variante="primario"
          type="submit"
          disabled={!temMidia || !arquivo || limpo.length === 0}
          carregando={enviando}
        >
          Enviar
        </Botao>
      </div>
    </form>
  );
}
