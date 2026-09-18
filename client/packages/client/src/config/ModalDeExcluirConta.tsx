import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import {
  pedirExclusao,
  servidoresQueEuDono,
  type FatorDaConta,
} from "../sdk/perfil";
import { administrar } from "../store/administracao";
import css from "./ModalDeExcluirConta.module.css";

const FATORES: readonly { readonly id: FatorDaConta; readonly rotulo: string }[] =
  [
    { id: "senha", rotulo: "Senha" },
    { id: "recuperacao", rotulo: "Recuperação" },
  ];

/**
 * "Você é dona de 2 servidores" — o número por extenso, no singular certo.
 *
 * A frase do design conta, e contar é o que a torna útil: "de servidores que
 * você administra" não diz se é um ou sete, e é a diferença entre um clique e
 * uma tarde.
 */
function tituloDaPosse(quantos: number): string {
  return quantos === 1
    ? "Você é dona de 1 servidor"
    : `Você é dona de ${String(quantos)} servidores`;
}

/**
 * Um modal, três passos: consequências, senha/MFA, e-mail enviado.
 *
 * Sem modal empilhado. MFA é o segundo passo deste mesmo diálogo.
 */
export function ModalDeExcluirConta({ aoFechar }: { aoFechar: () => void }) {
  const [passo, setPasso] = useState<"aviso" | "mfa" | "enviado">("aviso");
  const [fator, setFator] = useState<FatorDaConta>("senha");
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);

  /*
    Lido uma vez, na abertura.

    A posse muda por ação de quem está olhando — transferir, sair, criar — e
    todas essas fecham este modal antes de acontecerem. Assinar o store de
    servidores para uma lista que não pode mudar enquanto ela está na tela
    seria custo sem consequência.
  */
  const [meusServidores] = useState(() => servidoresQueEuDono());
  const bloqueada = meusServidores.length > 0;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo={
          passo === "enviado" ? "Confira seu e-mail" : "Excluir minha conta"
        }
        rodape={
          passo === "enviado" ? (
            <Botao variante="primario" onClick={aoFechar}>
              Entendi
            </Botao>
          ) : passo === "aviso" ? (
            <>
              <Botao variante="sutil" onClick={aoFechar}>
                Cancelar
              </Botao>
              <Botao
                variante="perigo"
                /*
                  ⚠ **O bloqueio é aqui, e ANTES ele era no botão que abre o
                  modal.** Com "Excluir minha conta" desabilitado na página,
                  quem é dona de um servidor lia a frase e não tinha para onde
                  ir: a lista de quais servidores e o caminho para transferir
                  ficavam do outro lado de uma porta trancada. O modal abre,
                  diz quais são e dá o botão de cada um.
                */
                disabled={bloqueada}
                onClick={() => setPasso("mfa")}
              >
                Continuar
              </Botao>
            </>
          ) : (
            <>
              <Botao
                variante="sutil"
                disabled={enviando}
                onClick={() => {
                  setValor("");
                  setPasso("aviso");
                }}
              >
                Voltar
              </Botao>
              <Botao
                variante="perigo"
                disabled={valor.trim().length === 0 || enviando}
                carregando={enviando}
                rotuloCarregando="Enviando…"
                onClick={() => {
                  setEnviando(true);
                  void pedirExclusao(fator, valor.trim())
                    .then((ok) => {
                      if (ok) {
                        setValor("");
                        setPasso("enviado");
                      }
                    })
                    .finally(() => setEnviando(false));
                }}
              >
                Enviar confirmação
              </Botao>
            </>
          )
        }
      >
        {passo === "aviso" ? (
          <>
            <p>
              A exclusão é permanente. Mensagens, amizades e bots desta conta
              serão apagados. E-mail e nome de usuário são liberados no fim.
              Confirmar o e-mail desativa a conta agora e encerra as sessões.
              Depois disso há 7 dias para cancelar pelo mesmo link.
            </p>

            {bloqueada ? (
              <>
                <Banner tom="aviso" titulo={tituloDaPosse(meusServidores.length)}>
                  Transfira ou exclua antes de continuar — eles não são
                  apagados junto com a conta.
                </Banner>
                <ul className={css.servidores}>
                  {meusServidores.map((s) => (
                    <li key={s.id} className={css.servidor}>
                      <span className={css.nome}>{s.nome}</span>
                      {/*
                        ⚠ **Abrir a transferência FECHA este modal**, e é a
                        regra do registro: um modal por vez, porque pilha de
                        véus é a tela onde `Esc` fecha um e ninguém sabe qual.
                        `administrar` já troca o modal aberto — depois de
                        transferir, quem quiser excluir reabre daqui.
                      */}
                      <Botao
                        variante="sutil"
                        tamanho="pequeno"
                        onClick={() =>
                          administrar({
                            tipo: "transferirPropriedade",
                            serverId: s.id,
                          })
                        }
                      >
                        Transferir
                      </Botao>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : passo === "mfa" ? (
          <>
            <Segmentado
              rotulo="Como confirmar"
              valor={fator}
              opcoes={FATORES}
              aoEscolher={(id) => {
                setFator(id);
                setValor("");
              }}
              desabilitado={enviando}
            />
            <Campo
              rotulo={fator === "senha" ? "Senha atual" : "Código de recuperação"}
              type={fator === "senha" ? "password" : "text"}
              autoComplete={fator === "senha" ? "current-password" : "off"}
              dica={
                fator === "senha"
                  ? "A mesma senha da conta."
                  : "Um dos códigos guardados ao ativar a verificação. Cada um serve uma vez."
              }
              disabled={enviando}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </>
        ) : (
          <Banner tom="aviso">
            Enviamos um link para o e-mail da conta. Abrir o link não apaga
            nada — a exclusão só acontece se você confirmar na tela.
          </Banner>
        )}
      </DialogContent>
    </Dialog>
  );
}
