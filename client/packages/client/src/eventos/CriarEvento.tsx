import { useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { Dialog, DialogClose, DialogContent } from "../components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/DropdownMenu";
import {
  CaretDown,
  Hash,
  LinkSimple,
  SpeakerHigh,
  X,
} from "../components/ui/icones";
import { Interruptor } from "../components/ui/Interruptor";
import { toast } from "../components/ui/toastStore";
import { aindaNao } from "../pendente/pendencias";
import { usuarioLocalId } from "../sdk/adapter";
import { subirAnexo } from "../sdk/anexos";
import {
  canaisParaEventos,
  criarEvento,
  editarEvento,
  intervaloDoFormulario,
  lerEvento,
  lerRelogio,
  quandoLongo,
  siglaDoFuso,
  textosDe,
  type CanalDoEvento,
  type EventoDoServidor,
  type Fuso,
  type Repeticao,
} from "../sdk/eventos";
import { assinarAlvo, lerAlvo } from "../store/administracao";
import { useServer } from "../store/hooks";
import css from "./CriarEvento.module.css";

/** O teto da descrição — o número do design ("0 / 300"). O servidor aceita 1000. */
const LIMITE_DA_DESCRICAO = 300;

type TipoDeLocal = "voz" | "texto" | "externo";

const PASSOS = ["Onde", "Quando", "Detalhes"] as const;

const REPETICOES_DO_FORMULARIO: readonly {
  readonly valor: Repeticao | undefined;
  readonly rotulo: string;
}[] = [
  { valor: undefined, rotulo: "Não repete" },
  { valor: "semanal", rotulo: "Semanal" },
  { valor: "quinzenal", rotulo: "A cada 2 semanas" },
  { valor: "mensal", rotulo: "Mensal" },
];

/** O selo da prévia — minúsculo, como o design escreve ("semanal"). */
const SELO_DA_REPETICAO: Record<Repeticao, string> = {
  semanal: "semanal",
  quinzenal: "a cada 2 semanas",
  mensal: "mensal",
};

/** "https://…" com host — o resto não é link que se abra. */
function urlValida(texto: string): boolean {
  try {
    const u = new URL(texto.trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.host !== "";
  } catch {
    return false;
  }
}

/** "São Paulo" de "America/Sao_Paulo" — o rótulo do fuso local. */
function cidadeDoFuso(): string {
  try {
    const zona = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zona.split("/").pop()?.replace(/_/g, " ") ?? "local";
  } catch {
    return "local";
  }
}

/**
 * Criar evento — `CreateEventWizard` da referência, com os valores do
 * `Vortex Eventos e Entrada.dc.html`, seção 1.
 *
 * Três passos porque o tipo de local muda os campos seguintes: link externo
 * pede URL e horário de fim obrigatório. Voltar não perde nada — o estado é
 * um só para os três —, e a prévia ao lado muda a cada tecla, inclusive no
 * passo 1, ainda sem título.
 *
 * O mesmo formulário edita: com `eventoId` no alvo, os campos nascem do
 * evento e o último botão diz "Salvar".
 */
export function CriarEvento({ aoFechar }: { aoFechar: () => void }) {
  const alvo = useSyncExternalStore(assinarAlvo, lerAlvo);
  if (alvo?.tipo !== "evento") return null;
  return (
    <Formulario
      key={alvo.eventoId ?? "novo"}
      serverId={alvo.serverId}
      evento={alvo.eventoId ? lerEvento(alvo.eventoId) : undefined}
      aoFechar={aoFechar}
    />
  );
}

function Formulario({
  serverId,
  evento,
  aoFechar,
}: {
  serverId: string;
  evento: EventoDoServidor | undefined;
  aoFechar: () => void;
}) {
  const servidor = useServer(serverId);
  /* Leitura única: ver `canaisParaEventos`. */
  const [canais] = useState(() => canaisParaEventos(serverId));

  const [inicial] = useState(() => valoresIniciais(evento, canais));
  const [passo, setPasso] = useState(1);
  const [tipo, setTipo] = useState<TipoDeLocal>(inicial.tipo);
  const [canalId, setCanalId] = useState(inicial.canalId);
  const [url, setUrl] = useState(inicial.url);
  const [data, setData] = useState(inicial.data);
  const [hora, setHora] = useState(inicial.hora);
  const [fim, setFim] = useState(inicial.fim);
  const [fuso, setFuso] = useState<Fuso>("local");
  const [repeticao, setRepeticao] = useState<Repeticao | undefined>(evento?.repeticao);
  const [lembrar, setLembrar] = useState(evento?.lembrar ?? true);
  const [nome, setNome] = useState(evento?.nome ?? "");
  const [descricao, setDescricao] = useState(evento?.descricao ?? "");
  const [capa, setCapa] = useState<File | undefined>(undefined);
  const [erro, setErro] = useState<string | undefined>(undefined);
  const [salvando, setSalvando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  const listaDoTipo = tipo === "voz" ? canais.voz : canais.texto;
  const canal = listaDoTipo.find((c) => c.id === canalId) ?? listaDoTipo[0];
  const intervalo = intervaloDoFormulario(data, hora, fim, fuso, tipo === "externo");
  const siglaLocal = siglaDoFuso(lerRelogio()) ?? "Local";
  const rotuloDoFuso: Record<Fuso, string> = {
    local: `${siglaLocal} · ${cidadeDoFuso()}`,
    utc: "UTC",
  };

  /** O que impede de sair do passo atual — ou nada. */
  function bloqueio(n: number): string | undefined {
    if (n === 1) {
      if (tipo === "externo") return urlValida(url) ? undefined : "Informe um link http ou https.";
      return canal ? undefined : `Este servidor não tem canal de ${tipo === "voz" ? "voz" : "texto"}.`;
    }
    if (n === 2) return intervalo.ok ? undefined : intervalo.erro;
    return nome.trim() === "" ? "Dê um nome ao evento." : undefined;
  }

  function trocarTipo(novo: TipoDeLocal) {
    setTipo(novo);
    setErro(undefined);
    const lista = novo === "voz" ? canais.voz : novo === "texto" ? canais.texto : [];
    if (lista.length > 0 && !lista.some((c) => c.id === canalId)) setCanalId(lista[0]!.id);
  }

  async function avancar() {
    const motivo = bloqueio(passo);
    if (motivo) {
      setErro(motivo);
      return;
    }
    setErro(undefined);
    if (passo < 3) {
      setPasso(passo + 1);
      return;
    }
    /* Todos os passos, não só o último: voltar e mudar o tipo pode ter
       invalidado um anterior sem a pessoa passar por ele de novo. */
    for (const n of [1, 2] as const) {
      const anterior = bloqueio(n);
      if (anterior) {
        setPasso(n);
        setErro(anterior);
        return;
      }
    }
    if (!intervalo.ok) return;

    setSalvando(true);
    let capaId: string | undefined;
    if (capa) {
      try {
        capaId = await subirAnexo(capa, "banners");
      } catch (e) {
        setSalvando(false);
        toast({
          tipo: "erro",
          titulo: "Não deu para enviar a capa",
          descricao: e instanceof Error ? e.message : undefined,
        });
        return;
      }
    }
    const dados = {
      nome,
      descricao,
      inicioEm: intervalo.inicioEm,
      fimEm: intervalo.fimEm,
      local:
        tipo === "externo"
          ? ({ tipo: "externo", url } as const)
          : ({ tipo: "canal", channelId: canal!.id } as const),
      repeticao,
      lembrar,
      capaId,
    };
    const ok = evento
      ? await editarEvento(evento.id, dados)
      : await criarEvento(serverId, dados, usuarioLocalId());
    setSalvando(false);
    if (ok) aoFechar();
  }

  const quando = intervalo.ok
    ? quandoLongo(
        { inicioEm: intervalo.inicioEm, fimEm: intervalo.fimEm, repeticao: undefined },
        lerRelogio(),
      )
    : "Data a definir";

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar()}>
      {/*
        ⚠ **O `DialogContent` é só o palco, e o painel é FILHO dele.** O design
        põe a prévia do card FORA do painel, ao lado — e o painel do `Dialog`
        tem superfície, borda e sombra próprias. `.palco` as zera (CSS Module
        fora de camada vence as utilities do Tailwind, que moram em
        `@layer utilities`) e o `.painel` daqui as desenha.
      */}
      <DialogContent
        titulo={evento ? "Editar evento" : "Criar evento"}
        tituloOculto
        className={css.palco}
      >
        <div className={css.painel}>
          <header className={css.cabecalho}>
            <div>
              <h2 className={css.titulo}>{evento ? "Editar evento" : "Criar evento"}</h2>
              <p className={css.subtitulo}>
                em {servidor?.name ?? "…"} · passo {passo} de 3
              </p>
            </div>
            <DialogClose className={css.fechar} aria-label="Fechar">
              <X aria-hidden />
            </DialogClose>
          </header>

          <ol className={css.passos}>
            {PASSOS.map((rotulo, i) => (
              <li
                key={rotulo}
                className={css.passo}
                data-estado={i + 1 === passo ? "atual" : i + 1 < passo ? "feito" : undefined}
                aria-current={i + 1 === passo ? "step" : undefined}
              >
                {rotulo}
              </li>
            ))}
          </ol>

          <div className={css.corpo}>
            {passo === 1 ? (
              <>
                <p className={css.sobrancelha} id="tipo-de-local">
                  Tipo de local
                </p>
                <div className={css.cartoes} role="radiogroup" aria-labelledby="tipo-de-local">
                  <CartaoDeLocal
                    marcado={tipo === "voz"}
                    icone={<SpeakerHigh aria-hidden />}
                    titulo="Canal de voz"
                    detalhe="Participantes entram direto na sala"
                    aoEscolher={() => trocarTipo("voz")}
                  />
                  <CartaoDeLocal
                    marcado={tipo === "texto"}
                    icone={<Hash aria-hidden />}
                    titulo="Canal de texto"
                    detalhe="Discussão marcada, sem voz"
                    aoEscolher={() => trocarTipo("texto")}
                  />
                  <CartaoDeLocal
                    marcado={tipo === "externo"}
                    icone={<LinkSimple aria-hidden />}
                    titulo="Link externo"
                    detalhe="Meet, Zoom ou stream fora do Vortex"
                    aoEscolher={() => trocarTipo("externo")}
                  />
                </div>

                {tipo === "externo" ? (
                  <>
                    <label className={css.rotuloDeCampo} htmlFor="evento-url">
                      URL do evento
                    </label>
                    <input
                      id="evento-url"
                      className={css.entrada}
                      data-mono
                      value={url}
                      placeholder="https://meet.example.com/…"
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </>
                ) : (
                  <>
                    <p className={css.rotuloDeCampo}>
                      {tipo === "voz" ? "Canal de voz" : "Canal de texto"}
                    </p>
                    <Selecao
                      rotulo={tipo === "voz" ? "Canal de voz" : "Canal de texto"}
                      valor={canal ? (tipo === "texto" ? `#${canal.nome}` : canal.nome) : "Nenhum canal"}
                      opcoes={listaDoTipo.map((c) => ({
                        id: c.id,
                        rotulo: tipo === "texto" ? `#${c.nome}` : c.nome,
                      }))}
                      aoEscolher={setCanalId}
                    />
                  </>
                )}
              </>
            ) : null}

            {passo === 2 ? (
              <>
                <div className={css.grade}>
                  <Campo id="evento-data" rotulo="Data de início" valor={data} aoMudar={setData} />
                  <Campo id="evento-hora" rotulo="Hora" valor={hora} aoMudar={setHora} mono />
                  <Campo
                    id="evento-fim"
                    rotulo="Fim"
                    valor={fim}
                    aoMudar={setFim}
                    mono
                  />
                  <div>
                    <p className={css.rotuloDeCampo}>Fuso</p>
                    <Selecao
                      rotulo="Fuso"
                      valor={rotuloDoFuso[fuso]}
                      opcoes={(["local", "utc"] as const).map((f) => ({
                        id: f,
                        rotulo: rotuloDoFuso[f],
                      }))}
                      aoEscolher={(f) => setFuso(f as Fuso)}
                    />
                  </div>
                </div>

                <p className={css.sobrancelha} data-degrau="repeticao" id="evento-repeticao">
                  Repetição
                </p>
                <div className={css.chips} role="radiogroup" aria-labelledby="evento-repeticao">
                  {REPETICOES_DO_FORMULARIO.map((r) => (
                    <button
                      key={r.rotulo}
                      type="button"
                      role="radio"
                      aria-checked={repeticao === r.valor}
                      className={css.chip}
                      onClick={() => setRepeticao(r.valor)}
                    >
                      {r.rotulo}
                    </button>
                  ))}
                </div>

                <div className={css.linhaDeInterruptor}>
                  <div>
                    <p className={css.interruptorTitulo}>Lembrar interessados</p>
                    <p className={css.interruptorDica}>Notificação 10 min antes de começar</p>
                  </div>
                  <Interruptor ligado={lembrar} rotulo="Lembrar interessados" aoAlternar={setLembrar} />
                </div>
              </>
            ) : null}

            {passo === 3 ? (
              <>
                <div className={css.bloco}>
                  <label className={css.rotuloDeCampo} data-colado htmlFor="evento-nome">
                    Nome do evento
                  </label>
                  <input
                    id="evento-nome"
                    className={css.entrada}
                    value={nome}
                    maxLength={100}
                    onChange={(e) => setNome(e.target.value)}
                  />
                </div>

                <div className={css.bloco}>
                  <div className={css.linhaDoRotulo}>
                    <label className={css.rotuloDeCampo} data-colado htmlFor="evento-descricao">
                      Descrição
                    </label>
                    <span className={css.contador}>
                      {descricao.length} / {LIMITE_DA_DESCRICAO}
                    </span>
                  </div>
                  <textarea
                    id="evento-descricao"
                    className={css.area}
                    rows={3}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value.slice(0, LIMITE_DA_DESCRICAO))}
                  />
                </div>

                <div className={css.bloco}>
                  <p className={css.rotuloDeCampo} data-colado>
                    Capa
                  </p>
                  {/* `input` escondido e botão visível: o nativo de arquivo é
                      desenhado pelo sistema, a mesma regra do `<select>`. */}
                  <input
                    ref={arquivo}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => setCapa(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    className={css.capa}
                    onClick={() => arquivo.current?.click()}
                  >
                    {capa ? capa.name : evento?.capaUrl ? "trocar capa · 1600×900" : "capa opcional · 1600×900"}
                  </button>
                </div>

                <div className={css.linhaDeInterruptor}>
                  <div>
                    <p className={css.interruptorTitulo}>Anunciar em #avisos</p>
                    <p className={css.interruptorDica}>Publica o card ao criar</p>
                  </div>
                  {/* Pendente, e mostra o estado VERDADEIRO: nada é anunciado. */}
                  <Interruptor
                    ligado={false}
                    rotulo="Anunciar em #avisos"
                    aoAlternar={aindaNao("anunciarEvento")}
                  />
                </div>
              </>
            ) : null}

            {erro ? (
              <p className={css.erro} role="alert">
                {erro}
              </p>
            ) : null}
          </div>

          <footer className={css.rodape}>
            <button
              type="button"
              className={css.voltar}
              data-oculto={passo === 1 || undefined}
              tabIndex={passo === 1 ? -1 : undefined}
              aria-hidden={passo === 1 || undefined}
              onClick={() => {
                setErro(undefined);
                setPasso(Math.max(1, passo - 1));
              }}
            >
              Voltar
            </button>
            <div className={css.acoes}>
              <DialogClose className={css.cancelar}>Cancelar</DialogClose>
              <button
                type="button"
                className={css.continuar}
                disabled={salvando}
                onClick={() => void avancar()}
              >
                {passo < 3 ? "Continuar" : evento ? "Salvar" : "Criar evento"}
              </button>
            </div>
          </footer>
        </div>

        <aside className={css.previa} aria-label="Prévia do card">
          <p className={css.sobrancelhaDaPrevia}>Prévia do card</p>
          <div className={css.cartao}>
            <div className={css.capaDoCartao}>
              {capa || evento?.capaUrl ? "capa escolhida" : "capa 16:9"}
            </div>
            <div className={css.corpoDoCartao}>
              <p className={css.quando}>{quando}</p>
              <p className={css.nomeDoCartao}>{nome.trim() || "Evento sem título"}</p>
              <p className={css.descricaoDoCartao}>{descricao.trim() || "Sem descrição ainda."}</p>
              <p className={css.lugar}>
                {tipo === "voz" ? <SpeakerHigh aria-hidden /> : tipo === "texto" ? <Hash aria-hidden /> : <LinkSimple aria-hidden />}
                <span className={css.nomeDoLugar}>
                  {tipo === "externo" ? url.trim() || "link externo" : canal?.nome ?? "—"}
                </span>
                {repeticao ? (
                  <span className={css.selo}>
                    {SELO_DA_REPETICAO[repeticao]}
                  </span>
                ) : null}
              </p>
              {/* A prévia DESENHA os botões e não os oferece: são a aparência
                  do card que quem ler vai ver, não ações deste formulário. */}
              <div className={css.botoesDaPrevia} aria-hidden>
                <span className={css.interesseDaPrevia}>Tenho interesse</span>
                <span className={css.compartilharDaPrevia}>⤴</span>
              </div>
            </div>
          </div>
          <p className={css.nota}>
            O mesmo card serve na lista de eventos, no anúncio em canal e no embed do link de
            convite — a diferença é só a largura e se a capa aparece.
          </p>
        </aside>
      </DialogContent>
    </Dialog>
  );
}

