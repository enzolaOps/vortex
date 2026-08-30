import { useState } from "react";

import { Botao } from "../../components/ui/Botao";
import { Campo } from "../../components/ui/Campo";
import { Escolha } from "../../components/ui/Escolha";
import { salvarCanal } from "../../sdk/canal";
import { useChannel } from "../../store/hooks";
import { aindaNao } from "../../pendente/pendencias";
import secao from "../Secao.module.css";
import css from "./Canal.module.css";

/**
 * Visão geral do canal — nome, assunto, modo lento, visibilidade e voz.
 *
 * ⚠ **Quatro dos oito controles são desenho, e a divisão está no protocolo,
 * não na pressa.** `name`, `description`, `nsfw` e `voice.max_users` estão em
 * `DataEditChannel`; modo lento, canal de spoiler, bitrate, região e modo de
 * vídeo não estão. A tabela com a medição está em `sdk/canal.ts`.
 *
 * O `slowmode` é o que mais engana: o objeto do canal CARREGA o valor e o
 * `stoat.js` expõe o getter, então quem lê o SDK conclui que dá para escrever.
 * Não dá. Por isso ele aparece com o valor real e o controle é pendente — o
 * contrário (esconder) faria a pessoa achar que o canal não tem modo lento.
 *
 * ⚠ **A faixa de "alterações não salvas" é do design e não é enfeite:** esta
 * tela tem oito controles e um único par salvar/descartar. Sem ela, sair da
 * seção perde tudo sem avisar — e a casca de configurações é uma ROTA, então
 * sair é o botão voltar do navegador, que ninguém associa a perder um
 * formulário.
 */
