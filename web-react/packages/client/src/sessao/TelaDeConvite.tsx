import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { PreviaDoConvite } from "../servidores/AdicionarServidor";
import { buscarConvite, type Convite } from "../sdk/servidores";
import { voltarParaEntrar } from "../store/entrada";
import css from "./TelaDeLogin.module.css";

/**
 * Um convite aberto por link, ANTES de haver sessão.
 *
 * É o caso COMUM de convite: alguém manda o link para quem ainda não tem conta
 * aqui. Sem esta tela o clique cairia no login e o código se perderia — a
 * pessoa criaria a conta e não saberia mais para onde ia.
 *
 * A prévia é buscada mesmo deslogado porque `GET /invites/{code}` é público:
 * mostrar o servidor antes de pedir cadastro é a ordem certa, e a inversa
 * — "crie uma conta para ver onde você vai entrar" — é a que faz desistir.
 *
 * O código sobrevive ao login: ele fica no store de entrada, e o portão abre o
 * modal de convite assim que a sessão vale. Ver `PortaoDeSessao`.
 */
export function TelaDeConvite({ codigo }: { codigo: string }) {
  const [convite, setConvite] = useState<Convite | undefined>(undefined);
  const [erro, setErro] = useState<string | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    void buscarConvite(codigo).then((r) => {
      if (!vivo) return;
      if ("erro" in r) setErro(r.erro);
      else setConvite(r);
    });
    return () => {
      vivo = false;
    };
  }, [codigo]);

  return (
    <div className={css.tela}>
      <div className={css.cartao}>
        <h1 className={css.titulo}>Você foi convidado</h1>

        {erro ? (
          <>
            <p className={css.erro} role="alert">
              {erro}
            </p>
            <Botao variante="neutro" onClick={voltarParaEntrar}>
              Ir para a entrada
            </Botao>
          </>
        ) : convite ? (
          <>
            {/* A prévia é o MESMO componente do modal: um convite visto
                deslogado e outro visto de dentro do app não podem parecer
                dois servidores diferentes. */}
            <PreviaDoConvite convite={convite} aoFechar={voltarParaEntrar} />
            <p className={css.recado}>
              Entre na sua conta para aceitar. O convite continua valendo
              depois.
            </p>
            <Botao variante="primario" onClick={voltarParaEntrar}>
              Entrar na conta
            </Botao>
          </>
        ) : (
          <p className={css.recado}>Procurando o convite…</p>
        )}
      </div>
    </div>
  );
}
