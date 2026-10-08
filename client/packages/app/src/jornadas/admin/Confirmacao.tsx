import { useState, type ReactNode } from "react";

import { comum } from "../../textos";
import { Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./admin.module.css";

export interface ConfirmacaoProps {
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
  titulo: string;
  texto: string;
  confirmar: string;
  /** Devolve se deu certo; o diálogo só fecha quando deu. */
  aoConfirmar: () => Promise<boolean>;
  /** Campo extra entre o texto e os botões (digitar o nome, por exemplo). */
  children?: ReactNode;
  /** Trava o botão de confirmar enquanto a condição não vale. */
  liberado?: boolean;
}

/**
 * A pergunta antes de uma ação que não dá para desfazer. O botão perigoso é o
 * da direita e diz o verbo ("Apagar"), nunca "Sim".
 */
export function Confirmacao({
  aberto,
  aoMudar,
  titulo,
  texto,
  confirmar,
  aoConfirmar,
  children,
  liberado = true,
}: ConfirmacaoProps) {
  const [ocupado, setOcupado] = useState(false);

  const confirmarAgora = async () => {
    if (!liberado || ocupado) return;
    setOcupado(true);
    const ok = await aoConfirmar();
    setOcupado(false);
    if (ok) aoMudar(false);
  };

  return (
    <Dialogo open={aberto} onOpenChange={aoMudar}>
      <ConteudoDoDialogo titulo={titulo} descricao={texto}>
        <form
          className={css.formulario}
          onSubmit={(e) => {
            e.preventDefault();
            void confirmarAgora();
          }}
        >
          {children}
          <div className={css.rodapeDoDialogo}>
            <Botao
              variante="fantasma"
              onClick={() => {
                aoMudar(false);
              }}
            >
              {comum.cancelar}
            </Botao>
            <Botao type="submit" variante="perigo" carregando={ocupado} aria-disabled={!liberado || undefined}>
              {confirmar}
            </Botao>
          </div>
        </form>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
