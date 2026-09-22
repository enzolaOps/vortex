import { useSyncExternalStore, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { cn } from "../lib/cn";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { DotsSixVertical, Plus } from "../components/ui/icones";
import { empurrarItem, moverItem } from "../lib/reordenar";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useServer } from "../store/hooks";
import {
  assinarPastas,
  corDePastaValida,
  CORES_DE_PASTA,
  editarPasta,
  lerPastas,
  removerPasta,
} from "../store/pastas";
import css from "./EditorDePasta.module.css";

/**
 * O editor de pasta do rail.
 *
 * ⚠ **Ele era um campo de nome.** A referência tem nome, cor, a lista de
 * servidores com "Remover", o alvo de arraste e "mostrar sempre expandida" —
 * e o nosso `FormaDePasta` fazia só o primeiro. Renomear continua existindo
 * dentro dele; o que mudou é que renomear deixou de ser a única coisa.
 *
 * ⚠ **Nada aqui é assíncrono, ao contrário dos irmãos.** Pasta é conceito de
 * CLIENTE e a escrita é local: não há promessa a esperar nem falha de rede a
 * traduzir. Ver `store/pastas.ts` — o protocolo do Stoat guarda ORDEM de
 * servidor em configuração de usuário e agrupamento nenhum.
 *
 * ⚠ **Salva ao SAIR, e não a cada tecla.** O rail assina o store; gravar por
 * caractere redesenharia a coluna a cada letra do nome, e escreveria no
 * `localStorage` o mesmo número de vezes.
 */
