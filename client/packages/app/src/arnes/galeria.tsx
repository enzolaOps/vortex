import { useState, type CSSProperties, type ReactNode } from "react";

import {
  Avatar,
  Botao,
  CampoDeMensagem,
  CapsulaDeControle,
  Digitando,
  FundoVidro,
  ItemDeSala,
  Mensagem,
  PainelVidro,
  PilhaDeAvatares,
  Pilula,
  WidgetDaChamada,
  WidgetDaSala,
  type CantoVoz,
} from "../ui/ds";
import { Camera, Mais } from "../ui/icones";

/**
 * Galeria do design system, só em dev (`#galeria`). Cada componente em cada
 * estado, sobre o fundo Vidro, para olhar a olho nu. Fora do bundle de produção:
 * o único import é dinâmico, atrás de `import.meta.env.DEV` em `main.tsx`.
 * O texto daqui é de bancada e não passa pelo catálogo.
 */

const COLUNA: CSSProperties = { display: "grid", gap: "var(--vx-space-3)", alignContent: "start" };
const LINHA: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--vx-space-3)",
  alignItems: "center",
};

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section style={{ display: "grid", gap: "var(--vx-space-3)" }}>
      <h2
        style={{
          margin: 0,
          color: "var(--vx-text-2)",
          fontSize: "var(--vx-type-label-size)",
          letterSpacing: "var(--vx-type-label-tracking)",
          textTransform: "uppercase",
        }}
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: "var(--vx-text-3)", fontSize: "var(--vx-type-caption-size)" }}>
      {children}
    </span>
  );
}

