import { useEffect, useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import {
  ativarEmergencia,
  emergenciaVigente,
  encerrarEmergencia,
  editarPolitica,
  podeGerenciarSeguranca,
  type NivelDeVerificacao,
} from "../sdk/seguranca";
import { usePolitica } from "../store/seguranca";
import css from "./Seguranca.module.css";

const NIVEIS: readonly {
  readonly id: NivelDeVerificacao;
  readonly titulo: string;
  readonly detalhe: string;
}[] = [
  { id: "nenhum", titulo: "Nenhum", detalhe: "Sem restrição." },
  {
    id: "baixo",
    titulo: "Baixo · email verificado",
    detalhe: "Precisa ter email confirmado na conta.",
  },
  {
    id: "medio",
    titulo: "Médio · 5 minutos de conta",
    detalhe: "Bloqueia contas recém-criadas.",
  },
  {
    id: "alto",
    titulo: "Alto · 10 minutos no servidor",
    detalhe: "Só fala depois de 10 min como membro.",
  },
];

const FILTROS = [
  { id: "nao", titulo: "Não verificar", detalhe: "Nada é analisado." },
  {
    id: "semCargo",
    titulo: "Verificar membros sem cargo",
    detalhe: "Recomendado para comunidades abertas.",
  },
  {
    id: "todos",
    titulo: "Verificar todos",
    detalhe: "Inclui moderação e cargos internos.",
  },
] as const;

type Filtro = (typeof FILTROS)[number]["id"];

const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Segurança — verificação, filtro de mídia e limites de contato.
 *
 * ⚠ **Nível de verificação, contato entre membros e emergência são do fork do
 * `api`, e aplicados no SERVIDOR** — o nível no envio de mensagem (cargo
 * dispensa, como no Discord), a DM entre membros no cálculo de permissão de
 * usuário, o filtro de convites no corpo da DM e a emergência nas rotas de
 * convite, entrada e envio. Nada disto é regra de cliente: outro cliente Stoat
 * falando com o mesmo servidor encontra as mesmas recusas.
 *
 * O que continua pendente tem razão própria: telefone (não existe na conta),
 * filtro de mídia (não há analisador) e pausa automática (não há detecção de
 * pico). Os controles mostram o estado VERDADEIRO — desligado — e o clique diz
 * do que dependem.
 *
 * ⚠ **"Permitir DMs entre membros" nasce DESLIGADO, e antes nascia ligado.** A
 * versão sem back-end afirmava que ligado era o que o servidor fazia; medido no
 * `calculate_user_permissions` do Stoat, é o contrário — sem amizade, só bot
 * abre DM. O design desenha o interruptor ligado como exemplo, e o que vale
 * aqui é o que o servidor faz.
 *
 * Não confundir com "Privacidade neste servidor", que é a decisão de UMA
 * pessoa sobre o que ela recebe, guardada no cliente dela.
 */
export function Seguranca({ serverId }: { serverId: string }) {
  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }
  return <SegurancaDoServidor serverId={serverId} />;
}

