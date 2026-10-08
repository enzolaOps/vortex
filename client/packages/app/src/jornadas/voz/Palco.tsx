import { usuarioLocalId } from "nucleo/sdk/adapter";
import {
  useCanaisDeTexto,
  useChamada,
  useChannel,
  useFaixaDoPalcoRecolhida,
  useFalhaDeVoz,
  usePalco,
  usePessoasDaSala,
  useUltimoLugar,
} from "nucleo/store/hooks";
import { abrirConversa } from "nucleo/store/navegacao";
import { definirFaixaRecolhida } from "nucleo/store/faixaDoPalco";
import { definirPalco, fecharPalco } from "nucleo/store/palcoDeVoz";
import { abrirTexto } from "nucleo/store/ultimoLugar";
import { useId, useState } from "react";

import { voz } from "../../textos";
import { Botao } from "../../ui/ds";
import { Alerta, Mensagem, SetaEsquerda, SetaParaBaixo, SetaParaCima } from "../../ui/icones";
import { CapsulaConectada } from "./CapsulaConectada";
import { entrarComPalco, voltarDoPalco } from "./acoes";
import { LadrilhoDePessoa, LadrilhoDeTela, type PessoaDoPalco } from "./Ladrilhos";
import css from "./Palco.module.css";

type PessoaComTela = PessoaDoPalco & { readonly transmitindo: boolean };

/** O botão do cabeçalho que leva ao chat: o único aceno ao texto dentro do palco. */
/** Numa DM ou grupo o chat é a própria conversa: o botão volta para ela, sem escolher canal. */
function BotaoDaConversa({ canalId }: { canalId: string }) {
  const canal = useChannel(canalId);
  if (!canal) return null;
  const novas = canal.silenciado ? 0 : canal.naoLidas;
  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      icone={<Mensagem />}
      aria-label={`${voz.palco.abrirChat}, ${canal.name}${novas > 0 ? `, ${String(novas)} ${novas === 1 ? "nova" : "novas"}` : ""}`}
      onClick={() => {
        fecharPalco();
        abrirConversa(canalId);
      }}
    >
      {novas > 0 ? `${canal.name} · ${String(novas)} ${novas === 1 ? "nova" : "novas"}` : canal.name}
    </Botao>
  );
}

function BotaoDoChat({ serverId }: { serverId: string }) {
  const lembrado = useUltimoLugar(serverId).texto;
  const canais = useCanaisDeTexto(serverId);
  const id = lembrado !== undefined && canais.includes(lembrado) ? lembrado : canais[0];
  const canal = useChannel(id ?? "");
  if (id === undefined || !canal) return null;
  const novas = canal.silenciado ? 0 : canal.naoLidas;
  return (
    <Botao
      variante="secundario"
      tamanho="sm"
      icone={<Mensagem />}
      aria-label={`${voz.palco.abrirChat}, ${canal.name}${novas > 0 ? `, ${String(novas)} ${novas === 1 ? "nova" : "novas"}` : ""}`}
      onClick={() => {
        fecharPalco();
        abrirTexto(serverId, id);
      }}
    >
      {novas > 0 ? `${canal.name} · ${String(novas)} ${novas === 1 ? "nova" : "novas"}` : canal.name}
    </Botao>
  );
}

function Fora({ canalId, nome }: { canalId: string; nome: string }) {
  const [entrando, setEntrando] = useState(false);
  return (
    <div className={css.centro} data-testid="palco-fora">
      <span className={css.iconeRedondo} aria-hidden="true">
        <SetaEsquerda tamanho={20} />
      </span>
      <h2 className={css.centroTitulo}>{voz.conexao.foraTitulo(nome)}</h2>
      <p className={css.centroTexto}>{voz.conexao.foraTexto}</p>
      <Botao
        carregando={entrando}
        onClick={() => {
          setEntrando(true);
          void entrarComPalco(canalId).finally(() => {
            setEntrando(false);
          });
        }}
      >
        {voz.conexao.entrarNaSala}
      </Botao>
    </div>
  );
}

