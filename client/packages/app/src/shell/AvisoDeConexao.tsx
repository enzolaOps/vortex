import { duracaoCurta } from "nucleo/lib/duracao";
import { useDetalheDaConexao } from "nucleo/store/hooks";
import { useEffect, useState } from "react";

import { shell } from "../textos";
import { SemConexao } from "../ui/icones";
import css from "./Regioes.module.css";

/**
 * O aviso de queda de conexão, o ÚNICO do app: na barra de título, onde o olho
 * já está e onde nenhuma área de conteúdo precisa dar lugar a ele. Substitui os
 * avisos que cada tela repetia (composer, conversas, amigos, presença).
 *
 * Conectado não monta nada. O relógio de segundos só roda enquanto a queda dura.
 */
export function AvisoDeConexao() {
  const { estado, caiuEm } = useDetalheDaConexao();
  if (estado === "conectado") return null;
  return <Queda reconectando={estado === "reconectando"} caiuEm={caiuEm} />;
}

function Queda({ reconectando, caiuEm }: { reconectando: boolean; caiuEm: number | undefined }) {
  const [agora, setAgora] = useState<number | undefined>(undefined);
  useEffect(() => {
    const marcar = () => {
      setAgora(Date.now());
    };
    // Fora do corpo do efeito: o primeiro valor chega no quadro seguinte, não no render.
    const primeiro = window.setTimeout(marcar, 0);
    const id = window.setInterval(marcar, 1000);
    return () => {
      clearTimeout(primeiro);
      clearInterval(id);
    };
  }, []);

  const desde = caiuEm !== undefined && agora !== undefined ? duracaoCurta(agora - caiuEm) : undefined;
  const texto =
    desde === undefined
      ? reconectando
        ? shell.conexao.reconectandoSemTempo
        : shell.conexao.semConexaoSemTempo
      : reconectando
        ? shell.conexao.reconectando(desde)
        : shell.conexao.semConexao(desde);

  return (
    <div className={css.conexao} role="status" aria-label={shell.conexao.rotulo}>
      <SemConexao tamanho={14} />
      <span>{texto}</span>
    </div>
  );
}
