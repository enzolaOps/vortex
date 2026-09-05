import { useEffect, useRef, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { apagarEmoji, criarEmoji, listarEmojis, type Emoji } from "../sdk/cargos";
import { subirAnexo, temServidorDeMidia } from "../sdk/anexos";
import { toast } from "../components/ui/toastStore";
import css from "./Secao.module.css";
import emojiCss from "./Emojis.module.css";
import { cn } from "../lib/cn";

/**
 * Os emojis do servidor.
 *
 * ⚠ **Enviar passou a existir, e o comentário aqui dizia que não podia.** A
 * razão dada era boa e EXPIROU: "sem instância alcançável não há como escrever
 * isso e ver funcionar". A stack local sobe o `autumn`, então deu para
 * escrever e ver.
 *
 * O caminho é o que aquele comentário já descrevia: sobe para o servidor de
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

  if (lista === undefined) {
    return <p className={css.recado}>Carregando…</p>;
  }

  if (lista.length === 0) {
    return (
      /* 900, da referência (`ServerEmojiPage`) — a grade de emoji é varredura,
       e 880 é a medida de um formulário. */
    <div
      className={cn(css.forma, css.larga)}
      style={{ "--vx-editor-w": "900px" } as React.CSSProperties}
    >
      {/*
        A barra de envio fica ANTES da lista e aparece nos dois estados — com
        emojis e sem. Um botão que só existe quando já há um emoji seria a
        porta trancada por dentro.
      */}
      <div className={emojiCss.barra}>
        <Botao
          variante="primario"
          disabled={enviando || !temMidia}
          onClick={() => seletor.current?.click()}
        >
          {enviando ? "Enviando…" : "Enviar emoji"}
        </Botao>
        <span className={emojiCss.dica}>
          PNG ou GIF, até 500 KB. O nome vem do arquivo.
        </span>
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
      </div>
        <EstadoVazio
          titulo="Nenhum emoji"
          detalhe="Envie uma imagem para criar o primeiro."
        />
      </div>
    );
  }

  return (
    <div className={css.forma}>
      {/*
        A barra de envio fica ANTES da lista e aparece nos dois estados — com
        emojis e sem. Um botão que só existe quando já há um emoji seria a
        porta trancada por dentro.
      */}
      <div className={emojiCss.barra}>
        <Botao
          variante="primario"
          disabled={enviando || !temMidia}
          onClick={() => seletor.current?.click()}
        >
          {enviando ? "Enviando…" : "Enviar emoji"}
        </Botao>
        <span className={emojiCss.dica}>
          PNG ou GIF, até 500 KB. O nome vem do arquivo.
        </span>
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
      </div>

      <p className={css.recado}>
        Apagar um emoji não apaga as mensagens que o usaram — elas passam a
        mostrar o código dele.
      </p>

      <ul className={emojiCss.grade}>
        {lista.map((e) => (
          <li key={e.id} className={emojiCss.item}>
            {/*
              `alt` com o nome e não vazio: quem não vê a imagem precisa saber
              QUAL emoji está prestes a apagar, e essa é a única informação que
              distingue uma linha da outra.
            */}
            <img className={emojiCss.imagem} src={e.url} alt={e.nome} />
            <span className={emojiCss.nome}>:{e.nome}:</span>
            <Botao
              variante="sutil"
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
              Apagar
            </Botao>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