function Falha({ canalId, nome, motivo }: { canalId: string; nome: string; motivo: string }) {
  const titulo = useId();
  const texto = useId();
  const [tentando, setTentando] = useState(false);
  return (
    <div role="alertdialog" aria-labelledby={titulo} aria-describedby={texto} className={css.falha}>
      <span className={css.iconeDeErro} aria-hidden="true">
        <Alerta tamanho={20} />
      </span>
      <div>
        <h2 id={titulo} className={css.centroTitulo}>
          {voz.conexao.falhouTitulo(nome)}
        </h2>
        <p id={texto} className={css.centroTexto}>
          {motivo || voz.conexao.falhouGenerico}
        </p>
      </div>
      <div className={css.acoesDaFalha}>
        <Botao variante="fantasma" onClick={voltarDoPalco}>
          {voz.conexao.voltar}
        </Botao>
        <Botao
          autoFocus
          carregando={tentando}
          onClick={() => {
            setTentando(true);
            void entrarComPalco(canalId).finally(() => {
              setTentando(false);
            });
          }}
        >
          {voz.conexao.tentarDeNovo}
        </Botao>
      </div>
    </div>
  );
}

/**
 * O palco de uma sala de voz: a área principal inteira, sem coluna à direita e
 * sem chat. Tem seis aparências, e só uma delas por vez:
 *
 * - **conectando**: as pessoas que já se sabe que estão na sala, esmaecidas;
 * - **dentro**: transmissão em foco + tira de pessoas, ou a grade;
 * - **reconectando**: faixa de aviso e o conteúdo congelado (esmaecido);
 * - **falhou**: o painel com o motivo e "Tentar de novo" (a pessoa NÃO aparece
 *   como dentro);
 * - **fora**: "você não está na sala", com "Entrar".
 *
 * Nada aqui assina "quem está falando": cada ladrilho assina a si mesmo.
 */
