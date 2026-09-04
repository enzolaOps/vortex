import { useState } from "react";

import { Botao } from "../components/ui/Botao";
import { Campo } from "../components/ui/Campo";
import { lerMeuPerfil, salvarPerfil } from "../sdk/perfil";
import css from "./Secao.module.css";

/**
 * Nome de exibição, pronomes e bio.
 *
 * Um formulário e um botão, e não três — três botões "salvar" fazem a pessoa
 * salvar um campo e perder os outros dois, que é o defeito mais comum de tela
 * de perfil.
 *
 * Nome de USUÁRIO não está aqui: ele exige senha e mora em "Conta". A
 * separação não é burocracia — nome de exibição é como você se apresenta, nome
 * de usuário é como as pessoas te acham.
 */
export function Perfil() {
  const [inicial] = useState(() => lerMeuPerfil());
  const [nome, setNome] = useState(inicial?.displayName ?? "");
  const [pronomes, setPronomes] = useState(inicial?.pronomes ?? "");
  const [bio, setBio] = useState(inicial?.bio ?? "");
  const [salvando, setSalvando] = useState(false);

  if (!inicial) {
    return (
      <p className={css.recado}>
        Entre na sua conta para editar o perfil.
      </p>
    );
  }

  return (
    <form
      className={css.forma}
      onSubmit={(e) => {
        e.preventDefault();
        setSalvando(true);
        void salvarPerfil(nome.trim(), pronomes.trim(), bio.trim()).finally(() =>
          setSalvando(false),
        );
      }}
    >
      <Campo
        rotulo="Nome de exibição"
        dica="Como as pessoas te veem. Vazio volta ao nome de usuário."
        autoComplete="off"
        disabled={salvando}
        value={nome}
        onChange={(e) => setNome(e.target.value)}
      />

      <Campo
        rotulo="Pronomes"
        /* Vazio REMOVE em vez de virar string vazia — ver `salvarPerfil`. A
           diferença é a linha some do cartão de perfil, em vez de aparecer em
           branco. */
        dica="Aparecem no seu cartão de perfil. Pode ficar vazio."
        autoComplete="off"
        disabled={salvando}
        value={pronomes}
        onChange={(e) => setPronomes(e.target.value)}
      />

      <Campo
        rotulo="Sobre você"
        dica="Uma linha ou duas. Aparece quando alguém abre seu perfil."
        autoComplete="off"
        disabled={salvando}
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <div className={css.acoes}>
        <Botao variante="primario" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </Botao>
      </div>
    </form>
  );
}
