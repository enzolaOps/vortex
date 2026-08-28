import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { listarBanidos, perdoar, type Banido } from "../sdk/servidores";
import css from "./Secao.module.css";

/**
 * Quem está banido, e o botão de desfazer.
 *
 * ⚠ **O nome vem do BANIMENTO, não do cache de usuários.** Quem foi banido
 * normalmente não está mais em lugar nenhum que o cliente conheça — pedir à
 * coleção de usuários devolveria um ID de 26 caracteres, que é a informação
 * menos útil possível numa lista cuja pergunta é "quem é esse?".
 *
 * O motivo aparece quando existe, e é ele que torna a lista revisável meses
 * depois: sem ele, perdoar vira adivinhação.
 */
export function Banimentos({ serverId }: { serverId: string }) {
  const [lista, setLista] = useState<readonly Banido[] | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!serverId) return;
    let vivo = true;
    void listarBanidos(serverId).then((l) => {
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
      <EstadoVazio
        titulo="Ninguém banido"
        detalhe="Banimentos aparecem aqui, com o motivo que quem baniu escreveu."
      />
    );
  }

  return (
    <ul className={css.lista}>
      {lista.map((b) => (
        <li key={b.userId} className={css.linha}>
          <span className={css.texto}>
            <span className={css.nome}>{b.nome}</span>
            {/* Sem motivo é o caso comum — banir não exige um. Dizer "sem
                motivo registrado" é melhor que uma linha vazia, que pareceria
                dado faltando. */}
            <span className={css.detalhe}>
              {b.razao ?? "sem motivo registrado"}
            </span>
          </span>

          <Botao
            variante="sutil"
            disabled={ocupado}
            onClick={() => {
              setOcupado(true);
              void perdoar(serverId, b.userId)
                .then((ok) => {
                  if (!ok) return;
                  setLista((l) => l?.filter((x) => x.userId !== b.userId));
                })
                .finally(() => setOcupado(false));
            }}
          >
            Perdoar
          </Botao>
        </li>
      ))}
    </ul>
  );
}
