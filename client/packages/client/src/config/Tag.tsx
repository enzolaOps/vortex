import { useEffect, useRef, useState } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import { temServidorDeMidia } from "../sdk/anexos";
import {
  enviarEmblemaDaTag,
  removerEmblemaDaTag,
  salvarTagDoServidor,
} from "../sdk/perfilDoServidor";
import { definirBarraDeSalvar } from "../store/barraDeSalvar";
import { usePerfilDoServidor } from "../store/perfilDoServidor";
import { CartaoDeAjustes, LinhaDeAjuste } from "./Pagina";
import css from "./Tag.module.css";

/**
 * Tag do servidor — o identificador curto ao lado do nome de quem a exibe.
 *
 * **Real, e do fork do serviço `api`:** `Server.tag` (2 a 4 caracteres, A-Z e
 * 0-9, validado no servidor), `Server.tag_badge` (um arquivo na tag `icons` do
 * servidor de mídia — o `autumn` não precisou mudar) e `Member.show_tag`, que
 * cada pessoa liga pelo menu do servidor na coluna de canais.
 *
 * ⚠ **"Exigir cargo para exibir" segue pendente.** O fork não guarda qual
 * cargo a tag exige; o interruptor mostra o estado verdadeiro de hoje
 * (desligado — qualquer membro pode exibir) e diz o que falta.
 *
 * ⚠ **Não confundir com a SIGLA do rail.** A sigla é derivada do nome; a tag é
 * escolha de quem administra. Onde há tag, ela substitui a sigla ao lado do
 * nome do servidor.
 *
 * A prévia à direita não é decoração: a tag aparece em três superfícies com
 * pesos diferentes, e escolher quatro caracteres sem ver onde eles caem é
 * como escolher cor sem ver o fundo.
 */
