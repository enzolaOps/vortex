import { entrarNaChamada, sairDaChamada } from "nucleo/sdk/chamada";
import { pode } from "nucleo/sdk/permissoes";
import { fixarSalaNoCanto } from "nucleo/store/preferenciasDaSala";
import { escolherSala } from "nucleo/store/ultimoLugar";
import {
  useCanaisDeVoz,
  useCantoDaSala,
  useCanalDaChamada,
  useChannel,
  useConexao,
  useEstadoDaChamada,
  useFalantes,
  usePessoasDaSala,
  useUltimoLugar,
} from "nucleo/store/hooks";

import { salas } from "../../textos";
import { WidgetDaSala, type PessoaDaSala } from "../../ui/ds";
import css from "./Salas.module.css";

function WidgetDeUmaSala({ serverId, canalId }: { serverId: string; canalId: string }) {
  const canal = useChannel(canalId);
  const pessoas = usePessoasDaSala(serverId, canalId);
  const falantes = useFalantes(pessoas.map((p) => p.id));
  const canto = useCantoDaSala();
  const conexao = useConexao();
  const estadoDaChamada = useEstadoDaChamada();
  const aqui = useCanalDaChamada() === canalId;
  if (!canal) return null;

  const conectado = conexao === "conectado";
  const entrando = aqui && estadoDaChamada === "conectando";
  const dentro = aqui && !entrando;

  const lista: PessoaDaSala[] = pessoas.map((p) => ({
    id: p.id,
    nome: p.nome || salas.alguem,
    estado: p.estado === "tela" ? "transmitindo" : falantes.includes(p.id) ? "falando" : p.surdo ? "surdo" : p.mudo ? "mudo" : undefined,
  }));

  return (
    <WidgetDaSala
      nome={canal.name}
      pessoas={lista}
      aoVivo={pessoas.some((p) => p.estado === "tela")}
      canto={canto}
      onCanto={fixarSalaNoCanto}
      desatualizada={!conectado}
      conectando={entrando}
      // A sala nunca conecta sozinha: "Entrar" é sempre um clique, e só existe para quem pode usá-lo.
      onEntrar={
        !dentro && conectado && pode(canalId, "conectar")
          ? () => {
              void entrarNaChamada(canalId);
            }
          : undefined
      }
      onSair={
        dentro
          ? () => {
              void sairDaChamada();
            }
          : undefined
      }
    />
  );
}

/**
 * O widget da sala em foco: a última que a pessoa viu neste servidor (se ainda
 * existe) ou a primeira. Preso ao canto escolhido, dentro da camada que deixa a
 * reserva do composer livre. Sem sala de voz, não há widget.
 */
export function WidgetConectado({ serverId }: { serverId: string }) {
  const existentes = useCanaisDeVoz(serverId);
  const lembrada = useUltimoLugar(serverId).sala;
  const canalId =
    lembrada !== undefined && existentes.includes(lembrada) ? lembrada : escolherSala(serverId);
  if (canalId === undefined) return null;
  return (
    <div className={css.camadaDeWidgets}>
      <WidgetDeUmaSala key={canalId} serverId={serverId} canalId={canalId} />
    </div>
  );
}
