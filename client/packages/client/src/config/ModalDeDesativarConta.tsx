import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { Segmentado } from "../components/ui/Segmentado";
import { desativarConta, type FatorDaConta } from "../sdk/perfil";
import { sair } from "../sdk/autenticacao";

const FATORES: readonly { readonly id: FatorDaConta; readonly rotulo: string }[] =
  [
    { id: "senha", rotulo: "Senha" },
    { id: "recuperacao", rotulo: "Recuperação" },
  ];

/**
 * Desativar a conta (D-AUTH-31).
 *
 * ⚠ **Um passo, e o de excluir tem três.** A assimetria é o produto: desativar
 * some do app e volta ao entrar de novo, então não há consequência a explicar
 * antes nem e-mail a esperar depois. Copiar a cerimônia da exclusão faria as
 * duas parecerem a mesma coisa, que é exatamente o erro que se paga caro numa
 * zona de perigo.
 *
 * ⚠ **Sai em seguida, e não é gentileza.** O servidor derruba TODAS as sessões
 * ao desativar (`EventV1::DeleteAllSessions`); sem o `sair` o app ficaria numa
 * tela viva com um socket morto, e a pessoa só descobriria tentando escrever.
 */
export function ModalDeDesativarConta({ aoFechar }: { aoFechar: () => void }) {
  const [fator, setFator] = useState<FatorDaConta>("senha");
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Desativar conta"
        rodape={
          <>
            <Botao variante="sutil" onClick={aoFechar} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={valor.trim().length === 0 || enviando}
              carregando={enviando}
              rotuloCarregando="Desativando…"
              onClick={() => {
                setEnviando(true);
                void desativarConta(fator, valor.trim())
                  .then((ok) => {
                    setValor("");
                    if (!ok) return;
                    aoFechar();
                    void sair();
                  })
                  .finally(() => setEnviando(false));
              }}
            >
              Desativar
            </Botao>
          </>
        }
      >
        <p>
          Sua conta some do app: ninguém te encontra, seus servidores e
          conversas ficam como estão, e as sessões abertas são encerradas. Volta
          a qualquer momento ao entrar de novo — nada é apagado.
        </p>

        {/*
          O fator é pedido pelo mesmo motivo de derrubar um dispositivo: o
          protocolo exige o TICKET de MFA, e desativar é o que alguém faria com
          uma sessão roubada para tirar a dona do ar sem tocar na senha.
        */}
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
      </DialogContent>
    </Dialog>
  );
}