/** Caixa posicionada onde os widgets de voz se fixam, com um "conteúdo" ao fundo. */
function Palco({ legenda, children }: { legenda: string; children: ReactNode }) {
  return (
    <div style={COLUNA}>
      <Rotulo>{legenda}</Rotulo>
      <div
        style={{
          position: "relative",
          blockSize: 360,
          border: "1px dashed var(--vx-border-subtle)",
          borderRadius: "var(--vx-radius-lg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const pessoas = [
  { nome: "Ana Souza", id: "u1" },
  { nome: "Bia Lima", id: "u2" },
  { nome: "Caio Melo", id: "u3" },
  { nome: "Davi Rocha", id: "u4" },
  { nome: "Eva Dias", id: "u5" },
  { nome: "Fábio Reis", id: "u6" },
];

const naSala = [
  { nome: "Ana Souza", id: "u1", estado: "falando" as const },
  { nome: "Bia Lima", id: "u2", estado: "transmitindo" as const },
  { nome: "Caio Melo", id: "u3", estado: "mudo" as const },
  { nome: "Davi Rocha", id: "u4" },
];

function Voz() {
  const [canto, setCanto] = useState<CantoVoz>("br");
  const [mudo, setMudo] = useState(false);
  const [surdo, setSurdo] = useState(false);
  const [camera, setCamera] = useState(false);
  const [tela, setTela] = useState(false);
  const controles = {
    mudo,
    surdo,
    camera,
    tela,
    onMudo: () => {
      setMudo(!mudo);
    },
    onSurdo: () => {
      setSurdo(!surdo);
    },
    onCamera: () => {
      setCamera(!camera);
    },
    onTela: () => {
      setTela(!tela);
    },
    onSair: () => undefined,
  };
  return (
    <>
      <Secao titulo="WidgetDaSala">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "var(--vx-space-4)" }}>
          <Palco legenda="fechado (passe o mouse ou use Tab), canto livre">
            <WidgetDaSala nome="Geral" pessoas={naSala} aoVivo canto={canto} onCanto={setCanto} onEntrar={() => undefined} onVerPalco={() => undefined} />
          </Palco>
          <Palco legenda="aberto, sem pessoas, canto superior esquerdo">
            <WidgetDaSala nome="Sala vazia" canto="tl" abertoInicial onEntrar={() => undefined} />
          </Palco>
          <Palco legenda="aberto, canto superior direito, com ao vivo">
            <WidgetDaSala nome="Filmes" canto="tr" abertoInicial aoVivo pessoas={naSala.slice(1, 3)} />
          </Palco>
          <Palco legenda="aberto, canto inferior esquerdo">
            <WidgetDaSala nome="Jogos" canto="bl" abertoInicial pessoas={naSala.slice(0, 1)} onVerPalco={() => undefined} />
          </Palco>
        </div>
      </Secao>

      <Secao titulo="CapsulaDeControle">
        <div style={{ display: "grid", gap: "var(--vx-space-8)", paddingBlockStart: 160 }}>
          <div style={LINHA}>
            <CapsulaDeControle sala="Geral" tempo="12:04" falando qualidade="1080p60" pessoas={[{ nome: "Ana Souza", falando: true }, { nome: "Caio Melo", mudo: true }, { nome: "Davi Rocha" }]} {...controles} />
            <Rotulo>interativa: passe o mouse ou use Tab; Esc recolhe</Rotulo>
          </div>
          <div style={LINHA}>
            <CapsulaDeControle sala="Mudo" tempo="03:21" mudo onMudo={() => undefined} onSurdo={() => undefined} onCamera={() => undefined} onTela={() => undefined} onSair={() => undefined} />
            <CapsulaDeControle sala="Surdo" surdo onMudo={() => undefined} onSurdo={() => undefined} onCamera={() => undefined} onTela={() => undefined} onSair={() => undefined} />
            <CapsulaDeControle sala="Câmera e tela" camera tela onMudo={() => undefined} onSurdo={() => undefined} onCamera={() => undefined} onTela={() => undefined} onSair={() => undefined} />
            <CapsulaDeControle sala="Expandida" expandido pessoas={[{ nome: "Ana Souza", falando: true }, { nome: "Bia Lima", mudo: true }]} qualidade="720p30" onMudo={() => undefined} />
          </div>
        </div>
      </Secao>

      <Secao titulo="WidgetDaChamada">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: "var(--vx-space-4)" }}>
          <Palco legenda="interativo: amplia no hover ou foco; Esc recolhe">
            <WidgetDaChamada sala="Geral" tempo="12:04" transmissao="Tela da Ana" quemFala="Ana" canto={canto} onCanto={setCanto} onVoltar={() => undefined} {...controles} />
          </Palco>
          <Palco legenda="sem transmissão, ninguém falando, canto superior esquerdo">
            <WidgetDaChamada sala="Geral" tempo="00:42" canto="tl" onMudo={() => undefined} onSair={() => undefined} />
          </Palco>
        </div>
      </Secao>
    </>
  );
}

