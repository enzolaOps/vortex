import type { ReactNode } from "react";

import { admin } from "../../textos";
import { Botao } from "../../ui/ds";
import css from "./admin.module.css";

/** Estado de carregamento de uma lista: dito em texto, para o leitor de tela também. */
export function Carregando({ texto }: { texto: string }) {
  return (
    <p className={css.texto} role="status">
      {texto}
    </p>
  );
}

/**
 * Vazio com próxima ação. O corpo é sempre o que a pessoa pode fazer agora, e a
 * ação só vem quando ela pode (ação sem permissão fica ausente).
 */
export function Vazio({
  titulo,
  texto,
  acao,
}: {
  titulo: string;
  texto?: string;
  acao?: ReactNode;
}) {
  return (
    <div className={css.estado} data-testid="estado-vazio">
      <p className={css.estadoTitulo}>{titulo}</p>
      {texto !== undefined && <p className={css.dica}>{texto}</p>}
      {acao}
    </div>
  );
}

/** A consulta falhou: diz o que houve e oferece repetir. Nunca vira lista vazia. */
export function Falhou({ texto, aoTentar }: { texto: string; aoTentar: () => void }) {
  return (
    <div className={css.estado} role="alert" data-testid="estado-de-erro">
      <p className={css.estadoTitulo}>{texto}</p>
      <Botao variante="secundario" tamanho="sm" onClick={aoTentar}>
        {admin.estados.tentarDeNovo}
      </Botao>
    </div>
  );
}
