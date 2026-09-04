import { useState, useSyncExternalStore } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { definirApelido } from "../sdk/cargos";
import { chaveDeMembro } from "../sdk/domain";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useMembro } from "../store/hooks";
import css from "../servidores/AdicionarServidor.module.css";

/**
 * Alterar o apelido de alguém NESTE servidor.
 *
 * ⚠ **Modal e não edição in-line**, ao contrário de editar mensagem — e a
 * diferença é de quem é o texto: a mensagem é sua e está na tela, o apelido é
 * um campo de outra pessoa que não aparece em lugar nenhum como campo. Editar
 * in-line exigiria transformar o nome na member list num `input`, e aí a
 * coluna inteira vira formulário.
 *
 * ⚠ **Vazio APAGA em vez de guardar string vazia.** O protocolo distingue "sem
 * apelido" de "apelido em branco", e a segunda daria uma linha sem nome nenhum
 * na member list. Ver `definirApelido`.
 */
export function ModalDeApelido({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const apelidar = alvo?.tipo === "apelido" ? alvo : undefined;

  const membro = useMembro(
    chaveDeMembro(apelidar?.serverId ?? "", apelidar?.userId ?? ""),
  );

  /*
    Começa no apelido ATUAL e não vazio: quem abre isto quase sempre quer
    ajustar, não recomeçar. Só que o "atual" é `displayName`, que cai no
    username quando não há apelido — e aí o campo viria pré-preenchido com o
    nome global, sugerindo que ele É o apelido. Por isso a comparação.
  */
  const atual =
    membro && membro.displayName !== membro.username ? membro.displayName : "";
  const [nome, setNome] = useState(atual);
  const [salvando, setSalvando] = useState(false);

  if (!apelidar) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Alterar apelido"
        descricao={`Vale só neste servidor. ${membro?.username ?? ""} continua sendo o nome global.`}
        className={css.painel}
        rodape={
          <>
            <Botao variante="sutil" onClick={aoFechar} disabled={salvando}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              carregando={salvando}
              rotuloCarregando="Salvando…"
              onClick={() => {
                setSalvando(true);
                void definirApelido(apelidar.serverId, apelidar.userId, nome)
                  .then((ok) => {
                    if (ok) aoFechar();
                  })
                  .finally(() => setSalvando(false));
              }}
            >
              Salvar
            </Botao>
          </>
        }
      >
        <div className={css.corpo}>
          <Campo
            rotulo="Apelido"
            placeholder={membro?.username ?? "sem apelido"}
            dica="Deixe vazio para voltar ao nome global."
            autoComplete="off"
            disabled={salvando}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