function Conversa() {
  const [texto, setTexto] = useState("");
  const [enviadas, setEnviadas] = useState<string[]>([]);
  return (
    <>
      <Secao titulo="Mensagem e Digitando">
        <PainelVidro variante="leitura" style={{ padding: "var(--vx-space-3) 0", paddingBlockStart: "var(--vx-space-6)" }}>
          <Mensagem autor={{ nome: "Ana Souza", id: "u1" }} hora="14:32" tabIndex={0} onReagir={() => undefined} onResponder={() => undefined} onMaisAcoes={() => undefined}>
            Bom dia! Olhem o link da reunião: <a href="https://exemplo.com">exemplo.com/reuniao</a>
          </Mensagem>
          <Mensagem autor={{ nome: "Ana Souza", id: "u1" }} hora="14:33" continuacao tabIndex={0} onReagir={() => undefined}>
            Continuação do mesmo autor, sem avatar nem nome. A hora aparece no hover.
          </Mensagem>
          <Mensagem autor={{ nome: "Caio Melo", id: "u3" }} hora="14:35" tabIndex={0} resposta={{ autor: "Ana Souza", trecho: "Olhem o link da reunião e confirmem presença até o fim do dia" }} onResponder={() => undefined}>
            Confirmado!
          </Mensagem>
          <Mensagem autor={{ nome: "Bia Lima", id: "u2" }} hora="14:40" tabIndex={0} anexo={{ proporcao: "16 / 9", rotulo: "captura.png" }}>
            Segue a captura da tela.
          </Mensagem>
          <Mensagem autor={{ nome: "Davi Rocha", id: "u4" }} hora="14:41" tabIndex={0}>
            {"Texto longo na medida de leitura, que não estica em tela larga. ".repeat(8)}
          </Mensagem>
          <Mensagem autor={{ nome: "Eva Dias" }} hora="14:42" tabIndex={0}>
            URL sem espaços: https://exemplo.com/um/caminho/muito/comprido/que/nao/cabe/na/linha/e/precisa/quebrar
          </Mensagem>
        </PainelVidro>
        <div style={COLUNA}>
          <Digitando nomes={[]} />
          <Digitando nomes={["Davi"]} />
          <Digitando nomes={["Davi", "Ana"]} />
          <Digitando nomes={["Davi", "Ana", "Bia"]} />
        </div>
      </Secao>

      <Secao titulo="CampoDeMensagem">
        <div style={COLUNA}>
          <Rotulo>controlado (Enter envia, Shift+Enter quebra linha){enviadas.length > 0 && ` · enviadas: ${enviadas.join(" | ")}`}</Rotulo>
          <CampoDeMensagem valor={texto} onChange={setTexto} onEnviar={(v) => { setEnviadas([...enviadas, v]); setTexto(""); }} onAnexar={() => undefined} onEmoji={() => undefined} placeholder="Conversar em geral" />
          <Rotulo>vazio, sem botões extras</Rotulo>
          <CampoDeMensagem onEnviar={() => undefined} />
          <Rotulo>várias linhas (cresce até 8)</Rotulo>
          <CampoDeMensagem valorInicial={"linha 1\nlinha 2\nlinha 3\nlinha 4"} onEnviar={() => undefined} onAnexar={() => undefined} />
          <Rotulo>enviando</Rotulo>
          <CampoDeMensagem valorInicial="Mensagem em envio" enviando />
          <Rotulo>desabilitado, com motivo</Rotulo>
          <CampoDeMensagem desabilitado motivo="Você não pode escrever aqui" onAnexar={() => undefined} />
        </div>
      </Secao>
    </>
  );
}