function valoresIniciais(
  evento: EventoDoServidor | undefined,
  canais: { readonly voz: readonly CanalDoEvento[]; readonly texto: readonly CanalDoEvento[] },
): { tipo: TipoDeLocal; canalId: string; url: string; data: string; hora: string; fim: string } {
  if (evento) {
    const inicio = textosDe(evento.inicioEm, "local");
    const fim = evento.fimEm !== undefined ? textosDe(evento.fimEm, "local").hora : "";
    if (evento.local.tipo === "externo") {
      return { tipo: "externo", canalId: "", url: evento.local.url, ...inicio, fim };
    }
    const channelId = evento.local.channelId;
    const ehVoz = canais.voz.some((c) => c.id === channelId);
    return { tipo: ehVoz ? "voz" : "texto", canalId: channelId, url: "", ...inicio, fim };
  }
  /* A próxima hora cheia — o design abre em "15:00", nunca em "14:37". */
  const HORA = 3_600_000;
  const proxima = Math.ceil((lerRelogio() + 1) / HORA) * HORA;
  const inicio = textosDe(proxima, "local");
  return {
    tipo: canais.voz.length > 0 ? "voz" : "texto",
    canalId: (canais.voz[0] ?? canais.texto[0])?.id ?? "",
    url: "",
    ...inicio,
    fim: "",
  };
}

