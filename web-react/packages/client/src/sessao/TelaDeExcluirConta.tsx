import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import {
  cancelarExclusao,
  confirmarExclusao,
  estadoDaExclusao,
  type EstadoDeExclusao,
} from "../sdk/conta";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

function formatarPrazo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR");
}

/**
 * Confirma ou cancela a exclusão a partir do link do e-mail.
 *
 * Abrir a tela NÃO confirma. Scanners de e-mail visitam o endereço; a exclusão
 * só acontece num clique explícito.
 */
export function TelaDeExcluirConta({
  token,
  motivo,
}: {
  token: string;
  motivo: string | undefined;
}) {
  const [estado, setEstado] = useState<EstadoDeExclusao | "lendo" | "falhou">(
    "lendo",
  );
  const [ocupada, setOcupada] = useState(false);

  useEffect(() => {
    let viva = true;
    void estadoDaExclusao(token).then((atual) => {
      if (!viva) return;
      setEstado(atual ?? "falhou");
    });
    return () => {
      viva = false;
    };
  }, [token]);

  return (
    <div className={css.tela}>
      <div className={css.cartao}>
        <h1 className={css.titulo}>
          {estado !== "lendo" &&
          estado !== "falhou" &&
          estado.tipo === "agendada"
            ? "Exclusão agendada"
            : "Excluir a conta"}
        </h1>

        {motivo ? (
          <Banner tom="perigo" role="alert">
            {motivo}
          </Banner>
        ) : null}

        {estado === "lendo" ? (
          <p className={css.recado}>Lendo o pedido…</p>
        ) : estado === "falhou" ? (
          <p className={css.recado}>
            Este link não vale mais. Peça a exclusão de novo em Conta, ou ignore
            se você não pediu isso.
          </p>
        ) : estado.tipo === "aguardando" ? (
          <>
            <p className={css.recado}>
              Confirmar desativa a conta agora e apaga mensagens, amizades e
              bots daqui a 7 dias. E-mail e nome de usuário são liberados no
              fim. Durante esses 7 dias dá para cancelar por este mesmo link.
            </p>
            <Botao
              variante="perigo"
              disabled={ocupada}
              carregando={ocupada}
              rotuloCarregando="Confirmando…"
              onClick={() => {
                setOcupada(true);
                void confirmarExclusao(token)
                  .then((ok) => {
                    if (ok) {
                      return estadoDaExclusao(token).then((atual) => {
                        if (atual) setEstado(atual);
                      });
                    }
                  })
                  .finally(() => setOcupada(false));
              }}
            >
              Confirmar exclusão
            </Botao>
          </>
        ) : (
          <>
            <p className={css.recado}>
              A conta está desativada. A exclusão definitiva está marcada para{" "}
              {formatarPrazo(estado.ate)}. Cancelar não restaura as sessões
              antigas — será preciso entrar de novo.
            </p>
            <Botao
              variante="primario"
              disabled={ocupada}
              carregando={ocupada}
              rotuloCarregando="Cancelando…"
              onClick={() => {
                setOcupada(true);
                void cancelarExclusao(token)
                  .then((ok) => {
                    if (ok) voltarParaEntrar();
                  })
                  .finally(() => setOcupada(false));
              }}
            >
              Cancelar exclusão
            </Botao>
          </>
        )}

        <p className={css.rodape}>
          <button
            type="button"
            className={css.trocarTela}
            disabled={ocupada}
            onClick={voltarParaEntrar}
          >
            Voltar para a entrada
          </button>
        </p>
      </div>
    </div>
  );
}
