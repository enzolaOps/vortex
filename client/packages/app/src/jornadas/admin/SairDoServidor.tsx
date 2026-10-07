import { usuarioLocalId } from "nucleo/sdk/adapter";
import { pessoasDoServidor } from "nucleo/sdk/cargos";
import { carregarMembros, sairDoServidor, souDono, transferirPropriedade } from "nucleo/sdk/servidores";
import { fecharConfig } from "nucleo/store/config";
import { useMembrosDoServidor, useServer } from "nucleo/store/hooks";
import { irParaCasa } from "nucleo/store/navegacao";
import { useEffect, useId, useState } from "react";

import { admin, comum } from "../../textos";
import { Botao } from "../../ui/ds";
import { toast } from "../../ui/primitivos/Avisos";
import { ConteudoDoDialogo, Dialogo } from "../../ui/primitivos/Dialogo";
import css from "./admin.module.css";
import { Confirmacao } from "./Confirmacao";

interface Props {
  serverId: string;
  aberto: boolean;
  aoMudar: (aberto: boolean) => void;
}

/** Digitar o nome do servidor: o único lugar do app onde a confirmação é exigida por escrito. */
function CampoDeConfirmacao({
  rotulo,
  nome,
  valor,
  aoMudar,
}: {
  rotulo: string;
  nome: string;
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const id = useId();
  return (
    <div className={css.campo}>
      <label className={css.rotulo} htmlFor={id}>
        {rotulo}: <strong>{nome}</strong>
      </label>
      <input
        id={id}
        className={css.entrada}
        value={valor}
        autoComplete="off"
        autoFocus
        onChange={(e) => {
          aoMudar(e.target.value);
        }}
      />
    </div>
  );
}

/** Passa a propriedade para outra pessoa do servidor. Só o novo dono pode devolvê-la. */
function Transferir({ serverId, aberto, aoMudar, aoConcluir }: Props & { aoConcluir: () => void }) {
  const servidor = useServer(serverId);
  const ids = useMembrosDoServidor(serverId);
  const eu = usuarioLocalId();
  const pessoas = pessoasDoServidor(serverId, ids).filter((p) => p.id !== eu);
  const idDoSeletor = useId();
  const [escolhida, setEscolhida] = useState<string | undefined>();
  const [digitado, setDigitado] = useState("");
  const nome = servidor?.name ?? "";
  const destino = escolhida !== undefined && pessoas.some((p) => p.id === escolhida) ? escolhida : pessoas[0]?.id;

  useEffect(() => {
    if (aberto) void carregarMembros(serverId);
  }, [aberto, serverId]);

  return (
    <Confirmacao
      aberto={aberto}
      aoMudar={(a) => {
        if (!a) setDigitado("");
        aoMudar(a);
      }}
      titulo={admin.transferir.titulo}
      texto={admin.transferir.descricao}
      confirmar={admin.transferir.confirmar}
      liberado={destino !== undefined && digitado.trim() === nome}
      aoConfirmar={async () => {
        if (destino === undefined) return false;
        const ok = await transferirPropriedade(serverId, destino);
        if (ok) {
          const quem = pessoas.find((p) => p.id === destino)?.nome ?? "";
          toast({ tipo: "info", titulo: admin.transferir.feito(quem) });
          // Quem passou a propriedade já não é dono: a pergunta de "apagar" deixou de valer.
          aoConcluir();
        }
        return ok;
      }}
    >
      {pessoas.length === 0 ? (
        <p className={css.dica}>{admin.transferir.semPessoas}</p>
      ) : (
        <>
          <div className={css.campo}>
            <label className={css.rotulo} htmlFor={idDoSeletor}>
              {admin.transferir.para}
            </label>
            <select
              id={idDoSeletor}
              className={css.entrada}
              value={destino}
              onChange={(e) => {
                setEscolhida(e.target.value);
              }}
            >
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>
          <CampoDeConfirmacao rotulo={admin.transferir.paraConfirmar} nome={nome} valor={digitado} aoMudar={setDigitado} />
        </>
      )}
    </Confirmacao>
  );
}

/**
 * Sair do servidor. Para quem é membro, é sair; para o dono é APAGAR, porque a
 * mesma chamada faz as duas coisas — então o diálogo diz qual vai acontecer, com
 * o nome do servidor por extenso, e oferece passar a propriedade antes.
 */
export function SairDoServidor({ serverId, aberto, aoMudar }: Props) {
  const servidor = useServer(serverId);
  const [digitado, setDigitado] = useState("");
  const [transferindo, setTransferindo] = useState(false);
  const dono = souDono(serverId);
  const nome = servidor?.name ?? "";
  const t = admin.sair;

  const sair = async (): Promise<boolean> => {
    // Primeiro sai da tela do servidor: o servidor some da coleção assim que a chamada volta.
    const ok = await sairDoServidor(serverId, false);
    if (!ok) return false;
    fecharConfig();
    irParaCasa();
    toast({ tipo: "info", titulo: dono ? t.apagou(nome) : t.saiu(nome) });
    return true;
  };

  if (!dono) {
    return (
      <Confirmacao
        aberto={aberto}
        aoMudar={aoMudar}
        titulo={t.tituloMembro(nome)}
        texto={t.textoMembro}
        confirmar={t.confirmarMembro}
        aoConfirmar={sair}
      />
    );
  }

  return (
    <>
      <Dialogo
        open={aberto}
        onOpenChange={(a) => {
          if (!a) setDigitado("");
          aoMudar(a);
        }}
      >
        <ConteudoDoDialogo titulo={t.tituloDono(nome)} descricao={t.textoDono}>
          <form
            className={css.formulario}
            onSubmit={(e) => {
              e.preventDefault();
              if (digitado.trim() === nome) {
                void sair().then((ok) => {
                  if (ok) aoMudar(false);
                });
              }
            }}
          >
            <div className={css.previa}>
              <div>
                <strong>{t.manter}</strong>
                <p className={css.dica}>{t.manterTexto}</p>
              </div>
              <Botao
                variante="secundario"
                tamanho="sm"
                onClick={() => {
                  setTransferindo(true);
                }}
              >
                {t.transferir}
              </Botao>
            </div>
            <CampoDeConfirmacao rotulo={t.paraConfirmar} nome={nome} valor={digitado} aoMudar={setDigitado} />
            <div className={css.rodapeDoDialogo}>
              <Botao
                variante="fantasma"
                onClick={() => {
                  aoMudar(false);
                }}
              >
                {comum.cancelar}
              </Botao>
              <Botao type="submit" variante="perigo" aria-disabled={digitado.trim() !== nome || undefined}>
                {t.confirmarDono}
              </Botao>
            </div>
          </form>
        </ConteudoDoDialogo>
      </Dialogo>
      <Transferir
        serverId={serverId}
        aberto={transferindo}
        aoMudar={setTransferindo}
        aoConcluir={() => {
          aoMudar(false);
        }}
      />
    </>
  );
}
