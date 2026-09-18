//! Vortex: privacidade POR SERVIDOR do destinatário, aplicada a DM e amizade.
//!
//! A preferência não tem modelo próprio: ela mora em `UserSettings`, na chave
//! que o cliente sincroniza (`client/.../store/privacidadeDoServidor.ts`), e o
//! formato aqui é o de lá. As duas pontas precisam concordar; as regras puras
//! deste arquivo repetem as de lá, com testes dos dois lados.
//!
//! Três escolhas que definem o comportamento:
//!
//! - **Só formato versão 2 vale.** Todo cliente sobe o snapshot da chave quando
//!   ela falta, e o padrão de fábrica ANTIGO do cliente era restritivo. Payload
//!   sem versão é de quem nunca escolheu nada, e é ignorado inteiro.
//! - **Chave ausente = nenhuma restrição.** Quem nunca configurou mantém o
//!   comportamento de sempre.
//! - **Só barra quando TODOS os servidores do vínculo dizem não.** Basta um
//!   servidor que deixe, ou um vínculo fora de servidor (amizade, conversa já
//!   existente, grupo em comum), para o contato ser legítimo.

use std::collections::HashMap;

use revolt_result::{create_error, Result};
use serde_json::Value;

use crate::{Database, RelationshipStatus, User};

/// Chave em `UserSettings`.
pub const CHAVE: &str = "vortex:privacidadeDoServidor";

const VERSAO: u64 = 2;

/// Quem pode mandar DM a partir de um servidor.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AlcanceDeDm {
    Todos,
    CargoComum,
    Ninguem,
}

/// O que importa ao servidor de uma entrada da preferência.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Escolha {
    pub dm: AlcanceDeDm,
    pub permitir_amizade: bool,
}

/// O padrão conservador: igual ao `PADRAO` do cliente.
pub const PADRAO: Escolha = Escolha {
    dm: AlcanceDeDm::Todos,
    permitir_amizade: true,
};

/// A preferência lida.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Preferencias {
    pub padrao: Escolha,
    pub por_servidor: HashMap<String, Escolha>,
}

impl Default for Preferencias {
    fn default() -> Self {
        Preferencias {
            padrao: PADRAO,
            por_servidor: HashMap::new(),
        }
    }
}

impl Preferencias {
    pub fn para(&self, server_id: &str) -> Escolha {
        self.por_servidor
            .get(server_id)
            .copied()
            .unwrap_or(self.padrao)
    }

    /// Alguma escolha pode barrar este tipo de contato? Evita consultas ao
    /// banco para quem nunca restringiu nada.
    pub fn restringe_algo(&self, contato: Contato) -> bool {
        let restritiva = |e: &Escolha| match contato {
            Contato::Dm => e.dm != AlcanceDeDm::Todos,
            Contato::Amizade => !e.permitir_amizade,
        };
        restritiva(&self.padrao) || self.por_servidor.values().any(restritiva)
    }
}

/// Mesma validação do `entrada()` do cliente: entrada incompleta é descartada.
fn entrada(v: &Value) -> Option<Escolha> {
    let o = v.as_object()?;
    let dm = match o.get("dm")?.as_str()? {
        "todos" => AlcanceDeDm::Todos,
        "cargoComum" => AlcanceDeDm::CargoComum,
        "ninguem" => AlcanceDeDm::Ninguem,
        _ => return None,
    };
    let filtro = o.get("filtro")?.as_str()?;
    if !matches!(filtro, "nao" | "deNaoAmigos" | "tudo") {
        return None;
    }
    o.get("mostrarPresenca")?.as_bool()?;
    o.get("mostrarAtividade")?.as_bool()?;
    let permitir_amizade = o.get("permitirAmizade")?.as_bool()?;
    Some(Escolha {
        dm,
        permitir_amizade,
    })
}

/// Lê o texto guardado. Qualquer coisa fora do formato vira "sem restrição".
pub fn ler(cru: &str) -> Preferencias {
    let Ok(v) = serde_json::from_str::<Value>(cru) else {
        return Preferencias::default();
    };
    let Some(o) = v.as_object() else {
        return Preferencias::default();
    };
    if o.get("versao").and_then(Value::as_u64) != Some(VERSAO) {
        return Preferencias::default();
    }
    let padrao = o.get("padrao").and_then(entrada).unwrap_or(PADRAO);
    let por_servidor = o
        .get("porServidor")
        .and_then(Value::as_object)
        .map(|m| {
            m.iter()
                .filter_map(|(id, e)| entrada(e).map(|e| (id.clone(), e)))
                .collect()
        })
        .unwrap_or_default();
    Preferencias {
        padrao,
        por_servidor,
    }
}

/// O tipo de contato sendo iniciado.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Contato {
    Dm,
    Amizade,
}

/// Esta escolha deixa o contato vir deste servidor?
pub fn permite(escolha: Escolha, contato: Contato, compartilham_cargo: bool) -> bool {
    match contato {
        Contato::Amizade => escolha.permitir_amizade,
        Contato::Dm => match escolha.dm {
            AlcanceDeDm::Todos => true,
            AlcanceDeDm::Ninguem => false,
            AlcanceDeDm::CargoComum => compartilham_cargo,
        },
    }
}

/// Barra só quando há servidor no vínculo e todos negam.
pub fn restringe(permissoes: &[bool]) -> bool {
    !permissoes.is_empty() && permissoes.iter().all(|p| !p)
}

