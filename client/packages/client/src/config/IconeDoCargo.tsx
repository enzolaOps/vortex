import { useEffect, useRef, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Plus } from "../components/ui/icones";
import { subirAnexo, temServidorDeMidia } from "../sdk/anexos";
import { definirIconeDoCargo, type Cargo } from "../sdk/cargos";
import { aindaNao } from "../pendente/pendencias";
import cargoCss from "./Cargos.module.css";

/**
 * O ícone do cargo — a imagem que vai ao lado do nome de quem o tem.
 *
 * Duas escritas em sequência, e as duas podem falhar em lugares diferentes:
 * o arquivo sobe ao `autumn` pela tag `icons` (a única que
 * `File::use_role_icon` aceita) e o ID volta para `DataEditRole.icon`. Falhar
 * no upload e falhar ao prender o arquivo no cargo dão a MESMA frase na tela —
 * para quem administra, as duas são "o ícone não entrou".
 *
 * ⚠ **Salva na hora, sem esperar o "Salvar cargo".** O botão de baixo grava
 * nome, cor e permissões, que são rascunho até ele. O ícone não pode ser
 * rascunho: o arquivo já foi ao servidor de mídia no momento em que foi
 * escolhido, e segurá-lo até outro clique deixaria um anexo órfão cada vez que
 * alguém escolhe e desiste.
 *
 * ⚠ **Estado de erro JUNTO da caixa**, e não só toast: a caixa é o controle
 * que falhou, e a frase fica até a próxima tentativa — que é o que o toast de
 * erro que some sozinho já ensinou a não fazer.
 */
export function IconeDoCargo({
  serverId,
  cargo,
  podeEditar,
  aoMudar,
}: {
  serverId: string;
  cargo: Cargo;
  /** `ManageRole`. Sem ele a caixa mostra o ícone e nenhum botão. */
  podeEditar: boolean;
  aoMudar: () => void;
}) {
  const seletor = useRef<HTMLInputElement>(null);
  const [progresso, setProgresso] = useState<number | undefined>(undefined);
  const [erro, setErro] = useState<string | undefined>(undefined);
  /*
    A prévia LOCAL do que acabou de subir.

    O `ServerRoleUpdate` que traz a URL do servidor chega pelo socket, e até
    ele chegar a caixa voltaria vazia logo depois de dizer "enviado". Um
    `blob:` do próprio arquivo cobre esse intervalo com a imagem certa.
    `null` = tirado agora (esconde a URL velha até o evento), `undefined` = siga
    o que o cargo diz.
  */
  const [previa, setPrevia] = useState<string | null | undefined>(undefined);
  const temMidia = temServidorDeMidia();
  const enviando = progresso !== undefined;

  useEffect(
    () => () => {
      if (typeof previa === "string") URL.revokeObjectURL(previa);
    },
    [previa],
  );

  const url = previa === undefined ? cargo.iconeUrl : (previa ?? undefined);

  function enviar(arquivo: File) {
    setErro(undefined);
    setProgresso(0);
    void subirAnexo(arquivo, "icons", {
      aoProgredir: (f) => setProgresso(f),
    })
      .then((id) => definirIconeDoCargo(serverId, cargo.id, id))
      .then(() => {
        setPrevia(URL.createObjectURL(arquivo));
        aoMudar();
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : "Tente outra imagem.");
      })
      .finally(() => setProgresso(undefined));
  }

  function remover() {
    setErro(undefined);
    setProgresso(0);
    void definirIconeDoCargo(serverId, cargo.id, undefined)
      .then(() => {
        setPrevia(null);
        aoMudar();
      })
      .catch((e: unknown) => {
        setErro(e instanceof Error ? e.message : "Tente de novo.");
      })
      .finally(() => setProgresso(undefined));
  }

  return (
    <div>
      <p className={cargoCss.sobrancelha}>Ícone do cargo</p>
      <div className={cargoCss.icone}>
        {/*
          A caixa de 44 do design, e ela É o alvo de enviar — com o `+`
          tracejado vazia, com a imagem cheia. Sem permissão ela vira só a
          imagem: um alvo tracejado que não abre nada é o controle inerte que
          este projeto recusa.
        */}
        {podeEditar ? (
          <button
            type="button"
            className={cargoCss.iconeCaixa}
            data-cheia={url !== undefined}
            data-erro={erro !== undefined}
            aria-label={url ? "Trocar ícone do cargo" : "Enviar ícone do cargo"}
            aria-busy={enviando}
            disabled={enviando || !temMidia}
            onClick={() => seletor.current?.click()}
          >
            {url ? <img src={url} alt="" className={cargoCss.iconeImagem} /> : <Plus aria-hidden />}
            {enviando ? (
              <span
                className={cargoCss.iconeProgresso}
                style={{ inlineSize: `${String(Math.round((progresso ?? 0) * 100))}%` }}
                aria-hidden
              />
            ) : null}
          </button>
        ) : (
          <span className={cargoCss.iconeCaixa} data-cheia={url !== undefined}>
            {url ? <img src={url} alt={`Ícone de ${cargo.nome}`} className={cargoCss.iconeImagem} /> : null}
          </span>
        )}

        {podeEditar ? (
          <div className={cargoCss.iconeAcoes}>
            <Botao
              variante="neutro"
              disabled={!temMidia}
              carregando={enviando}
              rotuloCarregando="Enviando…"
              onClick={() => seletor.current?.click()}
            >
              Enviar imagem
            </Botao>
            <Botao variante="neutro" onClick={aindaNao("emojiComoIconeDeCargo")}>
              Usar emoji
            </Botao>
            {url !== undefined && !enviando ? (
              <Botao variante="sutil" onClick={remover}>
                Remover
              </Botao>
            ) : null}
          </div>
        ) : null}

        <input
          ref={seletor}
          type="file"
          /* PNG, JPG, WebP e GIF — o `autumn` aceita imagem na tag `icons` e
             recusa o resto com `FileTypeNotAllowed`. */
          accept="image/png,image/jpeg,image/webp,image/gif"
          className={cargoCss.seletor}
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            e.target.value = "";
            if (arquivo) enviar(arquivo);
          }}
        />
      </div>

      {/*
        O motivo de a caixa estar desligada, dito. Instância sem servidor de
        mídia é configuração válida — e um botão cinza sem explicação é o
        "acima da sua hierarquia" sem o motivo.
      */}
      {erro !== undefined ? (
        <p className={cargoCss.iconeErro} role="alert">
          Não deu para trocar o ícone. {erro}
        </p>
      ) : podeEditar && !temMidia ? (
        <p className={cargoCss.iconeRecado}>Este servidor não tem onde guardar imagens.</p>
      ) : null}
    </div>
  );
}
