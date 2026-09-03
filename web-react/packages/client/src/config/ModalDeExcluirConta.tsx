import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import {
  pedirExclusao,
  type FatorDaConta,
} from "../sdk/perfil";

const FATORES: readonly { readonly id: FatorDaConta; readonly rotulo: string }[] =
  [
    { id: "senha", rotulo: "Senha" },
    { id: "recuperacao", rotulo: "Recuperação" },
  ];

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
              <Botao variante="perigo" onClick={() => setPasso("mfa")}>
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
          <p>
            A exclusão é permanente. Mensagens, amizades e bots desta conta
            serão apagados. E-mail e nome de usuário são liberados no fim.
            Confirmar o e-mail desativa a conta agora e encerra as sessões.
            Depois disso há 7 dias para cancelar pelo mesmo link.
          </p>
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