export function PalcoDaSala({ serverId, canalId }: { serverId: string; canalId: string }) {
  const canal = useChannel(canalId);
  const chamada = useChamada();
  const palco = usePalco();
  const falha = useFalhaDeVoz();
  const brutas = usePessoasDaSala(serverId, canalId);
  const [emGrade, setEmGrade] = useState(false);
  const recolhida = useFaixaDoPalcoRecolhida();
  const idDaTira = useId();
  const eu = usuarioLocalId();
  const nome = canal?.name ?? voz.sala;

  const falhou = falha !== undefined && falha.channelId === canalId;
  const naSala = chamada.estado !== "fora" && chamada.channelId === canalId;
  const estado = falhou ? "falhou" : naSala ? chamada.estado : "fora";

  const pessoas: PessoaComTela[] = brutas.map((p) => ({
    id: p.id,
    nome: p.nome,
    avatarUrl: p.avatarUrl,
    mudo: p.mudo,
    surdo: p.surdo,
    camera: p.id === eu ? chamada.camera : chamada.comCamera.includes(p.id),
    proprio: p.id === eu,
    transmitindo: p.estado === "tela",
  }));
  const transmissores = pessoas.filter((p) => p.transmitindo);

  const focoId =
    palco.tipo === "assistindo"
      ? palco.userId
      : palco.tipo === "transmitindo"
        ? eu
        : emGrade
          ? undefined
          : (transmissores.find((p) => !p.proprio) ?? transmissores[0])?.id;
  const foco = estado === "dentro" || estado === "reconectando" ? transmissores.find((p) => p.id === focoId) : undefined;

  const quem = transmissores[0];
  const subtitulo = [
    voz.palco.pessoas(pessoas.length),
    quem ? voz.palco.aoVivo(quem.proprio ? voz.palco.voce : quem.nome) : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  const comConteudo = estado === "conectando" || estado === "dentro" || estado === "reconectando" || estado === "falhou";

  return (
    <section className={css.palco} aria-label={voz.palco.rotulo(nome)} data-testid="palco" data-estado={estado}>
      <div className={css.cabecalho}>
        <div className={css.nome}>
          <h2 className={css.titulo}>{nome}</h2>
          {estado !== "fora" && <span className={css.subtitulo}>{subtitulo}</span>}
        </div>
        <div className={css.acoes}>
          {transmissores.length > 0 && (estado === "dentro" || estado === "reconectando") && (
            <Botao
              variante="fantasma"
              tamanho="sm"
              onClick={() => {
                if (foco) {
                  setEmGrade(true);
                  definirPalco({ tipo: "grade" });
                } else {
                  setEmGrade(false);
                }
              }}
            >
              {foco ? voz.palco.verEmGrade : voz.palco.verEmFoco}
            </Botao>
          )}
          {serverId === "" ? <BotaoDaConversa canalId={canalId} /> : <BotaoDoChat serverId={serverId} />}
        </div>
      </div>

      {estado === "reconectando" && (
        <div role="status" className={css.reconectando}>
          <Alerta tamanho={16} />
          <span>{voz.conexao.reconectando}</span>
          <span className={css.reconectandoDetalhe}>{voz.conexao.reconectandoDetalhe}</span>
        </div>
      )}

      {comConteudo && (
        <div
          className={css.conteudo}
          data-congelado={estado === "reconectando"}
          data-conectando={estado === "conectando" || estado === "falhou"}
          // Durante a falha o painel por cima é quem fala; o resto fica esmaecido e fora do alcance.
          data-falhou={estado === "falhou" || undefined}
          inert={estado === "falhou" || undefined}
        >
          {(estado === "conectando" || estado === "falhou") && (
            <>
              {estado === "conectando" && (
                <div role="status" className={css.conectandoTitulo}>
                  <span className={css.pontos} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                  {voz.conexao.conectandoASala}
                </div>
              )}
              <div className={css.conectandoLista}>
                {pessoas.map((p) => (
                  <LadrilhoDePessoa key={p.id} pessoa={p} />
                ))}
              </div>
            </>
          )}

          {(estado === "dentro" || estado === "reconectando") && foco && (
            <>
              <div className={css.foco}>
                <LadrilhoDeTela pessoa={foco} papel="foco" />
              </div>
              <div className={css.faixa} data-recolhida={recolhida || undefined} data-testid="faixa-do-palco">
                <Botao
                  variante="fantasma"
                  tamanho="sm"
                  className={css.recolher}
                  icone={recolhida ? <SetaParaCima /> : <SetaParaBaixo />}
                  aria-expanded={!recolhida}
                  aria-controls={idDaTira}
                  data-testid="recolher-faixa"
                  onClick={() => {
                    definirFaixaRecolhida(!recolhida);
                  }}
                >
                  {recolhida ? voz.palco.expandirFaixa : voz.palco.recolherFaixa}
                </Botao>
                {/* Recolhida, nada monta: nenhuma miniatura, nenhuma assinatura de vídeo. */}
                {!recolhida && (
                  <div id={idDaTira} className={css.tira} data-testid="tira-do-palco">
                    {pessoas
                      .filter((p) => p.id !== foco.id)
                      .map((p) => (
                        <LadrilhoDePessoa key={p.id} pessoa={p} papel="miniatura" />
                      ))}
                    {transmissores
                      .filter((p) => p.id !== foco.id)
                      .map((p) => (
                        <LadrilhoDeTela
                          key={`tela-${p.id}`}
                          pessoa={p}
                          papel="miniatura"
                          aoAssistir={() => {
                            setEmGrade(false);
                            definirPalco({ tipo: "assistindo", userId: p.id });
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
            </>
          )}

          {(estado === "dentro" || estado === "reconectando") && !foco && (
            <div className={css.grade} role="list" aria-label={voz.palco.grade} data-testid="grade-do-palco">
              {pessoas.map((p) => (
                <div role="listitem" key={p.id} className={css.itemDaGrade}>
                  <LadrilhoDePessoa pessoa={p} />
                </div>
              ))}
              {transmissores.map((p) => (
                <div role="listitem" key={`tela-${p.id}`} className={css.itemDaGrade}>
                  <LadrilhoDeTela
                    pessoa={p}
                    papel="grade"
                    aoAssistir={() => {
                      setEmGrade(false);
                      definirPalco({ tipo: "assistindo", userId: p.id });
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {estado === "fora" && <Fora canalId={canalId} nome={nome} />}
      {estado === "falhou" && falha && <Falha canalId={canalId} nome={nome} motivo={falha.motivo} />}

      {(estado === "conectando" || estado === "dentro" || estado === "reconectando") && (
        <div className={css.capsulaNoPalco}>
          <CapsulaConectada nomeDaSala={nome} pessoas={brutas} />
        </div>
      )}
    </section>
  );
}
