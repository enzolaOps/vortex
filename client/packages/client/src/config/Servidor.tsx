import { useEffect, useRef, useState, type DragEvent } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Selo } from "../components/ui/Selo";
import { SeletorDeCor } from "../components/ui/SeletorDeCor";
import { X } from "../components/ui/icones";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { sigla } from "../lib/sigla";
import { aindaNao } from "../pendente/pendencias";
import {
  subirAnexo,
  temServidorDeMidia,
  tetoDeUploadTexto,
} from "../sdk/anexos";
import {
  salvarServidor,
  TAG_DA_IMAGEM,
  trocarImagemDoServidor,
  type ImagemDoServidor,
} from "../sdk/servidores";
import { toast } from "../components/ui/toastStore";
import { definirBarraDeSalvar } from "../store/barraDeSalvar";
import { useMembrosDoServidor, useServer } from "../store/hooks";
import css from "./Servidor.module.css";
import secao from "./Secao.module.css";

/**
 * As cinco faixas do card de convite.
 *
 * ⚠ **São GRADIENTES, e eu tinha escrito cinco cores chapadas.** Medido nas
 * duas telas lado a lado: a referência pinta `linear-gradient(120deg, A, B)`, e
 * o design escreve os cinco pares byte a byte. A diferença não é sutil — uma
 * faixa de 104px chapada lê como um retângulo de tinta, e é justamente ela que
 * ocupa o terço de cima do cartão que a pessoa vê antes de decidir entrar.
 *
 * A física é a mesma dos gradientes de avatar: o segundo ponto perde
 * luminosidade E croma. Aqui as famílias são as do design e não as curadas do
 * `lib/gradiente` — aquelas identificam PESSOA numa lista, estas são escolha
 * de quem administra o servidor.
 */
const FAIXAS = [
  { de: "#2FA8B4", ate: "#1E7F92" },
  { de: "#8B7BE8", ate: "#4A3F6B" },
  { de: "#E2B15C", ate: "#8A6428" },
  { de: "#E8596B", ate: "#7E2733" },
  { de: "#2E3540", ate: "#171C22" },
] as const;

/**
 * A pintura de uma faixa.
 *
 * ⚠ **Uma função só, e ela cobre os dois casos** — a faixa escolhida da lista
 * é uma RAMPA, a escolhida no seletor do sistema é um PONTO. A primeira versão
 * decidia isso na árvore com um `find` e um `some` sobre a mesma lista, e
 * escreveu `style` vazio: os dois ramos caíram em `undefined` ao mesmo tempo e
 * o cartão apareceu sem faixa nenhuma. Nada falhou, e só a medição no
 * navegador mostrou (`backgroundImage: none` num elemento de 104px).
 */
function pintura(f: Faixa): string {
  return f.ate === undefined
    ? f.de
    : `linear-gradient(120deg, ${f.de}, ${f.ate})`;
}

type Faixa = { readonly de: string; readonly ate?: string };

/**
 * As características de exemplo.
 *
 * ⚠ **Elas NÃO são estado guardado, e a distinção importa.** O protocolo do
 * Stoat não tem características de servidor — não há campo, rota nem evento.
 * Mostrá-las vazias faria a tela parecer quebrada; mostrá-las guardando faria
 * a tela mentir. Ficam como exemplo, e o controle diz o que fará.
 */
const CARACTERISTICAS = ["🛠 produto", "🎨 design", "💬 open source"] as const;

const NUMERO = new Intl.NumberFormat("pt-BR");

/** Os tipos que o `autumn` sabe redimensionar para ícone e banner. */
const ACEITA = "image/png,image/jpeg,image/gif,image/webp";

/**
 * Trocar e remover uma das duas imagens do servidor.
 *
 * ⚠ **A troca é IMEDIATA, fora da barra de salvar**, e é a mesma decisão de
 * `GerenciarGrupo`: escolher um arquivo JÁ é a intenção inteira, e prendê-lo
 * atrás de "Salvar" obrigaria a faixa a guardar um `File` e a acender
 * "alterações não salvas" por um upload que já aconteceu — o `autumn` guardou
 * o arquivo no instante do envio, e descartar a faixa não o desfaria.
 *
 * A prévia local ganha do servidor enquanto o envio está em voo: quem acabou
 * de escolher precisa ver a imagem, e o snapshot só troca quando o
 * `ServerUpdate` dá a volta. Falhou → a prévia some, porque mostrar uma imagem
 * que não colou é pior que mostrar a antiga.
 *
 * ⚠ **Sem recorte, e a ausência é das duas fontes.** Nem a referência nem o
 * design desenham um passo de recorte; o ladrilho e a faixa mostram a imagem
 * em `object-fit: cover`, centrada — que é o recorte que todo cliente aplica
 * ao ler, e a prévia mostra exatamente ele.
 */