export function VisaoGeralDoCanal({ channelId }: { channelId: string }) {
  const canal = useChannel(channelId);

  const [nome, setNome] = useState(canal?.name ?? "");
  const [assunto, setAssunto] = useState(canal?.topico ?? "");
  const [idade, setIdade] = useState(false);
  const [limite, setLimite] = useState("8");
  const [salvando, setSalvando] = useState(false);

  if (!canal) {
    return <p className={secao.recado}>Abra um canal para ver isto.</p>;
  }

  const ehVoz = canal.tipo === "voz";
  const sujo =
    nome !== canal.name || assunto !== (canal.topico ?? "") || idade;

  /*
    O nome é normalizado como o design promete, e a promessa é escrita embaixo
    do campo: minúsculas e hífen no lugar de espaço. Fazer isto no `onChange` e
    não no envio é o que torna a regra visível — quem digita "Meu Canal" vê
    `meu-canal` aparecer, em vez de descobrir depois de salvar.
  */
  const normalizar = (v: string) =>
    v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");

  return (
    <div className={secao.forma}>
      <section className={secao.bloco}>
        {/* O rótulo do `Campo` É o título da seção no design — um `<h2>` a
            mais em cima faria o leitor de tela anunciar o nome duas vezes,
            que é o defeito que o `DialogContent` já teve. */}
        <Campo
          rotulo="Nome do canal"
          autoComplete="off"
          disabled={salvando}
          value={nome}
          onChange={(e) => setNome(normalizar(e.target.value))}
          dica="Minúsculas, sem espaços — hífens são convertidos automaticamente."
        />
      </section>

      <section className={secao.bloco}>
        <Campo
          rotulo="Assunto do canal"
          autoComplete="off"
          disabled={salvando}
          value={assunto}
          onChange={(e) => setAssunto(e.target.value)}
          dica="Aparece no cabeçalho. Aceita markdown."
        />
        <p className={css.contador}>{assunto.length} / 1024</p>
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Modo lento</h2>
        {/*
          Mostra o valor REAL e o controle é pendente. Ver o comentário do
          componente: ler sem poder escrever é o caso que mais engana aqui.
        */}
        <button
          type="button"
          className={css.pendente}
          onClick={aindaNao("modoLento")}
        >
          {canal.modoLentoSegundos > 0
            ? `${canal.modoLentoSegundos} segundos`
            : "Desativado"}
        </button>
        <p className={secao.recado}>
          Membros com &ldquo;Gerenciar mensagens&rdquo; ou &ldquo;Gerenciar
          canais&rdquo; ignoram o modo lento.
        </p>
      </section>

      <hr className={secao.divisor} />

      <section className={secao.bloco}>
        <h2 className={secao.subtitulo}>Visibilidade do conteúdo</h2>
        <Opcao
          marcada={!idade}
          titulo="Padrão"
          detalhe="Sem aviso; mídia carrega direto."
          aoMarcar={() => setIdade(false)}
        />
        {/* Spoiler não existe no protocolo — nem campo, nem evento. */}
        <Opcao
          marcada={false}
          titulo="Canal de spoiler"
          detalhe="Toda mídia entra borrada, com clique para revelar."
          aoMarcar={aindaNao("canalDeSpoiler")}
        />
        <Opcao
          marcada={idade}
          titulo="Restrição de idade"
          selo="+18"
          detalhe="Exige confirmação na entrada; some da prévia de convite."
          aoMarcar={() => setIdade(true)}
        />
      </section>

      {ehVoz ? (
        <>
          <hr className={secao.divisor} />
          <section className={secao.bloco}>
            <h2 className={secao.subtitulo}>Voz</h2>
            <div className={css.grade}>
              {/* O único dos quatro que o protocolo aceita. */}
              <Escolha
                rotulo="Limite de usuários"
                valor={limite}
                opcoes={["Sem limite", "2", "4", "8", "16", "25", "99"]}
                disabled={salvando}
                aoEscolher={setLimite}
              />
              <PendenteEscolha
                rotulo="Bitrate"
                valor="64 kbps"
                id="bitrateDeVoz"
              />
              <PendenteEscolha
                rotulo="Região de voz"
                valor="Automática"
                id="regiaoDeVoz"
              />
              <PendenteEscolha
                rotulo="Modo de vídeo"
                valor="Automático"
                id="modoDeVideo"
              />
            </div>
          </section>
        </>
      ) : null}

      {/*
        A faixa só aparece quando há o que salvar — ela é a RESPOSTA a uma
        edição, não um rodapé permanente. Permanente, ela viraria parte do
        fundo e pararia de ser lida, que é o oposto do que ela existe para
        fazer.
      */}
      {sujo ? (
        <div className={css.faixa} role="status">
          <span>Você tem alterações não salvas.</span>
          <div className={css.faixaAcoes}>
            <Botao
              variante="sutil"
              disabled={salvando}
              onClick={() => {
                setNome(canal.name);
                setAssunto(canal.topico ?? "");
                setIdade(false);
              }}
            >
              Descartar
            </Botao>
            <Botao
              variante="primario"
              disabled={salvando || nome.trim() === ""}
              onClick={() => {
                setSalvando(true);
                void salvarCanal(channelId, {
                  nome: nome.trim(),
                  assunto,
                  restritoPorIdade: idade,
                  limiteDeUsuarios: ehVoz
                    ? limite === "Sem limite"
                      ? 0
                      : Number(limite)
                    : undefined,
                }).finally(() => setSalvando(false));
              }}
            >
              {salvando ? "Salvando…" : "Salvar alterações"}
            </Botao>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Uma opção de rádio com título, selo e explicação.
 *
 * `role="radio"` num `button` e não um `<input type="radio">`: o nativo é
 * desenhado pelo sistema, e o lint do projeto reprova controle nativo em
 * superfície de produto desde a auditoria da fase 4. O estado vai em
 * `aria-checked`, que é o que o leitor de tela lê.
 */
function Opcao({
  marcada,
  titulo,
  selo,
  detalhe,
  aoMarcar,
}: {
  marcada: boolean;
  titulo: string;
  selo?: string;
  detalhe: string;
  aoMarcar: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={marcada}
      className={css.opcao}
      onClick={aoMarcar}
    >
      <span className={css.marca} aria-hidden />
      <span className={css.opcaoTexto}>
        <span className={css.opcaoTitulo}>
          {titulo}
          {selo ? <span className={css.selo}>{selo}</span> : null}
        </span>
        <span className={css.opcaoDetalhe}>{detalhe}</span>
      </span>
    </button>
  );
}

/** A cara de uma `Escolha` sobre algo que o protocolo não tem. */
function PendenteEscolha({
  rotulo,
  valor,
  id,
}: {
  rotulo: string;
  valor: string;
  id: Parameters<typeof aindaNao>[0];
}) {
  return (
    <div className={css.selecao}>
      <span className={css.rotuloLeve}>{rotulo}</span>
      <button type="button" className={css.pendente} onClick={aindaNao(id)}>
        {valor}
      </button>
    </div>
  );
}
