import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { salvarServidor } from "../sdk/servidores";
import { useServer } from "../store/hooks";
import css from "./Secao.module.css";
import { cn } from "../lib/cn";

/**
 * Nome e descrição do servidor.
 *
 * ⚠ **A saída SAIU daqui.** Ela era a última seção desta página; agora vive no
 * grupo de perigo da coluna de navegação, com a confirmação em modal — ver o
 * comentário no fim do `return` e `ModalDeExclusao`. O raciocínio sobre o
 * protocolo (`DELETE /servers/{id}` sai OU apaga, conforme o dono) mudou de
 * arquivo junto com o controle que ele governa.
 */
export function Servidor({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  const [nome, setNome] = useState(servidor?.name ?? "");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    /*
      1120 é o teto desta página na referência (`ServerProfilePage`) e no
      design. `.forma` nasce em 880 — a medida de um formulário de coluna
      única —, e esta tela não é uma: ela é o formulário à esquerda em 560
      mais a prévia ao vivo do card de convite à direita. Com 880 as duas não
      cabem lado a lado.

      ⚠ O teto só passou a IMPORTAR agora: o painel era 960 e nada chegava a
      880. Com ele em 1600, uma página sem teto próprio estica e uma com teto
      velho deixa meia tela vazia.
    */
    <div
      className={cn(css.forma, css.larga)}
      style={{ "--vx-editor-w": "1120px" } as React.CSSProperties}
    >
      <form
        className={css.bloco}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          setSalvando(true);
          void salvarServidor(serverId, nome.trim(), descricao.trim()).finally(
            () => setSalvando(false),
          );
        }}
      >
        <h2 className={css.subtitulo}>Identidade</h2>
        <Campo
          rotulo="Nome do servidor"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          rotulo="Descrição"
          dica="Aparece na prévia do convite. Pode ficar vazia."
          autoComplete="off"
          disabled={salvando}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className={css.acoes}>
          <Botao variante="primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </form>

      {/*
        ⚠ **O bloco de perigo SAIU daqui, e foi para a coluna de navegação.**
        Ele era a última seção desta página — "Apagar servidor" / "Sair do
        servidor" com confirmação inline de dois passos. A referência põe os
        dois no fim da nav, e a confirmação virou modal (`apagarServidor` em
        `ModalDeExclusao`), porque de um item de coluna não há onde uma
        pergunta inline apareça.

        Ficar nos DOIS lugares seria pior que qualquer um deles: duas cópias
        de uma pergunta destrutiva que precisam concordar, e a que diverge é
        sempre a que ninguém abriu naquela semana.
      */}
    </div>
  );
}
