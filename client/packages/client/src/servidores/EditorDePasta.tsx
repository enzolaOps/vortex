import { useSyncExternalStore, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Interruptor } from "../components/ui/Interruptor";
import { cn } from "../lib/cn";
import { corDoTextoDe, gradienteDe } from "../lib/gradiente";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useServer } from "../store/hooks";
import {
  assinarPastas,
  CORES_DE_PASTA,
  editarPasta,
  lerPastas,
  moverParaPasta,
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

  if (!pasta) return null;

  function salvar(): void {
    editarPasta(pastaId, { nome, cor, sempreExpandida: sempre });
    aoFechar();
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
          {/* O hex escrito, em mono: é o que deixa a escolha copiável e
              confere que o degrau marcado é o que se está vendo. */}
          <span className={css.hex}>{cor}</span>
        </div>

        <div className={css.sobrancelha}>Servidores</div>
        <div className={css.lista}>
          {pasta.servidores.map((id) => (
            <LinhaDeServidor key={id} id={id} />
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
function LinhaDeServidor({ id }: { id: string }) {
  const servidor = useServer(id);
  if (!servidor) return null;

  return (
    <div className={css.item}>
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
        onClick={() => moverParaPasta(id, null)}
      >
        Remover
      </button>
    </div>
  );
}