export function Tag({ serverId }: { serverId: string }) {
  const perfil = usePerfilDoServidor(serverId);
  const salva = perfil.tag ?? "";
  /*
    A edição guarda SOBRE QUAL valor salvo ela foi feita. A tag chega do
    servidor depois de a página montar (e muda por evento); um `useState(salva)`
    congelaria o vazio do primeiro quadro e acenderia "alterações não salvas"
    sem ninguém ter digitado.
  */
  const [edicao, setEdicao] = useState<
    { readonly base: string; readonly valor: string } | undefined
  >(undefined);
  const tag = edicao?.base === salva ? edicao.valor : salva;
  const setTag = (valor: string) => setEdicao({ base: salva, valor });
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const seletor = useRef<HTMLInputElement>(null);
  const temMidia = temServidorDeMidia();

  const sujo = tag !== salva;
  /* 1 caractere não é tag e não é ausência: a barra não oferece salvar. */
  const invalida = tag.length === 1;

  /*
    A página publica; a casca desenha. Mesma forma de `Servidor.tsx` — ter um
    botão de salvar aqui E a barra seriam dois caminhos para a mesma escrita.
  */
  useEffect(() => {
    if (!sujo) {
      definirBarraDeSalvar(undefined);
      return;
    }
    definirBarraDeSalvar({
      salvando,
      aoDescartar: () => setEdicao(undefined),
      aoSalvar: () => {
        if (invalida) return;
        setSalvando(true);
        void salvarTagDoServidor(serverId, tag === "" ? undefined : tag).finally(() =>
          setSalvando(false),
        );
      },
    });
  }, [sujo, salvando, tag, salva, invalida, serverId]);

  useEffect(() => () => definirBarraDeSalvar(undefined), []);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  const exemplo = tag || "VTX";

  return (
    <div className={css.tela}>
      <div className={css.coluna}>
        {/*
          O wrapper carrega a classe porque o `Campo` escreve a própria
          `className` no `input` DEPOIS do espalhamento — passada a ele, ela
          sumia em silêncio e o campo media 520.
        */}
        <div className={css.campoDaTag}>
        <Campo
          rotulo="Tag"
          dica="2 a 4 caracteres · letras e números · sem espaços"
          erro={invalida ? "A tag precisa de pelo menos 2 caracteres." : undefined}
          value={tag}
          disabled={salvando}
          /*
            A limpeza acontece na ENTRADA e não na validação: um campo que
            aceita espaço e depois reclama ensina o erro duas vezes. Aqui o
            caractere inválido simplesmente não entra, que é como o campo se
            explica sozinho. O servidor recusa o que escapar disto.
          */
          onChange={(e) =>
            setTag(
              e.currentTarget.value
                .replace(/[^a-zA-Z0-9]/g, "")
                .slice(0, 4)
                .toUpperCase(),
            )
          }
          autoComplete="off"
          spellCheck={false}
        />
        </div>

        <div>
          <p className={css.sobrancelha}>Emblema</p>
          <div className={css.emblema}>
            {perfil.emblemaUrl !== undefined ? (
              <img
                src={perfil.emblemaUrl}
                alt="Emblema da tag"
                className={css.emblemaImagem}
              />
            ) : (
              <span aria-hidden className={css.emblemaVazio} />
            )}
            {/*
              Sem servidor de mídia não há onde guardar a imagem: o botão some
              em vez de falhar contra uma URL vazia — a regra de `anexos.ts`.
            */}
            {temMidia ? (
              <Botao
                variante="neutro"
                disabled={enviando}
                onClick={() => seletor.current?.click()}
              >
                {enviando
                  ? "Enviando…"
                  : perfil.emblemaUrl !== undefined
                    ? "Trocar emblema"
                    : "Enviar emblema"}
              </Botao>
            ) : (
              <span className={css.recado}>Este servidor não guarda imagens.</span>
            )}
            {perfil.emblemaUrl !== undefined ? (
              <Botao
                variante="perigoSutil"
                disabled={enviando}
                onClick={() => {
                  setEnviando(true);
                  void removerEmblemaDaTag(serverId).finally(() => setEnviando(false));
                }}
              >
                Remover
              </Botao>
            ) : null}
            {/* Escondido e acionado pelo botão, como o ícone em Adicionar servidor. */}
            <input
              ref={seletor}
              type="file"
              accept="image/*"
              className={css.seletorDeArquivo}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (!arquivo) return;
                setEnviando(true);
                void enviarEmblemaDaTag(serverId, arquivo).finally(() =>
                  setEnviando(false),
                );
              }}
            />
          </div>
        </div>

        <CartaoDeAjustes>
          <LinhaDeAjuste
            titulo="Exigir cargo para exibir"
            detalhe="Só membros com o cargo escolhido podem usar a tag."
          >
            <Interruptor
              rotulo="Exigir cargo para exibir"
              ligado={false}
              aoAlternar={aindaNao("exigirCargoDaTag")}
            />
          </LinhaDeAjuste>
        </CartaoDeAjustes>
      </div>

      {/*
        Onde a tag aparece — as três superfícies, com o peso de cada uma.

        ⚠ **Reproduz os componentes reais, não desenhos deles.** `Avatar` e
        `Selo` são os mesmos que a member list e a timeline usam, então uma
        troca de token aparece aqui junto.
      */}
      <aside className={css.previa}>
        <p className={css.sobrancelha}>Onde a tag aparece</p>

        <div className={css.previaCaixa}>
          <div>
            <p className={css.previaRotulo}>Na timeline</p>
            <div className={css.previaLinha}>
              <span className={css.autor}>Marina</span>
              <Selo tom="acento">{exemplo}</Selo>
              <span className={css.hora}>14:02</span>
            </div>
            <p className={css.corpo}>Fechamos o escopo do rail.</p>
          </div>

          <div className={css.previaBloco}>
            <p className={css.previaRotulo}>Na lista de membros</p>
            <div className={css.previaLinhaCentrada}>
              <Avatar id="previa-marina" sigla="M" />
              <span className={css.nomeDeMembro}>Marina</span>
              <Selo tom="acento">{exemplo}</Selo>
            </div>
          </div>

          <div className={css.previaBloco}>
            <p className={css.previaRotulo}>No perfil</p>
            <div className={css.previaLinhaCentrada}>
              <span className={css.nomeDePerfil}>Marina Alcântara</span>
              <Selo tom="acento">{exemplo}</Selo>
            </div>
          </div>
        </div>

        <p className={css.nota}>
          A tag usa a fonte mono em 10px sobre acento a 16% — nunca a cor do
          cargo, para não competir com a hierarquia. Cada membro liga a própria
          tag no menu do servidor.
        </p>
      </aside>
    </div>
  );
}