export function EditorDePasta({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const pastas = useSyncExternalStore(assinarPastas, lerPastas);

  const pastaId = alvo?.tipo === "editarPasta" ? alvo.pastaId : "";
  const pasta = pastas.find((p) => p.id === pastaId);

  /*
    O estado local nasce da pasta e não a segue: enquanto o editor está aberto,
    quem manda é o que se está editando. Sem isto, mexer numa cor republicaria
    o store e o campo de nome voltaria ao valor gravado no meio da digitação.
  */
  const [nome, setNome] = useState(pasta?.nome ?? "");
  const [cor, setCor] = useState<string>(pasta?.cor ?? CORES_DE_PASTA[0]);
  const [sempre, setSempre] = useState(pasta?.sempreExpandida ?? false);
  /*
    ⚠ **A lista é RASCUNHO, e antes não era.** `Remover` chamava
    `moverParaPasta` direto no store: a linha sumia na hora e `Cancelar` não
    trazia nada de volta — quem tirasse três servidores por engano e desistisse
    não recuperava nenhum. Agora o modal inteiro tem um só ponto de escrita, o
    `Salvar`, que é o que o rodapé promete.
  */
  const [servidores, setServidores] = useState<readonly string[]>(
    pasta?.servidores ?? [],
  );
  /* O `＋` do design abre o campo de hex; ele não é um sexto swatch. */
  const [livre, setLivre] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  if (!pasta) return null;

  function salvar(): void {
    editarPasta(pastaId, { nome, cor, sempreExpandida: sempre, servidores });
    aoFechar();
  }

  /** Uma função para o ponteiro e para o teclado — os dois chegam ao mesmo
      lugar, que é o que faz o arraste ser acréscimo e não requisito. */
  function mover(de: string, para: string): void {
    setServidores((atual) =>
      moverItem(atual, atual.indexOf(de), atual.indexOf(para)),
    );
  }

  function empurrar(id: string, passo: number): void {
    setServidores((atual) => empurrarItem(atual, atual.indexOf(id), passo));
  }

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Editar pasta"
        descricao={
          pasta.servidores.length === 1
            ? "1 servidor dentro"
            : `${String(pasta.servidores.length)} servidores dentro`
        }
        className={css.painel}
        rodape={
          <>
            {/*
              ⚠ "Desfazer pasta", nunca "Excluir". Os servidores voltam a ser
              soltos e nenhum sai — quem apaga uma pasta espera perder o
              AGRUPAMENTO, não sair de cinco servidores.
            */}
            <Botao
              variante="perigoSutil"
              tamanho="pequeno"
              onClick={() => {
                removerPasta(pastaId);
                aoFechar();
              }}
            >
              Desfazer pasta
            </Botao>
            <span className={css.acoes}>
              <Botao variante="sutil" onClick={aoFechar}>
                Cancelar
              </Botao>
              <Botao variante="primario" onClick={salvar}>
                Salvar
              </Botao>
            </span>
          </>
        }
      >
        <Campo
          rotulo="Nome da pasta"
          dica="Aparece só como tooltip no rail — o rail mostra os ícones."
          autoFocus
          maxLength={32}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />

        <div className={css.sobrancelha}>Cor da pasta</div>
        <div
          className={css.cores}
          role="radiogroup"
          aria-label="Cor da pasta"
        >
          {CORES_DE_PASTA.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={cor === c}
              aria-label={`Cor ${c}`}
              className={css.cor}
              style={{ background: c }}
              onClick={() => setCor(c)}
            />
          ))}
          {/*
            O `＋` do design, e ele NÃO é um sexto swatch.

            ⚠ A lista era de seis cores fechadas e o design desenha cinco mais
            este alvo. A cor da pasta tinge um fundo a 10% — nada pousa em cima
            dela, então um hex livre não pode reprovar contraste de texto
            nenhum, e o que sobra ("pode sumir") a prévia ao lado responde
            melhor que uma lista fechada responderia.
          */}
          <button
            type="button"
            className={css.corLivre}
            aria-label="Usar outra cor"
            aria-expanded={livre}
            onClick={() => setLivre((v) => !v)}
          >
            <Plus aria-hidden />
          </button>

          {/*
            O hex escrito, em mono. Fechado ele é LEITURA — o que deixa a
            escolha copiável e confere que o degrau marcado é o que se está
            vendo; aberto ele vira o campo, no mesmo lugar e com a mesma
            geometria, em vez de um segundo controle ao lado dizendo a mesma
            coisa.
          */}
          {livre ? (
            <input
              className={css.hexCampo}
              value={cor}
              autoFocus
              spellCheck={false}
              maxLength={7}
              aria-label="Cor da pasta em hexadecimal"
              /*
                O campo aceita QUALQUER texto e quem julga é o `Salvar`.

                Recusar a tecla travaria a digitação no terceiro caractere de
                todo hex — `#35c` não é cor válida e é o caminho para `#35c2cc`.
                `corDePastaValida` continua sendo o portão, só que no único
                lugar onde o valor sai do modal: `editarPasta` mantém a cor
                anterior se o que chegar não for hex de seis dígitos.
              */
              onChange={(e) => {
                const bruto = e.target.value;
                setCor(
                  (bruto.startsWith("#") ? bruto : `#${bruto}`).slice(0, 7),
                );
              }}
              data-invalida={!corDePastaValida(cor) || undefined}
            />
          ) : (
            <span className={css.hex}>{cor}</span>
          )}
        </div>

        <div className={css.sobrancelha}>Servidores</div>
        <div className={css.lista}>
          {servidores.map((id, i) => (
            <LinhaDeServidor
              key={id}
              id={id}
              posicao={i + 1}
              total={servidores.length}
              arrastando={arrastando === id}
              aoArmar={() => setArrastando(id)}
              aoSoltar={() => setArrastando(null)}
              aoPassarPor={() => arrastando && mover(arrastando, id)}
              aoEmpurrar={(passo) => empurrar(id, passo)}
              aoRemover={() =>
                setServidores((atual) => atual.filter((s) => s !== id))
              }
            />
          ))}
        </div>

        {/*
          ⚠ **O alvo de arraste é DESENHO, e diz o que fazer em vez de mentir.**
          A referência mostra "arraste um servidor do rail para cá", e arrastar
          para dentro do modal não existe aqui — o rail já move servidor por
          MENU, que é a decisão registrada no `CLAUDE.md`: arraste é exclusivo
          de ponteiro, e menu funciona com teclado desde o primeiro dia. Este
          bloco aponta o caminho que existe.
        */}
        <p className={css.alvo}>
          Para pôr outro servidor aqui, use <strong>Mover para {nome || pasta.nome}</strong> no
          menu do servidor, no rail.
        </p>

        <div className={css.linha}>
          <div>
            <div className={css.linhaTitulo}>Mostrar sempre expandida</div>
            <div className={css.linhaDetalhe}>
              Ignora o colapso automático ao trocar de servidor
            </div>
          </div>
          <Interruptor
            ligado={sempre}
            rotulo="Mostrar sempre expandida"
            aoAlternar={setSempre}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Uma linha da lista — ladrilho, nome e "Remover".
 *
 * Componente próprio porque assina o SERVIDOR: sem ele, o editor inteiro
 * re-renderizaria quando qualquer um dos servidores da pasta mudasse de nome.
 * É a lei nº 1 na menor escala em que ela vale.
 */