/// Recusa o contato de `remetente` com `destinatario` se a privacidade por
/// servidor do destinatário o barrar.
///
/// Erro de LEITURA não barra: a preferência é uma restrição, e falha de banco
/// não é escolha de ninguém.
pub async fn verificar_contato(
    db: &Database,
    remetente: &User,
    destinatario: &User,
    contato: Contato,
) -> Result<()> {
    if remetente.id == destinatario.id
        || remetente.privileged
        || remetente.bot.is_some()
        || destinatario.bot.is_some()
    {
        return Ok(());
    }

    // Vínculos fora de servidor: amizade, ou o destinatário pediu primeiro.
    if matches!(
        remetente.relationship_with(&destinatario.id),
        RelationshipStatus::Friend | RelationshipStatus::Incoming
    ) {
        return Ok(());
    }

    let preferencias = db
        .fetch_user_settings(&destinatario.id, &[CHAVE.to_string()])
        .await
        .ok()
        .and_then(|s| s.get(CHAVE).map(|(_, cru)| ler(cru)))
        .unwrap_or_default();
    if !preferencias.restringe_algo(contato) {
        return Ok(());
    }

    // Conversa já existente ou grupo em comum também são vínculo.
    if db
        .fetch_mutual_channel_ids(&remetente.id, &destinatario.id)
        .await
        .map(|ids| !ids.is_empty())
        .unwrap_or(true)
    {
        return Ok(());
    }

    let servidores: Vec<String> = match contato {
        // Para DM só contam os servidores que liberam DM entre membros: os
        // outros nem dão a permissão, e não são vínculo desta pergunta.
        Contato::Dm => remetente
            .mutual_servers_with_policy(db, &destinatario.id, |s| s.allow_member_dms)
            .await
            .map(|v| v.into_iter().map(|s| s.id).collect())
            .unwrap_or_default(),
        Contato::Amizade => db
            .fetch_mutual_server_ids(&remetente.id, &destinatario.id)
            .await
            .unwrap_or_default(),
    };

    let mut permissoes = Vec::with_capacity(servidores.len());
    for server_id in &servidores {
        let escolha = preferencias.para(server_id);
        let cargo = if contato == Contato::Dm && escolha.dm == AlcanceDeDm::CargoComum {
            compartilham_cargo(db, server_id, &remetente.id, &destinatario.id).await
        } else {
            false
        };
        permissoes.push(permite(escolha, contato, cargo));
    }

    if restringe(&permissoes) {
        Err(create_error!(PrivacyRestricted))
    } else {
        Ok(())
    }
}

async fn compartilham_cargo(db: &Database, server_id: &str, a: &str, b: &str) -> bool {
    let (Ok(ma), Ok(mb)) = (
        db.fetch_member(server_id, a).await,
        db.fetch_member(server_id, b).await,
    ) else {
        return false;
    };
    ma.roles.iter().any(|r| mb.roles.contains(r))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn escolha(dm: &str, amizade: bool) -> Value {
        json!({
            "dm": dm,
            "filtro": "nao",
            "mostrarPresenca": true,
            "mostrarAtividade": false,
            "permitirAmizade": amizade,
        })
    }

    #[test]
    fn sem_versao_e_ignorado_inteiro() {
        let cru = json!({
            "padrao": escolha("cargoComum", true),
            "porServidor": { "A": escolha("ninguem", false) },
        })
        .to_string();
        assert_eq!(ler(&cru), Preferencias::default());
        assert!(!ler(&cru).restringe_algo(Contato::Dm));
    }

    #[test]
    fn lixo_vira_sem_restricao() {
        for cru in ["", "{", "[]", "42", r#"{"versao":3}"#] {
            assert_eq!(ler(cru), Preferencias::default(), "{cru}");
        }
    }

    #[test]
    fn versao_2_lida_com_entrada_podre_descartada() {
        let cru = json!({
            "versao": 2,
            "padrao": escolha("cargoComum", true),
            "porServidor": {
                "A": escolha("ninguem", false),
                "B": { "dm": "ninguem" },
                "C": escolha("inventado", true),
            },
        })
        .to_string();
        let p = ler(&cru);
        assert_eq!(p.padrao.dm, AlcanceDeDm::CargoComum);
        assert_eq!(
            p.para("A"),
            Escolha {
                dm: AlcanceDeDm::Ninguem,
                permitir_amizade: false
            }
        );
        assert_eq!(p.para("B"), p.padrao);
        assert_eq!(p.para("C"), p.padrao);
        assert!(p.restringe_algo(Contato::Dm));
        assert!(p.restringe_algo(Contato::Amizade));
    }

    #[test]
    fn padrao_ausente_e_conservador() {
        let p = ler(&json!({ "versao": 2 }).to_string());
        assert_eq!(p.padrao, PADRAO);
        assert!(!p.restringe_algo(Contato::Dm));
        assert!(!p.restringe_algo(Contato::Amizade));
    }

    #[test]
    fn permite_dm_e_amizade() {
        let e = |dm, amizade| Escolha {
            dm,
            permitir_amizade: amizade,
        };
        assert!(permite(e(AlcanceDeDm::Todos, false), Contato::Dm, false));
        assert!(!permite(e(AlcanceDeDm::Ninguem, true), Contato::Dm, true));
        assert!(permite(e(AlcanceDeDm::CargoComum, true), Contato::Dm, true));
        assert!(!permite(
            e(AlcanceDeDm::CargoComum, true),
            Contato::Dm,
            false
        ));
        assert!(permite(
            e(AlcanceDeDm::Ninguem, true),
            Contato::Amizade,
            false
        ));
        assert!(!permite(
            e(AlcanceDeDm::Todos, false),
            Contato::Amizade,
            true
        ));
    }

    #[test]
    fn restringe_so_quando_todos_negam() {
        assert!(!restringe(&[]));
        assert!(restringe(&[false]));
        assert!(restringe(&[false, false]));
        assert!(!restringe(&[false, true]));
    }
}
