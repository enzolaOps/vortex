import { sessao } from "../../textos";
import { Botao } from "../../ui/ds";
import { AvisoSimples } from "./AvisoDeEntrada";
import css from "./Entrada.module.css";
import { MoldeDaEntrada } from "./MoldeDaEntrada";
import { PreviaDoConvite } from "./PreviaDoConvite";
import { useConvite } from "./useConvite";

export interface TelaDeConviteProps {
  codigo: string;
  aoEntrar: () => void;
  aoCriarConta: () => void;
}

/**
 * Um convite aberto por link ANTES de haver sessão, que é o caso comum: alguém manda
 * o link para quem ainda não tem conta.
 *
 * O código sobrevive ao login e ao cadastro (ver `destinoPendente`): esta tela só
 * mostra o servidor e leva a quem vai entrar. Quem aceita é o diálogo de dentro do
 * app, quando a sessão vale.
 */
export function TelaDeConvite({ codigo, aoEntrar, aoCriarConta }: TelaDeConviteProps) {
  const estado = useConvite(codigo);
  const t = sessao.convite;

  return (
    <MoldeDaEntrada titulo={t.titulo}>
      {estado.tipo === "procurando" && (
        <p className={css.recado} role="status" aria-busy="true">
          {t.procurando}
        </p>
      )}

      {estado.tipo === "falhou" && (
        <>
          <AvisoSimples tom="erro">{estado.motivo}</AvisoSimples>
          <Botao variante="secundario" className={css.largo} onClick={aoEntrar}>
            {t.voltar}
          </Botao>
        </>
      )}

      {estado.tipo === "pronto" && (
        <>
          <PreviaDoConvite convite={estado.convite} />
          <p className={css.recado}>{t.instrucaoSemSessao}</p>
          <div className={css.acoes}>
            <Botao className={css.largo} onClick={aoEntrar}>
              {t.entrarNaConta}
            </Botao>
            <Botao variante="fantasma" className={css.largo} onClick={aoCriarConta}>
              {t.criarConta}
            </Botao>
          </div>
        </>
      )}
    </MoldeDaEntrada>
  );
}
