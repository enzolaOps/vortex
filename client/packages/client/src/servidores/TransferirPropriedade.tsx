import { useState, useSyncExternalStore } from "react";

import { Avatar } from "../components/ui/Avatar";
import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { Dialog, DialogContent } from "../components/ui/Dialog";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { chaveDeMembro } from "../sdk/domain";
import { fecharConfig } from "../store/config";
import { transferirPropriedade } from "../sdk/servidores";
import { useMembro, useMembrosDoServidor, useServer } from "../store/hooks";
import css from "./TransferirPropriedade.module.css";

/**
 * Passar o servidor para outra pessoa.
 *
 * ⚠ **É a única ação deste app que pede o nome digitado, e a assimetria é
 * deliberada.** Apagar um canal não pede — canal se recria. Propriedade não se
 * retoma: depois de confirmar, quem era dono perde o poder de desfazer, e só o
 * novo dono pode devolver. O atrito existe onde o erro não tem volta.
 *
 * ⚠ **Duas escolhas, não uma.** Quem recebe E a confirmação. Um seletor
 * sozinho transferiria no clique errado da lista; um campo sozinho não diz
 * para quem. As duas juntas fazem o gesto exigir intenção nos dois eixos.
 */
export function TransferirPropriedade({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  const serverId = alvo?.tipo === "transferirPropriedade" ? alvo.serverId : "";
  const servidor = useServer(serverId);
  const membros = useMembrosDoServidor(serverId);

  const [escolhido, setEscolhido] = useState<string | undefined>(undefined);
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);

  const nome = servidor?.name ?? "";
  /*
    Comparação exata, sem `trim` nem caixa: o campo existe para ser um segundo
    ato consciente, e afrouxá-lo o transformaria numa formalidade que se
    preenche sem ler.
  */
  const confere = nome !== "" && confirmacao === nome;
  const pode = escolhido !== undefined && confere && !enviando;

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent
        titulo="Transferir propriedade"
        className={css.painel}
        rodape={
          <>
            <Botao variante="sutil" onClick={aoFechar} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao
              variante="perigo"
              disabled={!pode}
              carregando={enviando}
              rotuloCarregando="Transferindo…"
              onClick={() => {
                if (!escolhido || !confere) return;
                setEnviando(true);
                void transferirPropriedade(serverId, escolhido)
                  .then((ok) => {
                    if (!ok) return;
                    /*
                      As configurações do servidor são de quem o administra, e
                      quem acabou de transferir deixou de ser. Ficar na tela
                      mostraria alvos que o servidor vai passar a recusar.
                    */
                    fecharConfig();
                    aoFechar();
                  })
                  .finally(() => setEnviando(false));
              }}
            >
              Transferir
            </Botao>
          </>
        }
      >
        <div className={css.corpo}>
          <p className={css.aviso}>
            Quem receber passa a poder apagar o servidor, editar todos os cargos
            e remover você. <strong>Você deixa de ser dono na hora</strong>, e
            só o novo dono pode devolver.
          </p>

          {membros.length === 0 ? (
            <EstadoVazio
              titulo="Ninguém para receber"
              detalhe="Um servidor com uma pessoa só não tem para quem transferir."
            />
          ) : (
            <>
              <p className={css.rotulo}>Quem recebe</p>
              {/*
                `radiogroup` e não uma lista de botões: são opções mutuamente
                exclusivas, e é o papel que faz as setas do teclado andarem
                entre elas sem Tab em cada uma.
              */}
              <div className={css.lista} role="radiogroup" aria-label="Quem recebe">
                {membros.map((userId) => (
                  <Candidato
                    key={userId}
                    serverId={serverId}
                    userId={userId}
                    escolhido={userId === escolhido}
                    aoEscolher={() => setEscolhido(userId)}
                  />
                ))}
              </div>

              <Campo
                rotulo={`Digite ${nome} para confirmar`}
                value={confirmacao}
                onChange={(e) => setConfirmacao(e.currentTarget.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Uma pessoa na lista.
 *
 * Componente próprio porque assina o PRÓPRIO membro — a mesma razão de
 * `NomeDoAutor` e `AvatarDoAutor`. Numa lista de mil pessoas, assinar todas no
 * pai faria alguém trocar de apelido re-renderizar a lista inteira.
 */
function Candidato({
  serverId,
  userId,
  escolhido,
  aoEscolher,
}: {
  serverId: string;
  userId: string;
  escolhido: boolean;
  aoEscolher: () => void;
}) {
  const membro = useMembro(chaveDeMembro(serverId, userId));
  const nome = membro?.displayName ?? "…";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={escolhido}
      className={css.candidato}
      onClick={aoEscolher}
    >
      <Avatar id={userId} sigla={membro?.sigla} url={membro?.avatarUrl} />
      <span className={css.candidatoNome}>{nome}</span>
    </button>
  );
}
