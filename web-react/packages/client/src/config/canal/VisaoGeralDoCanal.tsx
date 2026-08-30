import { useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { Campo } from "../../components/ui/Campo";
import { Deslizante } from "../../components/ui/Deslizante";
import { aindaNao } from "../../pendente/pendencias";
import { salvarCanal } from "../../sdk/canal";
import { useChannel } from "../../store/hooks";
import secao from "../Secao.module.css";
import { MarcaDeOpcao } from "../../components/ui/Marcador";
import { Selo } from "../../components/ui/Selo";
import css from "./Canal.module.css";

/**
 * Visão geral do canal.
 *
 * ⚠ **Refeita contra o design RENDERIZADO (`pnpm espelho`), e a primeira
 * versão errava em estrutura, não em valor.** Eu tinha lido a lista de valores
 * do `pnpm espec` e montado o que parecia certo. Medido depois, três coisas
 * eram outra coisa:
 *
 * - **O assunto é uma CAIXA composta**, não um campo de uma linha: 680×152,
 *   com régua de markdown em cima (B·I·U·S·spoiler·emoji e "markdown ok"
 *   empurrado para a ponta) e `textarea` embaixo. Mesma anatomia do composer.
 * - **Bitrate e limite de usuários são DESLIZANTES**, não listas. Eu tinha
 *   posto quatro dropdowns; o design põe dois deslizantes e dois selects.
 * - **A voz é um cartão em `surface-1`** — um degrau ABAIXO do formulário. O
 *   afundamento é o que diz "isto só vale para canal de voz" sem gastar título.
 *
 * ⚠ **"MESMA PÁGINA" NÃO entra.** O design renderiza esse selo ao lado do
 * título da seção de voz, e ele é anotação de quem desenhou para quem lê o
 * arquivo — não um rótulo do produto. É a mesma classe de armadilha do
 * `hint-placeholder-val` que aparece no HTML: nem tudo que renderiza é
 * interface.
 *
 * O que é real e o que é desenho continua vindo de `DataEditChannel` — a
 * tabela está em `sdk/canal.ts`.
 */
export function VisaoGeralDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);

  const [nome, setNome] = useState(canal?.name ?? "");
  const [assunto, setAssunto] = useState(canal?.topico ?? "");
  const [idade, setIdade] = useState(false);
  const [limite, setLimite] = useState(8);
  const [salvando, setSalvando] = useState(false);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }

  const ehVoz = canal.tipo === "voz";
  const sujo = nome !== canal.name || assunto !== (canal.topico ?? "") || idade;

  /*
    O nome é normalizado ao DIGITAR, e a promessa está escrita embaixo do
    campo. Fazer no envio esconderia a regra: quem escreve "Meu Canal" precisa
    ver `meu-canal` aparecer, não descobrir depois de salvar.
  */
  const normalizar = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");

  return (
    /* 680 é a largura desta tela no design — ver `.forma.larga`. */
    <div
      className={`${secao.forma} ${secao.larga}`}
      style={{ "--vx-editor-w": "680px" } as React.CSSProperties}
    >
      <section className={secao.bloco}>
        <Campo
          rotulo="Nome do canal"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(normalizar(e.target.value))}
          dica="Minúsculas, sem espaços — hífens são convertidos automaticamente."
        />
      </section>

      <section className={secao.bloco}>
        {/* Rótulo e contador na MESMA linha — é onde o design os põe. */}
        <p className={css.rotuloComContador}>
          <span>Assunto do canal</span>
          <span className={css.contador}>{assunto.length} / 1024</span>
        </p>

        <div className={css.caixaDeTexto}>
          <div className={css.regua} role="toolbar" aria-label="Formatação">
            {/*
              Os quatro de formatação são REAIS: envolvem a seleção em
              markdown, que o caminho de leitura já entende desde
              `markdown/analisar.ts`. Spoiler e emoji dependem de coisas que
              não existem — spoiler não está no protocolo e o seletor de emoji
              não tem âncora fora do composer.
            */}
            <Formato rotulo="Negrito" marca="**" valor={assunto} aoAplicar={setAssunto}>
              B
            </Formato>
            <Formato rotulo="Itálico" marca="*" valor={assunto} aoAplicar={setAssunto}>
              I
            </Formato>
            <Formato rotulo="Sublinhado" marca="__" valor={assunto} aoAplicar={setAssunto}>
              U
            </Formato>
            <Formato rotulo="Riscado" marca="~~" valor={assunto} aoAplicar={setAssunto}>
              S
            </Formato>
            <span className={css.reguaDivisa} aria-hidden />
            <button
              type="button"
              className={css.reguaBotao}
              onClick={aindaNao("canalDeSpoiler")}
            >
              spoiler
            </button>
            <button
              type="button"
              className={css.reguaBotao}
              aria-label="Emoji"
              onClick={aindaNao("emoji")}
            >
              🙂
            </button>
            <span className={css.reguaDica}>markdown ok</span>
          </div>

          <textarea
            className={css.areaDeTexto}
            aria-label="Assunto do canal"
            disabled={salvando}
            value={assunto}
            maxLength={1024}
            onChange={(e) => setAssunto(e.target.value)}
          />
        </div>
      </section>

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Modo lento</h2>
        {/* Mostra o valor REAL; mudar é pendente porque `slowmode` não está em
            `DataEditChannel`. Ver `sdk/canal.ts`. */}
        <button
          type="button"
          className={css.pendente}
          onClick={aindaNao("modoLento")}
        >
          {canal.modoLentoSegundos > 0
            ? `${canal.modoLentoSegundos} segundos`
            : "Desativado"}
        </button>
        <p className={secao.recado}>
          Membros com &ldquo;Gerenciar mensagens&rdquo; ou &ldquo;Gerenciar
          canais&rdquo; ignoram o modo lento.
        </p>
      </section>

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Visibilidade do conteúdo</h2>
        <Opcao
          marcada={!idade}
          titulo="Padrão"
          detalhe="Sem aviso; mídia carrega direto."
          aoMarcar={() => setIdade(false)}
        />
        <Opcao
          marcada={false}
          titulo="Canal de spoiler"
          detalhe="Toda mídia entra borrada, com clique para revelar."
          aoMarcar={aindaNao("canalDeSpoiler")}
        />
        <Opcao
          marcada={idade}
          titulo="Restrição de idade"
          selo="+18"
          detalhe="Exige confirmação na entrada; some da prévia de convite."
          aoMarcar={() => setIdade(true)}
        />
      </section>

      {ehVoz ? (
        <section className={css.cartaoDeVoz}>
          <h2 className={css.vozTitulo}>Quando o canal é de voz</h2>
          <div className={css.vozGrade}>
            {/*
              Deslizante de verdade, com o valor do design — mas quem MUDA é
              pendente: bitrate não existe no protocolo. Mostrar o controle
              vivo e o valor fixo é o mesmo trato do modo lento.
            */}
            <CampoDeslizante rotulo="Bitrate" valor="64 kbps">
              <Deslizante
                id="bitrate-de-voz"
                rotulo="Bitrate"
                min={8}
                max={128}
                passo={8}
                valor={64}
                texto="64 kbps"
                aoMudar={aindaNao("bitrateDeVoz")}
              />
            </CampoDeslizante>
            {/* O único dos quatro que o protocolo aceita. */}
            <CampoDeslizante
              rotulo="Limite de usuários"
              valor={limite === 0 ? "Sem limite" : String(limite)}
            >
              <Deslizante
                id="limite-de-usuarios"
                rotulo="Limite de usuários"
                min={0}
                max={99}
                passo={1}
                valor={limite}
                texto={limite === 0 ? "Sem limite" : String(limite)}
                aoMudar={setLimite}
              />
            </CampoDeslizante>
            <PendenteEscolha
              rotulo="Região de voz"
              valor="Automática"
              id="regiaoDeVoz"
            />
            <PendenteEscolha
              rotulo="Modo de vídeo"
              valor="Automático"
              id="modoDeVideo"
            />
          </div>
        </section>
      ) : null}

      {sujo ? (
        <div className={css.faixa} role="status">
          <span>Você tem alterações não salvas.</span>
          <div className={css.faixaAcoes}>
            <Botao
              variante="sutil"
              disabled={salvando}
              onClick={() => {
                setNome(canal.name);
                setAssunto(canal.topico ?? "");
                setIdade(false);
              }}
            >
              Descartar
            </Botao>
            <Botao
              variante="primario"
              disabled={salvando || nome.trim() === ""}
              onClick={() => {
                setSalvando(true);
                void salvarCanal(channelId, {
                  nome: nome.trim(),
                  assunto,
                  restritoPorIdade: idade,
                  limiteDeUsuarios: ehVoz ? limite : undefined,
                }).finally(() => setSalvando(false));
              }}
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Um botão da régua que envolve o texto inteiro na marca de markdown.
 *
 * ⚠ Envolve TUDO e não a seleção, e a diferença é honesta: sem uma referência
 * ao `textarea` não há seleção para ler, e passá-la por props só para isto
 * amarraria a régua ao campo. O assunto é uma frase; envolver a frase é o caso
 * comum. A régua do editor de mensagem, que tem o `ref`, envolve a seleção.
 */
function Formato({
  rotulo,
  marca,
  valor,
  aoAplicar,
  children,
}: {
  rotulo: string;
  marca: string;
  valor: string;
  aoAplicar: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={css.reguaBotao}
      aria-label={rotulo}
      onClick={() => aoAplicar(`${marca}${valor}${marca}`)}
    >
      {children}
    </button>
  );
}

/**
 * Uma opção de rádio com título, selo e explicação.
 *
 * `role="radio"` num `button` e não um `<input type="radio">`: o nativo é
 * desenhado pelo sistema, e o lint do projeto reprova controle nativo em
 * superfície de produto desde a auditoria da fase 4.
 */
function Opcao({
  marcada,
  titulo,
  selo,
  detalhe,
  aoMarcar,
}: {
  marcada: boolean;
  titulo: string;
  selo?: string;
  detalhe: string;
  aoMarcar: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      className={css.opcao}
      onClick={aoMarcar}
    >
      <MarcaDeOpcao className={css.marca} />
      <span className={css.opcaoTexto}>
        <span className={css.opcaoTitulo}>
          {titulo}
          {selo ? (
            <Selo tom="perigoSuave" className={css.selo}>
              {selo}
            </Selo>
          ) : null}
        </span>
        <span className={css.opcaoDetalhe}>{detalhe}</span>
      </span>
    </button>
  );
}

/** Rótulo à esquerda, valor à direita, trilho embaixo — a linha do design. */
function CampoDeslizante({
  rotulo,
  valor,
  children,
}: {
  rotulo: string;
  valor: string;
  children: React.ReactNode;
}) {
  return (
    <div className={css.deslizanteCampo}>
      <span className={css.deslizanteTopo}>
        <span>{rotulo}</span>
        <span className={css.deslizanteValor}>{valor}</span>
      </span>
      {children}
    </div>
  );
}

/** A cara de uma `Escolha` sobre algo que o protocolo não tem. */
function PendenteEscolha({
  rotulo,
  valor,
  id,
}: {
  rotulo: string;
  valor: string;
  id: Parameters<typeof aindaNao>[0];
}) {
  return (
    <div className={css.selecao}>
      <span className={css.rotuloLeve}>{rotulo}</span>
      <button type="button" className={css.pendente} onClick={aindaNao(id)}>
        {valor}
      </button>
    </div>
  );
}