export function Galeria() {
  return (
    <FundoVidro style={{ minBlockSize: "100vh", padding: "var(--vx-space-6)" }}>
      <div style={{ display: "grid", gap: "var(--vx-space-8)", maxInlineSize: 1200, marginInline: "auto" }}>
        <h1 style={{ margin: 0, fontSize: "var(--vx-type-display-size)" }}>Galeria do design system</h1>

        <Secao titulo="PainelVidro">
          <div style={LINHA}>
            {(["padrao", "leitura", "sobreposto"] as const).map((v) => (
              <PainelVidro key={v} variante={v} style={{ padding: "var(--vx-space-4)", inlineSize: 200 }}>
                {v}
              </PainelVidro>
            ))}
            <PainelVidro raio="xl" elevacao={1} style={{ padding: "var(--vx-space-4)" }}>raio xl · elev 1</PainelVidro>
            <PainelVidro raio="pill" elevacao={3} style={{ padding: "var(--vx-space-2) var(--vx-space-5)" }}>pill · elev 3</PainelVidro>
          </div>
        </Secao>

        <Secao titulo="Botao">
          <PainelVidro style={{ padding: "var(--vx-space-4)", display: "grid", gap: "var(--vx-space-3)" }}>
            {(["primario", "secundario", "fantasma", "perigo"] as const).map((v) => (
              <div key={v} style={LINHA}>
                <Rotulo>{v}</Rotulo>
                <Botao variante={v}>Entrar na sala</Botao>
                <Botao variante={v} tamanho="sm">Entrar na sala</Botao>
                <Botao variante={v} icone={<Mais />}>Com ícone</Botao>
                <Botao variante={v} icone={<Camera />} aria-label="Só ícone" />
                <Botao variante={v} tamanho="sm" icone={<Camera />} aria-label="Só ícone pequeno" />
                <Botao variante={v} disabled>Desabilitado</Botao>
                <Botao variante={v} carregando icone={<Mais />}>Carregando</Botao>
              </div>
            ))}
          </PainelVidro>
        </Secao>

        <Secao titulo="Pilula">
          <PainelVidro style={{ padding: "var(--vx-space-4)" }}>
            <div style={LINHA}>
              <Pilula tipo="aoVivo" />
              <Pilula tipo="mencao" valor={2} />
              <Pilula tipo="mencao" valor={120} />
              <Pilula tipo="contagem" valor={0} />
              <Pilula tipo="contagem" valor={14} />
              <Pilula tipo="naoLida" />
            </div>
          </PainelVidro>
        </Secao>

        <Secao titulo="Avatar e PilhaDeAvatares">
          <PainelVidro style={{ padding: "var(--vx-space-4)", display: "grid", gap: "var(--vx-space-4)" }}>
            <div style={LINHA}>
              {[20, 28, 36, 44, 120].map((t, i) => (
                <Avatar key={t} nome={pessoas[i]?.nome ?? "Ana"} id={pessoas[i]?.id} tamanho={t} />
              ))}
            </div>
            <div style={LINHA}>
              {(["online", "idle", "dnd", "offline"] as const).map((s, i) => (
                <Avatar key={s} nome={pessoas[i]?.nome ?? "Ana"} id={pessoas[i]?.id} tamanho={44} status={s} />
              ))}
              <Avatar nome="Caio Melo" tamanho={44} falando status="online" />
              <Avatar nome="Bia Lima" tamanho={44} transmitindo />
              <Avatar nome="Davi Rocha" tamanho={120} falando transmitindo status="dnd" />
              {[1, 2, 3, 4, 5, 6, 7, 8].map((tom) => (
                <Avatar key={tom} nome={`Tom ${tom}`} tom={tom} tamanho={36} />
              ))}
            </div>
            <div style={LINHA}>
              <PilhaDeAvatares itens={pessoas.slice(0, 3)} />
              <PilhaDeAvatares itens={pessoas} />
              <PilhaDeAvatares itens={pessoas} max={2} tamanho={36} />
            </div>
          </PainelVidro>
        </Secao>

        <Secao titulo="ItemDeSala">
          <PainelVidro style={{ padding: "var(--vx-space-2)", inlineSize: 320, display: "grid", gap: "var(--vx-space-1)" }}>
            <ItemDeSala nome="Geral" pessoas={pessoas.slice(0, 4)} />
            <ItemDeSala nome="Selecionada" selecionado pessoas={pessoas.slice(0, 2)} />
            <ItemDeSala nome="Você está aqui" conectado selecionado pessoas={pessoas.slice(0, 3)} />
            <ItemDeSala nome="Transmitindo" aoVivo pessoas={pessoas.slice(1, 3)} />
            <ItemDeSala nome="Sala vazia" />
            <ItemDeSala nome="Um nome de sala absurdamente comprido para a coluna" pessoas={pessoas} />
            <ItemDeSala tipo="canal" nome="geral" />
            <ItemDeSala tipo="canal" nome="avisos" naoLida />
            <ItemDeSala tipo="canal" nome="ideias" mencoes={3} naoLida />
            <ItemDeSala tipo="canal" nome="selecionado" selecionado />
          </PainelVidro>
        </Secao>

        <Conversa />
        <Voz />
      </div>
    </FundoVidro>
  );
}
