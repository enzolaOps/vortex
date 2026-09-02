import { useState } from "react";

import { CaretDown, ICONE } from "../../components/ui/icones";

import { Botao } from "../../components/ui/Botao";
import { Campo } from "../../components/ui/Campo";
import { Deslizante } from "../../components/ui/Deslizante";
import { aindaNao } from "../../pendente/pendencias";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui/Popover";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../../components/ui/DropdownMenu";
import { SeletorDeEmoji } from "../../seletores/SeletorDeEmoji";
import { salvarCanal } from "../../sdk/canal";
import { useChannel } from "../../store/hooks";
import secao from "../Secao.module.css";
import { CartaoDeOpcao } from "../../components/ui/CartaoDeOpcao";
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
/**
 * Os degraus de modo lento, em segundos.
 *
 * ⚠ **Param em 6 h porque é o TETO do protocolo** — o validador do servidor
 * recusa acima de 21600 com um 400 que chegaria à tela como "não deu para
 * salvar", sem dizer qual campo. Quem garante o corte é o `min` em
 * `sdk/canal.ts`; esta lista é de exibição.
 *
 * Os passos são os de todo cliente da categoria, e não uma escala inventada:
 * quem liga modo lento está reagindo a uma enxurrada, e escolher entre 5 s e
 * 10 s é decisão que se toma de relance.
 */
const DEGRAUS_DE_MODO_LENTO = [
  0, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 21600,
] as const;

/** `0` é DESATIVADO e não "zero segundos" — a diferença é o que a linha diz. */
function rotuloDoModoLento(s: number): string {
  if (s <= 0) return "Desativado";
  if (s < 60) return `${String(s)} segundos`;
  if (s < 3600) {
    const m = s / 60;
    return m === 1 ? "1 minuto" : `${String(m)} minutos`;
  }
  const h = s / 3600;
  return h === 1 ? "1 hora" : `${String(h)} horas`;
}

export function VisaoGeralDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);

  const [nome, setNome] = useState(canal?.name ?? "");
  const [assunto, setAssunto] = useState(canal?.topico ?? "");
  const [idade, setIdade] = useState(canal?.restritoPorIdade ?? false);
  const [limite, setLimite] = useState(canal?.limiteDeUsuarios ?? 8);
  const [lento, setLento] = useState(canal?.modoLentoSegundos ?? 0);
  const [salvando, setSalvando] = useState(false);
  const [emojiAberto, setEmojiAberto] = useState(false);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }

  const ehVoz = canal.tipo === "voz";
  /*
    ⚠ **O modo lento precisa entrar aqui, e esquecê-lo custou o bug que a
    verificação em navegador pegou.** A faixa "você tem alterações não salvas"
    só existe quando `sujo`, e sem este termo a escolha de 30 s marcava no
    gatilho e NÃO havia como salvá-la — o controle mexia e a faixa não vinha.
    Pior que o pendente que ele substituiu: aquele ao menos dizia que não
    fazia nada.
  */
  /*
    ⚠ **Cada controle desta tela precisa entrar AQUI, e três não entravam.** A
    faixa "você tem alterações não salvas" é a única forma de salvar — não há
    botão fixo —, então um campo fora desta conta é um controle que mexe e não
    tem como ser gravado. Foi relatado assim: "não há botão de salvar no
    canal".

    O que faltava, e o que cada um produzia:

    - `limite` nunca esteve na conta. Num canal de VOZ, que é onde ele
      aparece, mexer no limite de usuários não trazia a faixa.
    - `idade` era comparado com `true` em vez de com o servidor: a faixa
      aparecia sempre que a caixa estivesse marcada, mesmo já sendo o estado
      salvo, e NÃO aparecia ao desmarcar um canal que era +18.
    - `lento` entrou na rodada passada, pelo mesmo motivo.

    A regra agora é uma só: comparar com o que o canal diz. Campo novo que
    esquecer desta linha reproduz o mesmo defeito, e é por isso que ela está
    escrita como uma lista e não como uma expressão esperta.
  */
  const sujo =
    nome !== canal.name ||
    assunto !== (canal.topico ?? "") ||
    idade !== canal.restritoPorIdade ||
    lento !== canal.modoLentoSegundos ||
    (ehVoz && limite !== (canal.limiteDeUsuarios ?? 8));

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
            {/* Um `Popover.Root` por FORMULÁRIO, e não por linha de lista —
                a conta que criou `store/seletorDeReacao.ts` não se aplica
                aqui: esta tela tem um campo de assunto, não dez mil. */}
            <Popover open={emojiAberto} onOpenChange={setEmojiAberto}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={css.reguaBotao}
                  aria-label="Emoji"
                >
                  🙂
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" sideOffset={6}>
                <SeletorDeEmoji
                  aoEscolher={(glifo) => {
                    setAssunto(assunto + glifo);
                    setEmojiAberto(false);
                  }}
                />
              </PopoverContent>
            </Popover>
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
        {/*
          ⚠ **Era pendente por uma afirmação FALSA sobre o protocolo.** O
          comentário aqui dizia "mudar é pendente porque `slowmode` não está em
          `DataEditChannel`" — e está: o modelo Rust o valida entre 0 e 21600, o
          schema do `stoat-api` o declara, e o `edit` do SDK repassa o corpo.
          Nunca precisou de fork; era trabalho de cliente registrado como
          trabalho de backend.

          ⚠ **Dropdown e não `<select>`**, pela regra que o lint deste projeto
          guarda: nativo é renderizado pelo SISTEMA, e num app escuro no
          Windows ele abre com cromo claro.
        */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={css.gatilhoDeLista}>
              {rotuloDoModoLento(lento)}
              <CaretDown size={ICONE.metadado} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {DEGRAUS_DE_MODO_LENTO.map((d) => (
              <DropdownMenuCheckboxItem
                key={d}
                marcado={lento === d}
                aoAlternar={() => setLento(d)}
              >
                {rotuloDoModoLento(d)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <p className={secao.recado}>
          Membros com &ldquo;Gerenciar mensagens&rdquo; ou &ldquo;Gerenciar
          canais&rdquo; ignoram o modo lento.
        </p>
      </section>

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Visibilidade do conteúdo</h2>
        <CartaoDeOpcao
          marcado={!idade}
          titulo="Padrão"
          detalhe="Sem aviso; mídia carrega direto."
          aoEscolher={() => setIdade(false)}
        />
        <CartaoDeOpcao
          marcado={false}
          titulo="Canal de spoiler"
          detalhe="Toda mídia entra borrada, com clique para revelar."
          aoEscolher={aindaNao("canalDeSpoiler")}
        />
        <CartaoDeOpcao
          marcado={idade}
          titulo="Restrição de idade"
          selo={<Selo tom="perigoSuave">+18</Selo>}
          detalhe="Exige confirmação na entrada; some da prévia de convite."
          aoEscolher={() => setIdade(true)}
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
                setIdade(canal.restritoPorIdade);
                setLimite(canal.limiteDeUsuarios ?? 8);
                setLento(canal.modoLentoSegundos);
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
                  modoLentoSegundos: lento,
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
