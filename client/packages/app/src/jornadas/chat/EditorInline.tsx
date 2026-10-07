import { editarMensagem } from "nucleo/sdk/adapter";
import { pararDeEditar } from "nucleo/store/edicaoDeMensagem";
import { toast } from "nucleo/ui-logica/toastStore";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

import { chat } from "../../textos";
import css from "./Linha.module.css";

/**
 * Edição no lugar do corpo: a mensagem corrigida continua no contexto do que
 * veio antes e depois, em vez de um modal. Só a linha em edição monta isto.
 *
 * Enter salva, Shift+Enter quebra a linha, Esc cancela. Salvar é otimista no
 * núcleo (o texto novo entra na hora); se o servidor recusar, um aviso de erro
 * diz isso. O texto vazio não salva: apagar é outra ação, com confirmação.
 */
export function EditorInline({ id, textoInicial }: { id: string; textoInicial: string }) {
  const [texto, setTexto] = useState(textoInicial);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.blockSize = "auto";
    el.style.blockSize = `${el.scrollHeight}px`;
  }, [texto]);

  const salvar = () => {
    const limpo = texto.trim();
    if (limpo === "") return;
    pararDeEditar();
    if (limpo === textoInicial.trim()) return;
    void editarMensagem(id, limpo).then((ok) => {
      if (!ok) toast({ tipo: "erro", titulo: chat.falhaAoEditar });
    });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      pararDeEditar();
    } else if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      salvar();
    }
  };

  return (
    <div className={css.editor}>
      <textarea
        ref={area}
        rows={1}
        className={css.editorCampo}
        value={texto}
        aria-label={chat.editandoMensagem}
        onChange={(e) => {
          setTexto(e.target.value);
        }}
        onKeyDown={aoTeclar}
      />
      <span className={css.editorDica}>{chat.dicaDeEdicao}</span>
    </div>
  );
}
