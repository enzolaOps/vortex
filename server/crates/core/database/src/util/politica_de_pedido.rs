//! Vortex: "Pedidos de amizade · Quem pode enviar", aplicada no servidor.
//!
//! Mesmo mecanismo de `privacidade_do_servidor`: a preferência mora em
//! `UserSettings`, na chave que o cliente sincroniza
//! (`client/.../store/privacidade.ts`), e o formato é o de lá.
//!
//! - **Só formato versão 2 vale.** O padrão de fábrica ANTIGO do cliente era
//!   "amigos de amigos", e todo cliente sobe o snapshot da chave quando ela
//!   falta — então payload sem versão é de quem nunca escolheu nada. Honrá-lo
//!   barraria todo mundo por padrão, e com todo mundo em "amigos de amigos"
//!   ninguém consegue fazer o PRIMEIRO amigo.
//! - **Chave ausente, ilegível ou erro de leitura = todos.** A política é uma
//!   restrição, e falha de banco não é escolha de ninguém.
//! - **Aceitar não é pedir.** Quem já tem pedido recebido do destinatário, ou já
//!   é amigo, passa: responder não é contato novo.
//!
//! Compõe com a privacidade POR SERVIDOR por E: as duas precisam deixar.

use revolt_result::{create_error, Result};
use serde_json::Value;

use crate::{Database, RelationshipStatus, User};

/// Chave em `UserSettings`.
pub const CHAVE: &str = "vortex:privacidade";

const VERSAO: u64 = 2;

/// Quem pode mandar pedido de amizade. Espelha `POLITICAS_DE_PEDIDO` do cliente.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Politica {
    Todos,
    AmigosDeAmigos,
    MeusServidores,
    Ninguem,
}

/// Lê o texto guardado. Qualquer coisa fora do formato vira `Todos`.
pub fn ler(cru: &str) -> Politica {
    let Ok(v) = serde_json::from_str::<Value>(cru) else {
        return Politica::Todos;
    };
    if v.get("versao").and_then(Value::as_u64) != Some(VERSAO) {
        return Politica::Todos;
    }
    match v.get("politicaDePedido").and_then(Value::as_str) {
        Some("amigosDeAmigos") => Politica::AmigosDeAmigos,
        Some("meusServidores") => Politica::MeusServidores,
        Some("ninguem") => Politica::Ninguem,
        _ => Politica::Todos,
    }
}

/// A política deixa, dado o vínculo que existe entre as duas pessoas?
pub fn permite(politica: Politica, amigo_em_comum: bool, servidor_em_comum: bool) -> bool {
    match politica {
        Politica::Todos => true,
        Politica::Ninguem => false,
        Politica::AmigosDeAmigos => amigo_em_comum,
        Politica::MeusServidores => servidor_em_comum,
    }
}

/// A política do destinatário que barraria um pedido NOVO de `remetente`, se
/// alguma barrar. `None` = pode pedir.
pub async fn recusa(db: &Database, remetente: &User, destinatario: &User) -> Option<Politica> {
    if remetente.id == destinatario.id
        || remetente.privileged
        || remetente.bot.is_some()
        || destinatario.bot.is_some()
    {
        return None;
    }

    if matches!(
        remetente.relationship_with(&destinatario.id),
        RelationshipStatus::Friend | RelationshipStatus::Incoming
    ) {
        return None;
    }

    let politica = db
        .fetch_user_settings(&destinatario.id, &[CHAVE.to_string()])
        .await
        .ok()
        .and_then(|s| s.get(CHAVE).map(|(_, cru)| ler(cru)))
        .unwrap_or(Politica::Todos);

    let (amigo, servidor) = match politica {
        Politica::Todos | Politica::Ninguem => (false, false),
        // Erro de leitura libera, como no resto do arquivo.
        Politica::AmigosDeAmigos => (
            db.fetch_mutual_user_ids(&remetente.id, &destinatario.id)
                .await
                .map(|ids| !ids.is_empty())
                .unwrap_or(true),
            false,
        ),
        Politica::MeusServidores => (
            false,
            db.fetch_mutual_server_ids(&remetente.id, &destinatario.id)
                .await
                .map(|ids| !ids.is_empty())
                .unwrap_or(true),
        ),
    };

    if permite(politica, amigo, servidor) {
        None
    } else {
        Some(politica)
    }
}

/// Recusa o pedido NOVO se a política do destinatário o barrar.
pub async fn verificar_pedido(db: &Database, remetente: &User, destinatario: &User) -> Result<()> {
    match recusa(db, remetente, destinatario).await {
        None => Ok(()),
        Some(_) => Err(create_error!(PrivacyRestricted)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sem_versao_e_de_quem_nunca_escolheu() {
        let cru = json!({ "politicaDePedido": "ninguem" }).to_string();
        assert_eq!(ler(&cru), Politica::Todos);
    }

    #[test]
    fn lixo_vira_todos() {
        for cru in ["", "{", "[]", "42", r#"{"versao":3,"politicaDePedido":"ninguem"}"#] {
            assert_eq!(ler(cru), Politica::Todos, "{cru}");
        }
        let inventada = json!({ "versao": 2, "politicaDePedido": "inventada" }).to_string();
        assert_eq!(ler(&inventada), Politica::Todos);
    }

    #[test]
    fn versao_2_lida() {
        for (texto, esperada) in [
            ("todos", Politica::Todos),
            ("amigosDeAmigos", Politica::AmigosDeAmigos),
            ("meusServidores", Politica::MeusServidores),
            ("ninguem", Politica::Ninguem),
        ] {
            let cru = json!({
                "versao": 2,
                "filtrarDesconhecidos": true,
                "politicaDePedido": texto,
                "telemetria": false,
            })
            .to_string();
            assert_eq!(ler(&cru), esperada, "{texto}");
        }
    }

    #[test]
    fn permite_pelo_vinculo_que_a_politica_pede() {
        assert!(permite(Politica::Todos, false, false));
        assert!(!permite(Politica::Ninguem, true, true));
        assert!(permite(Politica::AmigosDeAmigos, true, false));
        assert!(!permite(Politica::AmigosDeAmigos, false, true));
        assert!(permite(Politica::MeusServidores, false, true));
        assert!(!permite(Politica::MeusServidores, true, false));
    }
}
