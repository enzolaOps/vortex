import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Girador } from "../components/ui/Girador";
import { motivoDoErro } from "../sdk/erros";
import { linkDoQr, pedirQr, trocarQr, type PedidoDeQr } from "../sdk/qr";
import { voltarParaEntrar } from "../store/entrada";
import { CodigoQr } from "./CodigoQr";
import css from "./TelaDeLogin.module.css";
import qr from "./TelaDeQr.module.css";

/** De quanto em quanto tempo perguntar se alguém autorizou. */
const PERGUNTA_MS = 2000;

type Estado =
  | { readonly tipo: "carregando" }
  | { readonly tipo: "pronto"; readonly pedido: PedidoDeQr }
  | { readonly tipo: "entrando" }
  | { readonly tipo: "erro"; readonly motivo: string };

function restante(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Entrar com código QR — o lado do aparelho SEM sessão.
 *
 * ⚠ **O design não desenha esta tela, e a referência só desenha o botão que
 * leva a ela.** A casca é a do cadastro (cartão de 420px, sobrancelha, título,
 * instrução) porque é a mesma família de tela: um passo de entrada sem painel
 * de marca. Divergência dita no PR.
 *
 * O pedido se RENOVA sozinho quando vence: um QR esquecido na tela deixa de
 * valer em dois minutos, e a pessoa que volta encontra outro, e não um erro.
 */
export function TelaDeQr() {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  const [geracao, setGeracao] = useState(0);
  const [agora, setAgora] = useState(() => Date.now());

  /* Volta a "carregando" junto: sem isso a tela seguiria perguntando pelo
     pedido vencido enquanto o novo não chega. */
  function renovar() {
    setEstado({ tipo: "carregando" });
    setGeracao((g) => g + 1);
  }

  useEffect(() => {
    let vivo = true;
    pedirQr().then(
      (pedido) => vivo && setEstado({ tipo: "pronto", pedido }),
      (e: unknown) => vivo && setEstado({ tipo: "erro", motivo: motivoDoErro(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [geracao]);

  const pedido = estado.tipo === "pronto" ? estado.pedido : undefined;

  useEffect(() => {
    if (!pedido) return;
    let vivo = true;
    let emVoo = false;

    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    const pergunta = setInterval(() => {
      if (emVoo) return;
      if (Date.now() >= pedido.expiraEm) {
        renovar();
        return;
      }
      emVoo = true;
      trocarQr(pedido)
        .then((r) => {
          if (!vivo) return;
          if (r === "expirado") renovar();
          // `concluida`: o portão de sessão já trocou de tela; esta desmonta.
          if (r === "concluida") setEstado({ tipo: "entrando" });
        })
        .catch((e: unknown) => {
          if (vivo) setEstado({ tipo: "erro", motivo: motivoDoErro(e) });
        })
        .finally(() => {
          emVoo = false;
        });
    }, PERGUNTA_MS);

    return () => {
      vivo = false;
      clearInterval(relogio);
      clearInterval(pergunta);
    };
  }, [pedido]);

  return (
    <div className={css.tela}>
      <div className={css.cartaoDeCadastro}>
        <div className={css.sobrancelhaDoCartao}>Entrar com código QR</div>
        <h1 className={css.saudacao}>Aponte um aparelho conectado</h1>
        <p className={css.instrucao}>
          Abra a câmera num celular ou computador onde você já entrou no Vortex
          e leia o código. Só autorize lá se o número de confirmação for o
          mesmo que aparece aqui.
        </p>

        {estado.tipo === "erro" ? (
          <Banner tom="perigo" role="alert">
            {estado.motivo}
          </Banner>
        ) : null}

        <div className={qr.palco} aria-busy={estado.tipo !== "pronto"}>
          {pedido ? (
            <CodigoQr
              texto={linkDoQr(pedido.id)}
              rotulo="Código QR para entrar neste aparelho"
            />
          ) : (
            <div className={qr.vazio}>
              {estado.tipo === "erro" ? null : (
                <Girador
                  tamanho={20}
                  espessura={3}
                  rotulo={estado.tipo === "entrando" ? "Entrando" : "Gerando código"}
                />
              )}
            </div>
          )}
        </div>

        {pedido ? (
          <div className={qr.confirmacao}>
            <span className={qr.rotulo}>Confirmação</span>
            <span className={qr.codigo} aria-live="polite">
              {pedido.codigo.slice(0, 3)} {pedido.codigo.slice(3)}
            </span>
            <span className={qr.validade}>
              renova em {restante(pedido.expiraEm - agora)}
            </span>
          </div>
        ) : null}

        {estado.tipo === "erro" ? (
          <Botao variante="primario" onClick={renovar}>
            Gerar outro código
          </Botao>
        ) : null}

        <Botao variante="sutil" onClick={voltarParaEntrar}>
          Entrar com e-mail e senha
        </Botao>
      </div>
    </div>
  );
}
