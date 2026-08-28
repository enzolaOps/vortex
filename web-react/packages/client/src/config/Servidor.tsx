import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { salvarServidor, sairDoServidor, souDono } from "../sdk/servidores";
import { fecharConfig } from "../store/config";
import { useServer } from "../store/hooks";
import { irParaCasa } from "../store/navegacao";
import css from "./Secao.module.css";

/**
 * Nome, descrição e a saída.
 *
 * ⚠ **A saída é a MESMA chamada para sair e para apagar**, e é o protocolo que
 * decide pelo dono: `DELETE /servers/{id}` sai para quem é membro e APAGA para
 * quem é dono. A interface tem de dizer qual das duas vai acontecer — sem
 * isso, o dono clica em "sair" e destrói o servidor de todo mundo.
 */
export function Servidor({ serverId }: { serverId: string }) {
  const servidor = useServer(serverId);
  const [nome, setNome] = useState(servidor?.name ?? "");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const dono = souDono(serverId);

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.forma}>
      <form
        className={css.bloco}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          setSalvando(true);
          void salvarServidor(serverId, nome.trim(), descricao.trim()).finally(
            () => setSalvando(false),
          );
        }}
      >
        <h2 className={css.subtitulo}>Identidade</h2>
        <Campo
          rotulo="Nome do servidor"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Campo
          rotulo="Descrição"
          dica="Aparece na prévia do convite. Pode ficar vazia."
          autoComplete="off"
          disabled={salvando}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
        <div className={css.acoes}>
          <Botao variante="primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Botao>
        </div>
      </form>

      <hr className={css.divisor} />

      <section className={css.bloco}>
        <h2 className={css.subtitulo}>{dono ? "Apagar servidor" : "Sair"}</h2>
        <p className={css.recado}>
          {dono
            ? "Você é o dono. Apagar destrói o servidor, os canais e todo o histórico, para todo mundo. Não tem como desfazer."
            : "Você sai do servidor e pode voltar por um convite novo. Nada é apagado."}
        </p>

        <div className={css.acoes}>
          {confirmando ? (
            <>
              <Botao
                variante="perigo"
                onClick={() => {
                  void sairDoServidor(serverId, false).then((ok) => {
                    if (!ok) return;
                    // Sair do servidor que estava aberto deixaria o app olhando
                    // para um lugar que não existe mais.
                    fecharConfig();
                    irParaCasa();
                  });
                }}
              >
                {dono ? "Apagar de vez" : "Sair mesmo"}
              </Botao>
              <Botao variante="sutil" onClick={() => setConfirmando(false)}>
                Cancelar
              </Botao>
            </>
          ) : (
            <Botao variante="perigo" onClick={() => setConfirmando(true)}>
              {dono ? "Apagar servidor" : "Sair do servidor"}
            </Botao>
          )}
        </div>
      </section>
    </div>
  );
}
