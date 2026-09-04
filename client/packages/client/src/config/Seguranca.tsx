import { useState } from "react";

import { Banner } from "../components/ui/Banner";
import { Botao } from "../components/ui/Botao";
import { CartaoDeOpcao } from "../components/ui/CartaoDeOpcao";
import { Interruptor } from "../components/ui/Interruptor";
import { Selo } from "../components/ui/Selo";
import { aindaNao } from "../pendente/pendencias";
import css from "./Seguranca.module.css";

const NIVEIS = [
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
  {
    id: "muitoAlto",
    titulo: "Muito alto · telefone verificado",
    detalhe: "Reduz spam e também entrada legítima.",
    selo: "RESTRITIVO",
  },
] as const;

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

type Nivel = (typeof NIVEIS)[number]["id"];
type Filtro = (typeof FILTROS)[number]["id"];

/**
 * Segurança — verificação, filtro de mídia e limites de contato.
 *
 * ⚠ **Mesma situação de Acesso, e a mesma decisão: nada é guardado.** Nenhum
 * dos oito controles tem campo no protocolo — `verification_level`,
 * `explicit_content_filter` e `dm_settings` dão zero ocorrências no schema. A
 * escolha vale só enquanto a página está aberta, e o banner diz por quê.
 *
 * ⚠ **Não confundir com "Privacidade neste servidor"**, que EXISTE e é outra
 * coisa: aquela é a decisão de UMA pessoa sobre o que ela recebe, guardada
 * localmente porque é o cliente dela que a aplica. Esta é política do
 * SERVIDOR sobre todo mundo — guardá-la nesta máquina não governaria nada, e
 * um moderador que a visse grudar acreditaria que o servidor está protegido.
 *
 * ⚠ **"Ações de emergência" também não é só rota faltando.** O design diz
 * "Registrado na auditoria", e `/servers/{target}/audit_logs` de fato existe —
 * mas pausar convites, silenciar @everyone e congelar entradas são três
 * escritas que o protocolo não tem. O botão fica desenhado, em `perigoSutil` e
 * não em `perigo`: ele ABRE a decisão, não a executa.
 */
export function Seguranca({ serverId }: { serverId: string }) {
  const [nivel, setNivel] = useState<Nivel>("nenhum");
  const [filtro, setFiltro] = useState<Filtro>("nao");

  if (!serverId) {
    return <p className={css.recado}>Abra um servidor para ver isto.</p>;
  }

  return (
    <div className={css.pagina}>
      <Banner tom="aviso" titulo="Nada aqui chega ao servidor ainda">
        Nível de verificação, filtro de mídia e limites de DM não existem no
        protocolo Stoat. Os controles estão desenhados; o comportamento real do
        servidor não muda ao mexer neles.
      </Banner>

      <section>
        <div className={css.sobrancelha}>Nível de verificação</div>
        <div
          className={css.grupo}
          role="radiogroup"
          aria-label="Nível de verificação"
        >
          {NIVEIS.map((n) => (
            <CartaoDeOpcao
              key={n.id}
              marcado={nivel === n.id}
              titulo={n.titulo}
              detalhe={n.detalhe}
              selo={
                "selo" in n ? <Selo tom="aviso">{n.selo}</Selo> : undefined
              }
              aoEscolher={() => {
                setNivel(n.id);
                if (n.id !== "nenhum") aindaNao("nivelDeVerificacao")();
              }}
            />
          ))}
        </div>
      </section>

      <section>
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
      </section>

      <div className={css.cartao}>
        <div className={css.cartaoTitulo}>Contato entre membros</div>

        <div className={css.linha}>
          <div>
            <div className={css.linhaTitulo}>Permitir DMs entre membros</div>
            <div className={css.linhaDetalhe}>
              Desligar bloqueia DM de quem não é amigo
            </div>
          </div>
          {/*
            ⚠ Ligado como valor de repouso, e não desligado: é o que o servidor
            REALMENTE faz hoje. Um interruptor pendente tem de mostrar o estado
            verdadeiro, senão ele não é "ainda não faz" — é uma afirmação falsa
            sobre o servidor.
          */}
          <Interruptor
            ligado
            rotulo="Permitir DMs entre membros"
            aoAlternar={aindaNao("contatoEntreMembros")}
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
            ligado={false}
            rotulo="Filtrar convites em DM"
            aoAlternar={aindaNao("contatoEntreMembros")}
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
            aoAlternar={aindaNao("contatoEntreMembros")}
          />
        </div>
      </div>

      <Banner
        tom="perigo"
        titulo="Ações de segurança de emergência"
        acoes={
          <Botao
            variante="perigoSutil"
            tamanho="pequeno"
            onClick={aindaNao("emergencia")}
          >
            Ativar
          </Botao>
        }
      >
        {/*
          ⚠ **Sem o ⏻ do design, e é regra do `Banner`:** o glifo é decidido
          pelo TOM, nunca passado por quem chama — deixá-lo livre produziria o
          mesmo aviso com três ícones diferentes em três telas, e o ícone é
          metade do que faz um banner ser reconhecido de relance.
        */}
        Pausa convites, silencia @everyone e congela novos membros por 1 hora.
        Registrado na auditoria.
      </Banner>
    </div>
  );
}