function useImagemDoServidor(
  serverId: string,
  qual: ImagemDoServidor,
  /** O que o snapshot do servidor diz hoje. */
  doServidor: string | undefined,
) {
  const [previa, setPrevia] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<"parado" | "subindo" | "removendo">(
    "parado",
  );
  /*
    A URL que acabou de ser removida, e não um booleano.

    O servidor responde "removido" antes de o `ServerUpdate` republicar o
    snapshot; sem isto a imagem antiga voltaria até ele chegar. Guardar QUAL
    foi removida, e não "foi removida", é o que deixa uma imagem NOVA posta por
    outra pessoa aparecer — um booleano a esconderia até a tela ser reaberta.
  */
  const [removida, setRemovida] = useState<string | undefined>(undefined);

  /* Cada `createObjectURL` prende o arquivo na memória da aba até ser
     revogado — o erro nº 5 do briefing, numa tela que se reabre. */
  useEffect(() => {
    return () => {
      if (previa !== undefined) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  const nome = qual === "icone" ? "ícone" : "banner";

  function escolher(arquivo: File) {
    if (!arquivo.type.startsWith("image/")) {
      toast({
        tipo: "erro",
        titulo: "Isso não é uma imagem.",
        descricao: "Use PNG, JPG, GIF ou WebP.",
      });
      return;
    }
    setPrevia(URL.createObjectURL(arquivo));
    setRemovida(undefined);
    setEstado("subindo");
    void subirAnexo(arquivo, TAG_DA_IMAGEM[qual])
      .then((id) => trocarImagemDoServidor(serverId, qual, id))
      .then((colou) => {
        if (!colou) setPrevia(undefined);
      })
      .catch((e: unknown) => {
        setPrevia(undefined);
        toast({
          tipo: "erro",
          titulo: `Não deu para enviar o ${nome}.`,
          descricao: e instanceof Error ? e.message : "Tente outra imagem.",
        });
      })
      .finally(() => setEstado("parado"));
  }

  function remover() {
    const antes = doServidor;
    setEstado("removendo");
    void trocarImagemDoServidor(serverId, qual, undefined)
      .then((ok) => {
        if (!ok) return;
        setPrevia(undefined);
        setRemovida(antes);
      })
      .finally(() => setEstado("parado"));
  }

  /* A prévia local primeiro; depois o servidor, menos o que acabou de sair. */
  const url =
    previa ??
    (doServidor !== undefined && doServidor === removida ? undefined : doServidor);

  return { url, estado, escolher, remover };
}

/**
 * Perfil do servidor — o formulário e o cartão de convite ao vivo.
 *
 * ⚠ **Ela era nome + descrição num campo de uma linha, e o resto não existia.**
 * A referência põe aqui SEIS blocos e uma prévia; a versão anterior tinha dois
 * campos e um botão de salvar. Comparadas lado a lado com as duas telas
 * abertas, não eram a mesma página — eram páginas diferentes com o mesmo
 * título.
 *
 * O que é real: nome e descrição, os dois em `Server.edit`. O que é desenho
 * registrado: ícone, faixa, banner e características — os dois primeiros
 * porque dependem de upload para o servidor de mídia (o campo existe no
 * protocolo), os dois últimos porque o conceito não existe.
 *
 * ⚠ **Não há botão "Salvar" no formulário.** Quem salva é a faixa do rodapé do
 * pane, publicada daqui — ver `store/barraDeSalvar.ts`. Ter os dois daria dois
 * caminhos para a mesma escrita, e o segundo a ganhar um estado novo seria o
 * que ninguém abriu naquela semana.
 */
export function Servidor({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  const membros = useMembrosDoServidor(serverId);
  const icone = useImagemDoServidor(serverId, "icone", servidor?.avatarUrl);
  const banner = useImagemDoServidor(serverId, "banner", servidor?.bannerUrl);
  const seletorDeIcone = useRef<HTMLInputElement>(null);
  const seletorDeBanner = useRef<HTMLInputElement>(null);
  const [sobreOBanner, setSobreOBanner] = useState(false);
  const temMidia = temServidorDeMidia();

  const nomeSalvo = servidor?.name ?? "";
  const descricaoSalva = servidor?.descricao ?? "";

  const [nome, setNome] = useState(nomeSalvo);
  const [descricao, setDescricao] = useState(descricaoSalva);
  const [faixa, setFaixa] = useState<Faixa>(FAIXAS[0]);
  const [salvando, setSalvando] = useState(false);

  const sujo = nome !== nomeSalvo || descricao !== descricaoSalva;

  /*
    A página publica; a casca desenha. Ver `BarraDeSalvar`.

    ⚠ A faixa não conhece `faixa` (a cor): ela é pendente e não vai ao
    servidor, então marcá-la não pode acender "você tem alterações não salvas"
    — a frase seria falsa, e o botão salvaria o que já estava salvo.
  */
  useEffect(() => {
    if (!sujo) {
      definirBarraDeSalvar(undefined);
      return;
    }
    definirBarraDeSalvar({
      salvando,
      aoDescartar: () => {
        setNome(nomeSalvo);
        setDescricao(descricaoSalva);
      },
      aoSalvar: () => {
        if (nome.trim() === "") return;
        setSalvando(true);
        void salvarServidor(serverId, nome.trim(), descricao.trim()).finally(
          () => setSalvando(false),
        );
      },
    });
  }, [sujo, salvando, nome, descricao, nomeSalvo, descricaoSalva, serverId]);

  useEffect(() => () => definirBarraDeSalvar(undefined), []);

  if (!serverId) {
    return <p className={secao.recado}>Abra um servidor para ver isto.</p>;
  }

  const inicial = sigla(nome || "?");
  const gradiente = gradienteDe(serverId);
  const corDoTexto = corDoTextoDe(serverId);

  const iconeUrl = icone.url;
  const bannerUrl = banner.url;
  const tetoDoIcone = tetoDeUploadTexto("icons");

  function soltarBanner(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    setSobreOBanner(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo && temMidia) banner.escolher(arquivo);
  }

  return (
    <div className={css.par}>
      <div className={css.formulario}>
        <Campo
          rotulo="Nome do servidor"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        {/* ------------------------------------------------ ícone */}
        <div>
          <p className={css.sobrancelha}>Ícone</p>
          <div className={css.icone}>
            <span
              aria-hidden
              className={css.ladrilho}
              style={{ backgroundImage: gradiente, color: corDoTexto }}
            >
              {inicial}
              {/* A imagem COBRE o gradiente, como no `Avatar`: enquanto ela
                  carrega, o ladrilho mostra a identidade de sempre. */}
              {iconeUrl !== undefined ? (
                <img className={css.imagemDoLadrilho} src={iconeUrl} alt="" />
              ) : null}
            </span>
            <div className={css.iconeTextos}>
              <div className={css.iconeAcoes}>
                <Botao
                  variante="neutro"
                  disabled={!temMidia || icone.estado === "removendo"}
                  carregando={icone.estado === "subindo"}
                  rotuloCarregando="Enviando"
                  onClick={() => seletorDeIcone.current?.click()}
                >
                  Enviar imagem
                </Botao>
                <Botao
                  variante="perigoSutil"
                  disabled={iconeUrl === undefined || icone.estado === "subindo"}
                  carregando={icone.estado === "removendo"}
                  rotuloCarregando="Removendo"
                  onClick={icone.remover}
                >
                  Remover
                </Botao>
              </div>
              {/*
                ⚠ **O teto é o do SERVIDOR, e o design escreve "até 8 MB".** O
                default do `autumn` para `icons` é 2,5 MB; prometer o triplo é
                garantir a recusa. Ver `tetoDeUploadTexto`.
              */}
              <span className={css.pista}>
                {temMidia
                  ? `Recomendado 512×512 · PNG, JPG ou GIF${tetoDoIcone ? ` até ${tetoDoIcone}` : ""}`
                  : "Este servidor não tem onde guardar imagens."}
              </span>
            </div>
            {/* O `input` do sistema, escondido — mesma razão do composer. */}
            <input
              ref={seletorDeIcone}
              type="file"
              accept={ACEITA}
              className={css.seletor}
              tabIndex={-1}
              aria-hidden
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) icone.escolher(arquivo);
              }}
            />
          </div>
        </div>

        {/* --------------------------------- faixa do card de convite */}
        <div>
          <p className={css.sobrancelha}>Faixa do card de convite</p>
          <div
            className={css.amostras}
            role="radiogroup"
            aria-label="Faixa do card de convite"
          >
            {FAIXAS.map((f) => (
              <button
                key={f.de}
                type="button"
                role="radio"
                aria-checked={faixa.de === f.de && faixa.ate === f.ate}
                aria-label={`Faixa ${f.de}`}
                className={css.amostra}
                style={{ backgroundImage: pintura(f) }}
                onClick={() => setFaixa(f)}
              />
            ))}

            {/*
              A cor livre, atrás do `+` tracejado — como na referência.

              ⚠ `SeletorDeCor` e não `<input type="color">` cru: o lint confina
              o input nativo a `components/ui`, e a razão está escrita lá — o
              que ele abre é o seletor do SISTEMA, que nenhuma biblioteca
              resolve melhor. Ela vira faixa CHAPADA, e é a diferença honesta:
              o seletor entrega um ponto, não uma rampa.
            */}
            <SeletorDeCor
              id="faixa-do-convite"
              rotulo="Faixa personalizada"
              forma="vaga"
              valor={faixa.de}
              aoMudar={(hex) => setFaixa({ de: hex })}
            />

            {/*
              ⚠ **O rótulo mostra o PRIMEIRO PONTO da faixa, e o design mostra
              `#35C2CC` fixo.** A faixa teal dele começa em `#2FA8B4`, ou seja
              o número escrito ali não é o número pintado ao lado. Um valor que
              não confere com o que está na tela é pior que valor nenhum — é a
              família do comentário que afirma uma medida que não existe.
            */}
            <span className={css.hex}>{faixa.de.toUpperCase()}</span>
          </div>
        </div>

        {/* ------------------------------------------------ banner */}
        <div>
          <p className={css.sobrancelha}>Banner / splash de convite</p>
          {/*
            A área de envio mostra o banner que JÁ está no servidor — é a
            promessa de `ServerSnapshot.bannerUrl`, e um retângulo tracejado
            dizendo "arraste" sobre um banner que existe mentiria sobre ele.
          */}
          <button
            type="button"
            className={css.dropzone}
            data-sobre={sobreOBanner || undefined}
            data-com-imagem={bannerUrl !== undefined || undefined}
            aria-busy={banner.estado === "subindo" || undefined}
            disabled={!temMidia || banner.estado !== "parado"}
            onClick={() => seletorDeBanner.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setSobreOBanner(true);
            }}
            onDragLeave={() => setSobreOBanner(false)}
            onDrop={soltarBanner}
          >
            {bannerUrl !== undefined ? (
              <img className={css.imagemDoBanner} src={bannerUrl} alt="" />
            ) : null}
            <span className={css.dropzoneMedida}>
              {banner.estado === "subindo"
                ? "enviando o banner…"
                : bannerUrl !== undefined
                  ? "arraste outro banner · 1920×480"
                  : "arraste o banner · 1920×480"}
            </span>
            <span className={css.dropzoneGesto}>
              {temMidia
                ? "ou clique para enviar"
                : "este servidor não tem onde guardar imagens"}
            </span>
          </button>
          <input
            ref={seletorDeBanner}
            type="file"
            accept={ACEITA}
            className={css.seletor}
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              e.target.value = "";
              if (arquivo) banner.escolher(arquivo);
            }}
          />
          {bannerUrl !== undefined ? (
            <Botao
              variante="perigoSutil"
              tamanho="pequeno"
              className={css.removerBanner}
              disabled={banner.estado === "subindo"}
              carregando={banner.estado === "removendo"}
              rotuloCarregando="Removendo"
              onClick={banner.remover}
            >
              Remover banner
            </Botao>
          ) : null}
        </div>

        {/* ---------------------------------------------- descrição */}
        <div>
          {/*
            O contador na outra ponta do rótulo, como a referência.

            ⚠ **300 é o teto do PROTOCOLO** (`Server.description`), e por isso
            o número é verdade e não decoração: passar dele faz a escrita
            falhar, e o contador é o único lugar da tela que avisa antes.
          */}
          <div className={css.linhaDoRotulo}>
            <label className={css.sobrancelha} htmlFor="descricao-do-servidor">
              Descrição
            </label>
            <span className={css.contador}>{descricao.length} / 300</span>
          </div>
          <textarea
            id="descricao-do-servidor"
            className={css.area}
            maxLength={300}
            rows={3}
            disabled={salvando}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        {/* ----------------------------------------- características */}
        <div>
          <p className={css.sobrancelha}>Características · até 5</p>
          <div className={css.caracteristicas}>
            {CARACTERISTICAS.map((c) => (
              <span key={c} className={css.caracteristica}>
                {c}
                <button
                  type="button"
                  className={css.tirar}
                  aria-label={`Tirar ${c}`}
                  onClick={aindaNao("caracteristicasDoServidor")}
                >
                  <X size={11} aria-hidden />
                </button>
              </span>
            ))}
            <button
              type="button"
              className={css.acrescentar}
              onClick={aindaNao("caracteristicasDoServidor")}
            >
              ＋ adicionar
            </button>
          </div>
        </div>
      </div>

      {/* =============================================== prévia ao vivo */}
      <div className={css.previa}>
        <p className={css.sobrancelha}>Prévia ao vivo</p>
        <div className={css.cartao}>
          {/*
            Com banner, a faixa É o banner — é assim que a landing de convite
            (`AdicionarServidor`) o desenha, e a prévia não pode divergir do
            card que quem recebe o convite vê.
          */}
          <div
            className={css.faixaDoCartao}
            style={{ background: pintura(faixa) }}
          >
            {bannerUrl !== undefined ? (
              <img className={css.imagemDoBanner} src={bannerUrl} alt="" />
            ) : null}
          </div>
          <div className={css.corpoDoCartao}>
            <span
              aria-hidden
              className={css.iconeDoCartao}
              style={{ backgroundImage: gradiente, color: corDoTexto }}
            >
              {inicial}
              {iconeUrl !== undefined ? (
                <img className={css.imagemDoLadrilho} src={iconeUrl} alt="" />
              ) : null}
            </span>
            <div className={css.linhaDoNome}>
              <span className={css.nomeDoCartao}>{nome || "Servidor"}</span>
              {/*
                A SIGLA, e não a tag do servidor.

                ⚠ A tag é campo configurável do protocolo — tem página própria
                no design — e não existe aqui. A sigla é derivada do nome e é
                verdade sobre ele; quando a tag existir, substitui sem mexer
                no layout.
              */}
              <Selo tom="acento">{inicial}</Selo>
            </div>
            {descricao ? (
              <p className={css.descricaoDoCartao}>{descricao}</p>
            ) : null}
            <div className={css.chipsDoCartao}>
              {CARACTERISTICAS.map((c) => (
                <span key={c} className={css.chip}>
                  {c}
                </span>
              ))}
            </div>
            {/*
              ⚠ **Só a contagem de membros, e ela é a que o cliente SABE.** O
              design mostra "142 online" ao lado; a presença que este cliente
              conhece é a de quem ele já viu, não a do servidor inteiro — o
              mesmo motivo pelo qual a página de Membros não traz a linha de
              online. Número inventado numa prévia de convite é pior que
              número ausente: ele é exatamente o que quem entra vai conferir.
            */}
            <div className={css.metaDoCartao}>
              <span className={css.metaItem}>
                <span aria-hidden className={css.ponto} />
                {NUMERO.format(membros.length)} membros
              </span>
            </div>
            {/*
              A data de criação sai do ULID, pelo `createdAt` do SDK — é
              informação real do servidor, não enfeite do cartão: num convite
              ela é o que separa uma comunidade de dois anos de uma criada
              hoje à tarde para uma divulgação.
            */}
            <p className={css.criadoEm}>Criado em {servidor?.criadoEmTexto}</p>
            {/*
              ⚠ **Figura do botão, e não alvo.** A referência renderiza o mesmo
              card da página de convite e o deixa sem ação aqui; e entrar num
              servidor onde você já está não é ação nenhuma. Um botão que
              recebe foco e clique para dizer "não faz nada" é o alvo inerte
              que o registro de pendências existia para marcar — `inert` tira
              o botão do foco, do clique e da árvore de acessibilidade, e o
              que sobra é o que isto é: a prévia de como o card aparece para
              quem recebe o convite.
            */}
            <Botao
              variante="primario"
              className={css.entrar}
              inert
              tabIndex={-1}
            >
              Entrar no servidor
            </Botao>
          </div>
        </div>
        <p className={css.notaDaPrevia}>
          A prévia usa os mesmos tokens do card real: faixa em 104 px, ícone
          sobreposto em −26 e a descrição truncada em 3 linhas quando passar de
          160 caracteres.
        </p>
      </div>
    </div>
  );
}
