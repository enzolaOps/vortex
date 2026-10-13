import { motivoDoErro } from "nucleo/sdk/erros";
import { salvarPoliticaDeMidia } from "nucleo/sdk/filtroDeMidia";
import {
  ativarEmergencia,
  carregarPolitica,
  editarPolitica,
  emergenciaVigente,
  encerrarEmergencia,
  podeGerenciarSeguranca,
} from "nucleo/sdk/seguranca";
import { definirPolitica, lerPolitica, type PoliticaDeMidia } from "nucleo/store/filtroDeMidia";
import { usePoliticaDeMidia } from "nucleo/store/hooks";
import { usePolitica } from "nucleo/store/seguranca";
import { toast as avisar } from "nucleo/ui-logica/toastStore";
import { useEffect, useState } from "react";

import { admin } from "../../textos";
import { Botao } from "../../ui/ds";
import {
  Bloco,
  Divisor,
  estilosDeConfig as ec,
  GrupoDeOpcoes,
  Interruptor,
  LinhaDeAjuste,
  Opcao,
  Pagina,
} from "../config/controles";
import { Confirmacao } from "./Confirmacao";
import { Carregando, Falhou } from "./Estados";
import css from "./Seguranca.module.css";

const t = admin.segurancaPagina;

const HORA = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Carga = { readonly para: string; readonly revisao: number; readonly ok: boolean };

/**
 * Segurança (PRD 4.7): nível de verificação, filtro de mídia, contato entre
 * membros e o modo de emergência.
 *
 * Os quatro estados: carregando e erro são desta página; "vazio" não existe
 * (toda regra tem um valor, e o padrão é o comportamento sem restrição); e
 * "sem permissão" é a seção AUSENTE da navegação — a casca já leva quem abrir
 * o endereço direto para outra seção, e o ramo daqui é só o cinto.
 */
export function Seguranca({ serverId }: { serverId: string }) {
  const [revisao, setRevisao] = useState(0);
  const [carga, setCarga] = useState<Carga | undefined>();

  useEffect(() => {
    let vivo = true;
    void carregarPolitica(serverId).then((ok) => {
      if (vivo) setCarga({ para: serverId, revisao, ok });
    });
    return () => {
      vivo = false;
    };
  }, [serverId, revisao]);

  if (!podeGerenciarSeguranca(serverId)) {
    return (
      <Pagina>
        <p className={ec.texto}>{admin.semAcesso.texto}</p>
      </Pagina>
    );
  }

  const atual = carga?.para === serverId && carga.revisao === revisao ? carga : undefined;
  if (atual === undefined) {
    return (
      <Pagina>
        <Carregando texto={t.carregando} />
      </Pagina>
    );
  }
  if (!atual.ok) {
    return (
      <Pagina>
        <Falhou
          texto={t.erro}
          aoTentar={() => {
            setRevisao((r) => r + 1);
          }}
        />
      </Pagina>
    );
  }
  return <Politicas serverId={serverId} />;
}

