import { criarCanal, criarCategoriaEDevolverId } from "nucleo/sdk/servidores";
import { CATEGORIA_PADRAO } from "nucleo/sdk/domain";
import { useCategorias } from "nucleo/store/hooks";
import { lembrarSala } from "nucleo/store/ultimoLugar";
import { useState, type FormEvent } from "react";

import { comum, salas } from "../../textos";
import { Botao } from "../../ui/ds";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./Salas.module.css";

export interface CriarSalaProps {
  serverId: string;
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}

/**
 * Criar uma sala de voz. Canal não nasce fora de categoria: usa a primeira
 * categoria do servidor e, num servidor que não tem nenhuma, cria a primeira
 * (com o nome genérico "Salas") antes. A sala criada vira a sala do widget.
 */
export function CriarSala({ serverId, aberto, aoMudar }: CriarSalaProps) {
  const categorias = useCategorias(serverId).filter((c) => c.id !== CATEGORIA_PADRAO);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const limpo = nome.trim();
    if (limpo === "") {
      setErro(salas.criar.nomeObrigatorio);
      return;
    }
    setEnviando(true);
    setErro(undefined);
    const categoria = categorias[0]?.id ?? (await criarCategoriaEDevolverId(serverId, salas.titulo));
    const id = categoria === undefined ? undefined : await criarCanal(serverId, limpo, true, categoria);
    setEnviando(false);
    if (id === undefined) {
      setErro(salas.criar.falhou);
      return;
    }
    lembrarSala(serverId, id);
    setNome("");
    aoMudar(false);
  };

  return (
    <Dialogo open={aberto} onOpenChange={aoMudar}>
      <ConteudoDoDialogo titulo={salas.criar.titulo} descricao={salas.criar.descricao}>
        <form
          className={css.formulario}
          onSubmit={(e) => {
            void enviar(e);
          }}
        >
          <label className={css.rotulo}>
            {salas.criar.rotuloDoNome}
            <input
              className={css.campo}
              value={nome}
              maxLength={32}
              autoFocus
              aria-invalid={erro !== undefined}
              onChange={(e) => {
                setNome(e.target.value);
              }}
            />
          </label>
          {erro !== undefined && (
            <p className={css.erro} role="alert">
              {erro}
            </p>
          )}
          <div className={css.rodapeDoDialogo}>
            <Botao
              variante="fantasma"
              onClick={() => {
                aoMudar(false);
              }}
            >
              {comum.cancelar}
            </Botao>
            <Botao type="submit" carregando={enviando}>
              {salas.criar.confirmar}
            </Botao>
          </div>
        </form>
      </ConteudoDoDialogo>
    </Dialogo>
  );
}
