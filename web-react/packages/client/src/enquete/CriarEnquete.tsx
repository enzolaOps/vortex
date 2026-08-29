import { CaretDown, DotsSixVertical, Plus, Smiley, X } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Dialog, DialogClose, DialogContent } from "../components/ui/Dialog";
import { cn } from "../lib/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import { aindaNao } from "../pendente/pendencias";
import css from "./Enquete.module.css";

/** Quantas respostas cabem. O número é do design ("até 10"). */
const MAXIMO_DE_RESPOSTAS = 10;

/**
 * As marcas das respostas, na ordem.
 *
 * Letras encaixotadas e não números: o design as usa, e elas resolvem um
 * problema real — a contagem de votos ao lado da opção também é um número, e
 * "2 · 38%" numa linha que começa com "2." lê como duas coisas iguais.
 */
const MARCAS = ["🅰", "🅱", "🅲", "🅳", "🅴", "🅵", "🅶", "🅷", "🅸", "🅹"] as const;

const DURACOES = ["8 horas", "1 dia", "3 dias", "1 semana"] as const;

/**
 * O modal de criar enquete — 1:1 com o design.
 *
 * ⚠ **"Criar" é PENDÊNCIA, e o resto do formulário é real.** Enquete não
 * existe no protocolo Stoat (ver `store/enquetes.ts`): não há tipo de
 * mensagem, campo nem evento. Guardar a enquete só no cliente daria uma
 * contagem que só quem criou enxerga — pior que a ausência, porque parece
 * funcionar.
 *
 * O formulário funciona de verdade porque ele é a parte que sobrevive: quando
 * o protocolo tiver enquete, o que muda é o que acontece no botão.
 */