function Politicas({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const filtro = usePoliticaDeMidia(serverId);

  /* Otimista: responde no clique e, se o servidor recusar, devolve o que era
     e diz o motivo — um filtro que parece ligado e não está é exatamente a
     proteção falsa que esta página evita. */
  const escolherFiltro = (novo: PoliticaDeMidia) => {
    const antes = lerPolitica(serverId);
    if (antes === novo) return;
    definirPolitica(serverId, novo);
    salvarPoliticaDeMidia(serverId, novo).catch((e: unknown) => {
      definirPolitica(serverId, antes);
      avisar({ tipo: "erro", titulo: t.filtroFalhou, descricao: motivoDoErro(e) });
    });
  };

  return (
    <Pagina>
      <Bloco>
        <h3 className={ec.titulo}>{t.nivel}</h3>
        <GrupoDeOpcoes rotulo={t.nivel} emColuna>
          {t.niveis.map((n) => (
            <Opcao
              key={n.id}
              marcada={politica.nivel === n.id}
              descricao={n.detalhe}
              aoEscolher={() => {
                if (politica.nivel !== n.id) void editarPolitica(serverId, { nivel: n.id });
              }}
            >
              {n.titulo}
            </Opcao>
          ))}
        </GrupoDeOpcoes>
      </Bloco>

      <Divisor />

      <Bloco>
        <h3 className={ec.titulo}>{t.filtro}</h3>
        <GrupoDeOpcoes rotulo={t.filtro} emColuna>
          {t.filtros.map((f) => (
            <Opcao
              key={f.id}
              marcada={filtro === f.id}
              descricao={f.detalhe}
              aoEscolher={() => {
                escolherFiltro(f.id);
              }}
            >
              {f.titulo}
            </Opcao>
          ))}
        </GrupoDeOpcoes>
      </Bloco>

      <Divisor />

      <Bloco>
        <h3 className={ec.titulo}>{t.contato}</h3>
        <LinhaDeAjuste nome={t.dm} descricao={t.dmDica}>
          <Interruptor
            rotulo={t.dm}
            ligado={politica.dmEntreMembros}
            aoMudar={(ligado) => {
              void editarPolitica(serverId, { dmEntreMembros: ligado });
            }}
          />
        </LinhaDeAjuste>
        <LinhaDeAjuste nome={t.convitesEmDm} descricao={t.convitesEmDmDica}>
          <Interruptor
            rotulo={t.convitesEmDm}
            ligado={politica.filtraConvitesEmDm}
            aoMudar={(ligado) => {
              void editarPolitica(serverId, { filtraConvitesEmDm: ligado });
            }}
          />
        </LinhaDeAjuste>
      </Bloco>

      <Divisor />

      <Emergencia serverId={serverId} />
    </Pagina>
  );
}

function Emergencia({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const [ocupado, setOcupado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  /*
    O relógio é ESTADO e não `Date.now()` no render: a emergência expira
    sozinha, e o bloco precisa voltar a "desligado" no instante do prazo sem
    ninguém tocar na página.
  */
  const [agora, setAgora] = useState(() => Date.now());
  const vigente = emergenciaVigente(politica, agora);
  const ate = vigente?.ateMs;

  useEffect(() => {
    if (ate === undefined) return;
    const timer = setTimeout(
      () => {
        setAgora(Date.now());
      },
      Math.max(0, ate - Date.now()) + 50,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [ate]);

  const encerrar = async () => {
    setOcupado(true);
    await encerrarEmergencia(serverId);
    setAgora(Date.now());
    setOcupado(false);
  };

  return (
    <Bloco>
      <h3 className={ec.titulo}>{t.emergencia}</h3>
      <LinhaDeAjuste nome={t.emergenciaTitulo} descricao={vigente ? t.emergenciaEfeitos : t.emergenciaDica}>
        <Interruptor
          rotulo={t.emergenciaTitulo}
          ligado={vigente !== undefined}
          disabled={ocupado}
          aoMudar={(ligado) => {
            if (ligado) setConfirmando(true);
            else void encerrar();
          }}
        />
      </LinhaDeAjuste>
      {vigente !== undefined && (
        <div className={css.faixa} role="status" data-testid="emergencia-ativa">
          <span>{t.emergenciaAtiva(HORA.format(vigente.ateMs))}</span>
          <Botao
            variante="secundario"
            tamanho="sm"
            carregando={ocupado}
            onClick={() => {
              void encerrar();
            }}
          >
            {t.encerrar}
          </Botao>
        </div>
      )}
      <Confirmacao
        aberto={confirmando}
        aoMudar={setConfirmando}
        titulo={t.confirmarTitulo}
        texto={t.confirmarTexto}
        confirmar={t.confirmarAcao}
        aoConfirmar={async () => {
          const ok = await ativarEmergencia(serverId);
          setAgora(Date.now());
          return ok;
        }}
      />
    </Bloco>
  );
}
