import { useEffect, useRef, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { apagarEmoji, criarEmoji, listarEmojis, type Emoji } from "../sdk/cargos";
import { subirAnexo, temServidorDeMidia } from "../sdk/anexos";
import { toast } from "../components/ui/toastStore";
import css from "./Secao.module.css";
import emojiCss from "./Emojis.module.css";
import tab from "./Tabela.module.css";
import { cn } from "../lib/cn";

/**
 * Os emojis do servidor.
 *
 * ⚠ **A página era uma GRADE de cartõezinhos, e a referência é uma TABELA.**
 * Comparadas lado a lado com as duas telas abertas: lá são quatro colunas
 * (imagem, alias, quem pode usar, quem enviou) na mesma moldura de Membros,
 * Convites e Banimentos; aqui eram caixinhas de 180px com a miniatura e o
 * nome. O comentário antigo defendia a grade — "o que distingue um emoji do
 * outro é a IMAGEM" —, e isso é verdade sobre o SELETOR de emoji, onde se
 * escolhe pelo desenho. Esta tela não escolhe: ela administra.
 *
 * ⚠ **Enviar existe, e o comentário aqui dizia que não podia.** A razão dada
 * era boa e EXPIROU: "sem instância alcançável não há como escrever isso e ver
 * funcionar". A stack local sobe o `autumn`, então deu para escrever e ver. O
 * caminho é o que aquele comentário já descrevia: sobe para o servidor de
 * MÍDIA pela tag `emojis`, e o `id` devolvido É o id do emoji —
 * `PUT /custom/emoji/{id}`. Não há dois identificadores.
 *
 * ⚠ **E o protocolo não tem editar emoji** — só criar e apagar. Renomear é
 * apagar e subir de novo, o que quebra toda mensagem que usava o antigo.
 */
export function Emojis({ serverId }: { serverId: string }) {
  const [lista, setLista] = useState<readonly Emoji[] | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const temMidia = temServidorDeMidia();

  /**
   * Sobe o arquivo e cria o emoji com o nome derivado dele.
   *
   * ⚠ **O nome vem do ARQUIVO e é saneado, e isso é escolha.** O protocolo
   * valida com `RE_EMOJI` (1–32, sem espaço), então `Festa da Firma.png`
   * voltaria `FailedValidation` — um erro sobre uma regra que ninguém mostrou.
   * Derivar `festa_da_firma` acerta na esmagadora maioria e dá um nome que a
   * pessoa reconhece.
   *
   * ⚠ Renomear NÃO existe no protocolo, e é o que torna essa escolha delicada:
   * quem quiser outro nome tem de apagar e subir de novo. É por isso que o
   * nome derivado aparece no toast de sucesso — para a pessoa saber qual ficou
   * antes de usá-lo em vinte mensagens.
   */
  function enviarEmoji(arquivo: File) {
    const nome = nomeDeEmoji(arquivo.name);
    if (nome === undefined) {
      toast({
        tipo: "erro",
        titulo: "Esse nome de arquivo não vira emoji.",
        descricao: "Renomeie para algo com letras ou números e tente de novo.",
      });
      return;
    }

    setEnviando(true);
    void subirAnexo(arquivo, "emojis")
      .then((id) => criarEmoji(serverId, id, nome))
      .then((ok) => {
        if (!ok) return;
        toast({ tipo: "info", titulo: `Emoji :${nome}: criado.` });
        /* Relê do servidor em vez de acrescentar à lista local: o objeto do
           emoji tem URL e id que só ele conhece, e inventá-los aqui seria uma
           segunda fonte da verdade para uma tela que abre uma vez. */
        return listarEmojis(serverId).then((l) => setLista(l));
      })
      .catch((e: unknown) => {
        toast({
          tipo: "erro",
          titulo: "Não deu para enviar o emoji.",
          descricao: e instanceof Error ? e.message : "Tente outra imagem.",
        });
      })
      .finally(() => setEnviando(false));
  }

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarEmojis(serverId).then((l) => {
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, [serverId]);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  /*
    ⚠ **A contagem separa ESTÁTICO de ANIMADO porque o servidor separa.** São
    cotas diferentes no protocolo, e um número só esconderia que a de GIF
    acabou enquanto a de PNG ainda tem espaço.
  */
  const animados = lista?.filter((e) => e.animado).length ?? 0;
  const estaticos = (lista?.length ?? 0) - animados;

  return (
    <div className={cn(css.forma, css.larga)} style={LARGURA}>
      {/*
        A área de envio fica ANTES da lista e aparece nos dois estados — com
        emojis e sem. Um botão que só existe quando já há um emoji seria a
        porta trancada por dentro.
      */}
      <button
        type="button"
        className={emojiCss.zona}
        data-sobre={sobre}
        disabled={enviando || !temMidia}
        onClick={() => seletor.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          const arquivo = e.dataTransfer.files[0];
          if (arquivo) enviarEmoji(arquivo);
        }}
      >
        <span className={emojiCss.zonaTitulo}>
          {enviando ? "Enviando…" : "Enviar emoji"}
        </span>
        <span className={emojiCss.zonaMedida}>
          arraste PNG, JPG ou GIF · 128×128
        </span>
        <span className={emojiCss.zonaGesto}>
          o nome do arquivo vira o alias
        </span>
      </button>

      <input
        ref={seletor}
        type="file"
        accept="image/*"
        className={emojiCss.seletor}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (arquivo) enviarEmoji(arquivo);
        }}
      />

      <div className={emojiCss.controles}>
        <p className={css.recado}>
          Apagar um emoji não apaga as mensagens que o usaram — elas passam a
          mostrar o código dele.
        </p>
        <span className={emojiCss.espaco} />
        <span className={emojiCss.contagem}>
          {lista === undefined
            ? ""
            : `${String(estaticos)} estáticos · ${String(animados)} animados`}
        </span>
      </div>

      <div className={cn(tab.tabela, emojiCss.tabela)} role="table">
        <div className={tab.cabecalho} role="row">
          <span>Imagem</span>
          <span>Alias</span>
          <span>Enviado por</span>
          <span />
        </div>

        {lista === undefined ? (
          <div className={tab.vazio}>
            <EstadoVazio compacto titulo="Carregando…" />
          </div>
        ) : lista.length === 0 ? (
          <div className={tab.vazio}>
            <EstadoVazio
              compacto
              titulo="Nenhum emoji"
              detalhe="Envie uma imagem para criar o primeiro."
            />
          </div>
        ) : (
          lista.map((e) => (
            <div key={e.id} className={tab.linha} role="row">
              {/*
                `alt` com o nome e não vazio: quem não vê a imagem precisa
                saber QUAL emoji está prestes a apagar, e essa é a única
                informação que distingue uma linha da outra.
              */}
              <img className={emojiCss.imagem} src={e.url} alt={e.nome} />
              <span className={emojiCss.alias}>:{e.nome}:</span>
              {e.porNome === undefined ? (
                <span className={emojiCss.semAutor}>não registrado</span>
              ) : (
                <span className={tab.meta}>{e.porNome}</span>
              )}
              <span className={tab.acao}>
                <Botao
                  variante="perigoSutil"
                  disabled={ocupado}
                  onClick={() => {
                    setOcupado(true);
                    void apagarEmoji(e.id)
                      .then((ok) => {
                        if (ok) setLista((l) => l?.filter((x) => x.id !== e.id));
                      })
                      .finally(() => setOcupado(false));
                  }}
                >
                  Excluir
                </Botao>
              </span>
            </div>
          ))
        )}
      </div>

      <p className={css.recado}>
        O design mostra ainda <strong>quem pode usar</strong> cada emoji, por
        cargo. Não existe em <code>Emoji</code>: o objeto tem quem criou, o
        nome, se é animado e a URL, e nada que restrinja o uso. Ficou de fora em
        vez de virar uma coluna que diz “todos” em toda linha.
      </p>
    </div>
  );
}

/* 1000, o mesmo teto de Banimentos — quatro colunas com uma ponta de ação. */
const LARGURA = { "--vx-editor-w": "1000px" } as React.CSSProperties;

/**
 * O nome de emoji derivado do nome do arquivo.
 *
 * `Festa da Firma.png` → `festa_da_firma`. `undefined` quando não sobra
 * caractere nenhum — nome só de emoji ou só de pontuação acontece, e mandar
 * string vazia daria um `FailedValidation` do servidor sobre uma regra que
 * ninguém mostrou.
 *
 * ⚠ Não é a regex do servidor copiada: ela é dele e muda com ele. Isto é o
 * saneamento que acerta no caso comum; o que não passar volta traduzido.
 */
function nomeDeEmoji(arquivo: string): string | undefined {
  const semExtensao = arquivo.replace(/\.[^.]+$/, "");
  const limpo = semExtensao
    .normalize("NFD")
    /* Tira acento: `ação` vira `acao`, e não `ao`. */
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return limpo === "" ? undefined : limpo;
}