function CartaoDeLocal({
  marcado,
  icone,
  titulo,
  detalhe,
  aoEscolher,
}: {
  marcado: boolean;
  icone: ReactNode;
  titulo: string;
  detalhe: string;
  aoEscolher: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcado}
      className={css.cartaoDeLocal}
      onClick={aoEscolher}
    >
      <span className={css.glifo}>{icone}</span>
      <span className={css.textosDoCartao}>
        <span className={css.tituloDoCartao}>{titulo}</span>
        <span className={css.detalheDoCartao}>{detalhe}</span>
      </span>
      <span className={css.radio} aria-hidden />
    </button>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  aoMudar,
  mono = false,
}: {
  id: string;
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <div>
      <label className={css.rotuloDeCampo} data-colado htmlFor={id}>
        {rotulo}
      </label>
      <input
        id={id}
        className={css.entrada}
        data-mono={mono || undefined}
        inputMode="numeric"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}

/**
 * A caixa que parece o `<select>` do design e não é um — a regra do projeto
 * contra controle nativo. Não é o `Escolha` porque os valores aqui são outros
 * (36px, 14px, rótulo em caixa alta fora da caixa), e o `Escolha` serve à
 * linha de ajuste de 32px.
 */
function Selecao({
  rotulo,
  valor,
  opcoes,
  aoEscolher,
}: {
  rotulo: string;
  valor: string;
  opcoes: readonly { readonly id: string; readonly rotulo: string }[];
  aoEscolher: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={css.selecao} aria-label={`${rotulo}: ${valor}`}>
          <span className={css.valor}>{valor}</span>
          <CaretDown aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {opcoes.map((o) => (
          <DropdownMenuItem key={o.id} onSelect={() => aoEscolher(o.id)}>
            {o.rotulo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