function LinhaDeServidor({
  id,
  posicao,
  total,
  arrastando,
  aoArmar,
  aoSoltar,
  aoPassarPor,
  aoEmpurrar,
  aoRemover,
}: {
  id: string;
  posicao: number;
  total: number;
  arrastando: boolean;
  aoArmar: () => void;
  aoSoltar: () => void;
  aoPassarPor: () => void;
  aoEmpurrar: (passo: number) => void;
  aoRemover: () => void;
}) {
  const servidor = useServer(id);
  if (!servidor) return null;

  return (
    <div
      className={css.item}
      /*
        O arraste é ARMADO pela alça, não pela linha.

        Sem isso a linha inteira seria arrastável e não haveria como selecionar
        o nome de um servidor — a mesma decisão já registrada na enquete.
      */
      draggable={arrastando}
      data-arrastando={arrastando || undefined}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        /* Firefox só inicia o arraste se houver carga. */
        e.dataTransfer.setData("text/plain", id);
      }}
      onDragOver={(e) => {
        if (!arrastando) e.preventDefault();
        aoPassarPor();
      }}
      onDragEnd={aoSoltar}
    >
      <button
        type="button"
        className={css.arrastar}
        aria-label={`Mover ${servidor.name} — posição ${String(posicao)} de ${String(total)}`}
        onPointerDown={aoArmar}
        onPointerUp={aoSoltar}
        /*
          Teclado: Alt + setas. Sem Alt as setas navegam a lista, e com Alt não
          colidem com nada — reordenar que só funciona com mouse é o defeito
          que a auditoria apontou na paleta de comandos, e a razão de a pasta
          ter nascido por MENU antes de nascer por arraste.
        */
        onKeyDown={(e) => {
          const passo = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          if (passo === 0 || !e.altKey) return;
          e.preventDefault();
          aoEmpurrar(passo);
        }}
      >
        <DotsSixVertical aria-hidden />
      </button>
      <span
        className={css.ladrilho}
        aria-hidden
        /* ⚠ O ladrilho mantém o gradiente do SERVIDOR e nunca a cor da pasta.
           A cor da pasta tinge o agrupamento; tingir os ícones apagaria a
           identidade que faz cada servidor reconhecível de relance. */
        style={{
          backgroundImage: gradienteDe(id),
          color: corDoTextoDe(id),
        }}
      >
        {servidor.sigla}
      </span>
      <span className={css.itemNome}>{servidor.name}</span>
      <button
        type="button"
        className={cn(css.remover)}
        aria-label={`Tirar ${servidor.name} da pasta`}
        /* Rascunho, não escrita: quem sai daqui só sai de verdade no Salvar —
           ver o comentário do estado lá em cima. */
        onClick={aoRemover}
      >
        Remover
      </button>
    </div>
  );
}