function SegurancaDoServidor({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const gerencia = podeGerenciarSeguranca(serverId);
  /* O filtro de mídia é pendente: o cartão escolhido vale só enquanto a página
     está aberta, e o toast diz por quê. */
  const [filtro, setFiltro] = useState<Filtro>("nao");

  return (
    <div className={css.pagina}>
      {/*
        ⚠ **Sobrancelha e grupo são IRMÃOS, e não um `<section>` em volta dos
        dois.** O design põe as seis caixas desta página no mesmo nível; a
        semântica fica no `aria-label` de cada `radiogroup`.
      */}
      <div className={css.sobrancelha}>Nível de verificação</div>
      <div
        className={css.grupo}
        role="radiogroup"
        aria-label="Nível de verificação"
      >
        {NIVEIS.map((n) => (
          <CartaoDeOpcao
            key={n.id}
            marcado={politica.nivel === n.id}
            titulo={n.titulo}
            detalhe={n.detalhe}
            disabled={!gerencia}
            aoEscolher={() => {
              if (politica.nivel !== n.id) void editarPolitica(serverId, { nivel: n.id });
            }}
          />
        ))}
        <CartaoDeOpcao
          marcado={false}
          titulo="Muito alto · telefone verificado"
          detalhe="Reduz spam e também entrada legítima."
          selo={<Selo tom="aviso">RESTRITIVO</Selo>}
          aoEscolher={aindaNao("telefoneVerificado")}
        />
      </div>

      <div className={css.sobrancelha}>Filtro de mídia explícita</div>
      <div
        className={css.grupo}
        role="radiogroup"
        aria-label="Filtro de mídia explícita"
      >
        {FILTROS.map((f) => (
          <CartaoDeOpcao
            key={f.id}
            marcado={filtro === f.id}
            titulo={f.titulo}
            detalhe={f.detalhe}
            aoEscolher={() => {
              setFiltro(f.id);
              if (f.id !== "nao") aindaNao("filtroDeMidia")();
            }}
          />
        ))}
      </div>

      <div className={css.sobrancelha}>Contato entre membros</div>
      <div className={css.cartao}>
        <div className={css.linha}>
          <div>
            <div className={css.linhaTitulo}>Permitir DMs entre membros</div>
            <div className={css.linhaDetalhe}>
              Desligar bloqueia DM de quem não é amigo
            </div>
          </div>
          <Interruptor
            ligado={politica.dmEntreMembros}
            rotulo="Permitir DMs entre membros"
            disabled={!gerencia}
            aoAlternar={(ligado) =>
              void editarPolitica(serverId, { dmEntreMembros: ligado })
            }
          />
        </div>

        <div className={css.linha}>
          <div>
            <div className={css.linhaTitulo}>Filtrar convites em DM</div>
            <div className={css.linhaDetalhe}>
              Remove links de convite de terceiros nas DMs originadas aqui
            </div>
          </div>
          <Interruptor
            ligado={politica.filtraConvitesEmDm}
            rotulo="Filtrar convites em DM"
            disabled={!gerencia}
            aoAlternar={(ligado) =>
              void editarPolitica(serverId, { filtraConvitesEmDm: ligado })
            }
          />
        </div>

        <div className={css.linha}>
          <div>
            <div className={css.linhaTitulo}>
              Pausar convites automaticamente
            </div>
            <div className={css.linhaDetalhe}>
              Em pico anormal de entradas, pausa tudo e avisa a moderação
            </div>
          </div>
          <Interruptor
            ligado={false}
            rotulo="Pausar convites automaticamente"
            aoAlternar={aindaNao("pausaAutomatica")}
          />
        </div>
      </div>

      {gerencia ? <BannerDeEmergencia serverId={serverId} /> : null}
    </div>
  );
}

function BannerDeEmergencia({ serverId }: { serverId: string }) {
  const politica = usePolitica(serverId);
  const [ocupado, setOcupado] = useState(false);
  /*
    O relógio é ESTADO, e não `Date.now()` no render: a emergência expira
    sozinha, e o banner precisa voltar ao "Ativar" no minuto certo sem ninguém
    tocar na página. O timeout atualiza o relógio no instante do prazo; ler a
    hora no render seria impuro e não acordaria nada.
  */
  const [agora, setAgora] = useState(() => Date.now());
  const vigente = emergenciaVigente(politica, agora);
  const ate = vigente?.ateMs;

  useEffect(() => {
    if (ate === undefined) return;
    const t = setTimeout(() => setAgora(Date.now()), Math.max(0, ate - Date.now()));
    return () => clearTimeout(t);
  }, [ate]);

  const agir = (ativar: boolean) => {
    setOcupado(true);
    void (ativar ? ativarEmergencia(serverId) : encerrarEmergencia(serverId)).finally(
      () => {
        setAgora(Date.now());
        setOcupado(false);
      },
    );
  };

  if (vigente) {
    return (
      <Banner
        tom="perigo"
        titulo={`Emergência ativa até ${HORA.format(vigente.ateMs)}`}
        acoes={
          <Botao
            variante="perigoSutil"
            tamanho="pequeno"
            carregando={ocupado}
            onClick={() => agir(false)}
          >
            Encerrar
          </Botao>
        }
      >
        Convites pausados, @everyone silenciado e novas entradas congeladas.
        Tudo volta ao normal sozinho no fim do prazo.
      </Banner>
    );
  }

  return (
    <Banner
      tom="perigo"
      titulo="Ações de segurança de emergência"
      acoes={
        <Botao
          variante="perigoSutil"
          tamanho="pequeno"
          carregando={ocupado}
          onClick={() => agir(true)}
        >
          Ativar
        </Botao>
      }
    >
      {/*
        ⚠ **Sem o ⏻ do design, e é regra do `Banner`:** o glifo é decidido
        pelo TOM, nunca passado por quem chama.
      */}
      Pausa convites, silencia @everyone e congela novos membros por 1 hora.
      Registrado na auditoria.
    </Banner>
  );
}
