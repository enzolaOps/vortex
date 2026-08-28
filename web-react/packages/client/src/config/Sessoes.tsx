import { useEffect, useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { EstadoVazio } from "../components/ui/EstadoVazio";
import {
  derrubarDispositivo,
  derrubarOutros,
  listarDispositivos,
  type Dispositivo,
} from "../sdk/perfil";
import css from "./Secao.module.css";

/**
 * Os dispositivos com sessão aberta.
 *
 * ⚠ **Esta tela estava adiada desde a etapa 2 por não haver onde morar**, e é
 * a que mais importa das configurações de conta. O token deste app fica em
 * `localStorage` — decisão registrada em `store/sessao.ts`, com o custo dito —
 * e sem esta lista "minha conta pode ter sido acessada" é um pensamento sem
 * nenhuma ação possível. Com ela, vira um botão.
 *
 * A senha é pedida uma vez e vale para as ações da tela enquanto ela estiver
 * aberta: o protocolo troca a senha por um bilhete de MFA de uso único, e pedir
 * a senha a cada linha derrubada tornaria "derrubar tudo" mais fácil que
 * derrubar o certo — o incentivo errado.
 */
export function Sessoes() {
  const [lista, setLista] = useState<readonly Dispositivo[] | undefined>(undefined);
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);

  function recarregar() {
    void listarDispositivos().then(setLista);
  }

  useEffect(() => {
    let vivo = true;
    void listarDispositivos().then((l) => {
      if (vivo) setLista(l);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const outros = (lista ?? []).filter((d) => !d.atual);
  const temSenha = senha.length > 0;

  return (
    <div className={css.forma}>
      <p className={css.recado}>
        Cada dispositivo onde você entrou tem uma sessão. Derrubar uma
        desconecta aquele dispositivo na hora.
      </p>

      <Campo
        rotulo="Senha atual"
        type="password"
        autoComplete="current-password"
        /* O protocolo troca a senha por um bilhete de uso único — ela é o que
           autoriza derrubar, e derrubar sessões é exatamente o que alguém faria
           com uma sessão roubada para trancar o dono do lado de fora. */
        dica="Necessária para derrubar qualquer dispositivo."
        disabled={ocupado}
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
      />

      {lista === undefined ? (
        <p className={css.recado}>Carregando…</p>
      ) : lista.length === 0 ? (
        <EstadoVazio
          compacto
          titulo="Nenhum dispositivo listado"
          detalhe="Sem servidor não dá para consultar as sessões."
        />
      ) : (
        <ul className={css.lista}>
          {lista.map((d) => (
            <li key={d.id} className={css.linha}>
              <span className={css.texto}>
                <span className={css.nome}>{d.nome}</span>
                {d.atual ? (
                  <span className={css.detalhe}>Este dispositivo</span>
                ) : null}
              </span>

              {/*
                A sessão ATUAL não tem botão de derrubar.

                Derrubá-la é sair, e sair tem lugar próprio em "Conta". Um botão
                "derrubar" ao lado de "Este dispositivo" faria a pessoa se
                desconectar tentando desconectar outra coisa.
              */}
              {d.atual ? null : (
                <Botao
                  variante="sutil"
                  disabled={!temSenha || ocupado}
                  onClick={() => {
                    setOcupado(true);
                    void derrubarDispositivo(d.id, senha)
                      .then((ok) => {
                        if (ok) recarregar();
                      })
                      .finally(() => setOcupado(false));
                  }}
                >
                  Derrubar
                </Botao>
              )}
            </li>
          ))}
        </ul>
      )}

      {outros.length > 0 ? (
        <div className={css.acoes}>
          <Botao
            variante="perigo"
            disabled={!temSenha || ocupado}
            onClick={() => {
              setOcupado(true);
              void derrubarOutros(senha)
                .then((ok) => {
                  if (ok) recarregar();
                })
                .finally(() => setOcupado(false));
            }}
          >
            {/* "Os outros" e não "todos": esta sessão fica, e o rótulo tem de
                dizer isso — quem clica está tomando uma decisão de segurança e
                precisa saber se vai se deslogar junto. */}
            Derrubar os outros {outros.length}
          </Botao>
        </div>
      ) : null}
    </div>
  );
}