export function CriarEnquete({ aoFechar }: { aoFechar: () => void }) {
  const [pergunta, setPergunta] = useState("");
  /*
    ⚠ **Cada resposta tem ID PRÓPRIO, e não é preciosismo — foi o lint.**

    A saída óbvia era guardar `string[]` e usar o índice como chave. O lint do
    projeto proíbe, e a razão dele vale literalmente aqui: remover a resposta
    do meio faz todas as de baixo trocarem de índice, e o React reaproveitaria
    os campos pela POSIÇÃO — o texto da terceira apareceria na segunda, com o
    cursor no lugar errado, sem erro nenhum.
  */
  const proximo = useRef(2);
  const [respostas, setRespostas] = useState<
    readonly { readonly id: string; readonly texto: string }[]
  >([
    { id: "r0", texto: "" },
    { id: "r1", texto: "" },
  ]);
  /* Quem está sendo arrastada. `null` fora do arraste. */
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [duracao, setDuracao] = useState<string>(DURACOES[1]);
  const [multipla, setMultipla] = useState(false);
  const [resultadoNoFim, setResultadoNoFim] = useState(false);

  function mudarResposta(id: string, texto: string) {
    setRespostas((r) => r.map((v) => (v.id === id ? { ...v, texto } : v)));
  }

  /**
   * Move uma resposta para a posição de outra.
   *
   * Uma função só para o ponteiro e para o teclado — é o que garante que os
   * dois cheguem ao mesmo lugar. Reordenar que só funciona com mouse é o
   * defeito que a auditoria apontou na paleta de comandos, e é o mesmo
   * argumento que fez a pasta de servidor nascer por MENU antes de nascer por
   * arraste.
   */
  function mover(de: string, para: string) {
    if (de === para) return;
    setRespostas((atual) => {
      const i = atual.findIndex((r) => r.id === de);
      const j = atual.findIndex((r) => r.id === para);
      if (i < 0 || j < 0) return atual;
      const copia = [...atual];
      const [movida] = copia.splice(i, 1);
      copia.splice(j, 0, movida!);
      return copia;
    });
  }

  /** Sobe ou desce uma casa — o caminho de teclado. */
  function empurrar(id: string, passo: number) {
    setRespostas((atual) => {
      const i = atual.findIndex((r) => r.id === id);
      const j = i + passo;
      if (i < 0 || j < 0 || j >= atual.length) return atual;
      const copia = [...atual];
      const [movida] = copia.splice(i, 1);
      copia.splice(j, 0, movida!);
      return copia;
    });
  }

  const completa =
    pergunta.trim().length > 0 &&
    respostas.filter((r) => r.texto.trim().length > 0).length >= 2;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      {/*
        ⚠ **`tituloOculto` e `p-02`, e os dois consertam o MESMO defeito.**

        `DialogContent` embrulha os filhos num `<div class="mt-16">` e põe `p-24`
        no painel. Consequência medida: o `display:grid` do painel governava
        três filhos que não são meus (título, descrição, wrapper), então NENHUM
        `gap` chegava ao conteúdo — e o campo de comentário, um `<input>` solto
        dentro de um `div` de bloco, media 178px numa caixa de 400.

        Com o padding zerado e o título só para leitor de tela, o cabeçalho, o
        corpo e o rodapé passam a ser meus — que é o que o design desenha:
        rodapé numa faixa própria, sangrando até a borda.
      */}
      <DialogContent
        titulo="Criar enquete"
        tituloOculto
        className={cn("p-02", css.modal)}
      >
        <header className={css.cabecalho}>
          <h2 className={css.tituloDoModal}>Criar enquete</h2>
          <DialogClose className={css.fechar} aria-label="Fechar">
            <X aria-hidden />
          </DialogClose>
        </header>

        <div className={css.corpo}>
        <fieldset className={css.grupo}>
          <legend className={css.rotulo}>Pergunta</legend>
          <div className={css.campo}>
            <button
              type="button"
              className={css.campoGlifo}
              aria-label="Emoji na pergunta"
              onClick={aindaNao("emoji")}
            >
              <Smiley aria-hidden />
            </button>
            <input
              className={css.campoEntrada}
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="O que você quer perguntar?"
              aria-label="Pergunta da enquete"
              autoFocus
            />
          </div>
        </fieldset>

        <fieldset className={css.grupo}>
          <legend className={css.rotulo}>Respostas</legend>
          <div className={css.respostas}>
            {respostas.map((r, i) => (
              /*
                A LINHA inteira é o alvo do arraste, e a alça é o gatilho.

                `draggable` na linha e não na alça: arrastar uma alça de 14px
                move um fantasma de 14px, e o que a pessoa espera ver seguindo
                o ponteiro é a resposta. O `onDragOver` reordena AO PASSAR, sem
                esperar o soltar — assim a lista mostra o resultado enquanto a
                mão ainda está no meio do caminho.
              */
              <div
                key={r.id}
                className={css.resposta}
                draggable={arrastando === r.id}
                data-arrastando={arrastando === r.id || undefined}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  /* Firefox só inicia o arraste se houver carga. */
                  e.dataTransfer.setData("text/plain", r.id);
                }}
                onDragOver={(e) => {
                  if (!arrastando) return;
                  e.preventDefault();
                  mover(arrastando, r.id);
                }}
                onDragEnd={() => setArrastando(null)}
              >
                <button
                  type="button"
                  className={css.arrastar}
                  aria-label={`Mover resposta ${i + 1}`}
                  /*
                    O `pointerdown` ARMA o arraste, e é o que faz a alça ser a
                    alça: sem isto a linha inteira seria arrastável, e
                    selecionar o texto de uma resposta viraria um arraste.
                  */
                  onPointerDown={() => setArrastando(r.id)}
                  onPointerUp={() => setArrastando(null)}
                  /*
                    Teclado: Alt + setas. Sem Alt as setas navegam o campo, e
                    com Alt elas não colidem com nada — é a combinação que
                    editor de lista usa em toda parte.
                  */
                  onKeyDown={(e) => {
                    const passo =
                      e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
                    if (passo === 0 || !e.altKey) return;
                    e.preventDefault();
                    empurrar(r.id, passo);
                  }}
                >
                  <DotsSixVertical aria-hidden />
                </button>
                <span className={css.marca} aria-hidden>
                  {MARCAS[i]}
                </span>
                <input
                  className={css.campoEntrada}
                  value={r.texto}
                  onChange={(e) => mudarResposta(r.id, e.target.value)}
                  placeholder={`Resposta ${i + 1}`}
                  aria-label={`Resposta ${i + 1}`}
                />
                {/*
                  Remover só existe acima de duas.

                  Uma enquete com uma resposta não é uma enquete, e um botão
                  que a pessoa clica para descobrir que não pode é pior que a
                  ausência dele.
                */}
                {respostas.length > 2 ? (
                  <button
                    type="button"
                    className={css.remover}
                    aria-label={`Remover resposta ${i + 1}`}
                    onClick={() =>
                      setRespostas((atual) => atual.filter((v) => v.id !== r.id))
                    }
                  >
                    <X aria-hidden />
                  </button>
                ) : null}
              </div>
            ))}

            {respostas.length < MAXIMO_DE_RESPOSTAS ? (
              <button
                type="button"
                className={css.acrescentar}
                onClick={() =>
                  setRespostas((atual) => [
                    ...atual,
                    { id: `r${proximo.current++}`, texto: "" },
                  ])
                }
              >
                <Plus aria-hidden />
                Adicionar resposta · até {MAXIMO_DE_RESPOSTAS}
              </button>
            ) : null}
          </div>
        </fieldset>

        {/*
          ⚠ **O design desenha dois `<select>` e aqui eles são dropdowns.**

          Não é divergência de gosto: `<select>` nativo é renderizado pelo
          SISTEMA, não pelo app — num app escuro no Windows ele abre com cromo
          claro, e a identidade do produto termina na borda dele. O projeto tem
          lint contra isso desde a auditoria da fase 4, e ele me pegou aqui.

          O gatilho reproduz a APARÊNCIA do select (caixa, valor, seta); o que
          muda é de quem é a lista que abre.
        */}
        <div className={css.duas}>
          <Escolha
            rotulo="Duração"
            valor={duracao}
            opcoes={DURACOES}
            aoEscolher={setDuracao}
          />
          <Escolha
            rotulo="Seleção"
            valor={multipla ? "Múltiplas respostas" : "Uma resposta"}
            opcoes={["Uma resposta", "Múltiplas respostas"]}
            aoEscolher={(v) => setMultipla(v === "Múltiplas respostas")}
          />
        </div>

        {/*
          O interruptor. `role="switch"` num `<button>` e não um checkbox
          nativo: o lint do projeto proíbe controle nativo sem estilo em
          superfície de produto, e o estado real vive no `aria-checked`.
        */}
        <div className={css.interruptorLinha}>
          <div>
            <div className={css.interruptorTitulo}>Resultado só no fim</div>
            <div className={css.interruptorDica}>
              Esconde a contagem até a enquete fechar
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={resultadoNoFim}
            aria-label="Resultado só no fim"
            className={css.interruptor}
            onClick={() => setResultadoNoFim((v) => !v)}
          >
            <span className={css.botaoDoInterruptor} />
          </button>
        </div>

        </div>

        <div className={css.rodapeDoModal}>
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao
            variante="primario"
            disabled={!completa}
            onClick={aindaNao("enquete")}
          >
            Criar
          </Botao>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Um campo de escolha com a cara de um `<select>` e a lista do app.
 *
 * Vive aqui e não em `components/ui/` de propósito: um wrapper genérico
 * exigiria decidir agora o que ele faz com muitas opções, com busca e com
 * grupos — e a regra do projeto é que biblioteca resolve o genérico e a gente
 * escreve o específico, não o contrário. Quando o segundo consumidor aparecer,
 * ele sobe.
 */
function Escolha({
  rotulo,
  valor,
  opcoes,
  aoEscolher,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly string[];
  aoEscolher: (v: string) => void;
}) {
  return (
    <div className={css.selecao}>
      <span className={css.rotuloLeve}>{rotulo}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={css.select} aria-label={rotulo}>
            <span>{valor}</span>
            <CaretDown aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {opcoes.map((o) => (
            <DropdownMenuItem key={o} onSelect={() => aoEscolher(o)}>
              {o}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
