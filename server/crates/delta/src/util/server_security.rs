//! Vortex: a política de segurança do servidor aplicada ao ENVIO de mensagem.
//!
//! Tudo aqui é no-op para servidor sem `security` e para DM sem servidor em
//! comum que tenha pedido o filtro — é o que mantém o comportamento do Stoat.

use std::collections::HashSet;
use std::time::Duration;

use iso8601_timestamp::Timestamp;
use once_cell::sync::Lazy;
use regex::Regex;
use revolt_database::{
    content_mentions_everyone, user_email_verified, Channel, Database, Invite, Member,
    RelationshipStatus, Server, User,
};
use revolt_models::v0::{self, ServerVerificationLevel};
use revolt_permissions::{ChannelPermission, PermissionValue};
use revolt_result::{create_error, Result};

/// Idade mínima da conta a partir do nível `Medium`
const IDADE_MINIMA_DA_CONTA: Duration = Duration::from_secs(5 * 60);
/// Tempo mínimo como membro no nível `High`
const MINUTOS_MINIMOS_NO_SERVIDOR: i64 = 10;

/// Links de convite: o caminho do cliente Vortex (`/convite/`), o do Stoat
/// (`/invite/`) e os encurtadores públicos do upstream.
static RE_INVITE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)(?:https?://)?(?:[a-z0-9.-]+(?::\d+)?/(?:invite|convite)/|(?:rvlt|stt)\.gg/)([a-z0-9]+)",
    )
    .unwrap()
});

/// Texto que substitui um convite de terceiro removido
const CONVITE_REMOVIDO: &str = "[convite removido]";

/// Aplica a política de segurança antes de a mensagem ser criada
///
/// `server` e `member` são os que o cálculo de permissão do canal já resolveu.
pub async fn enforce_message_policy(
    db: &Database,
    user: &User,
    channel: &Channel,
    server: Option<&Server>,
    member: Option<&Member>,
    permissions: &PermissionValue,
    data: &mut v0::DataMessageSend,
) -> Result<()> {
    if user.bot.is_some() || user.privileged {
        return Ok(());
    }

    if let Some(server) = server {
        enforce_server_channel(db, user, server, member, permissions, data).await
    } else if let Channel::DirectMessage { recipients, .. } = channel {
        filter_dm_invites(db, user, recipients, data).await
    } else {
        Ok(())
    }
}

async fn enforce_server_channel(
    db: &Database,
    user: &User,
    server: &Server,
    member: Option<&Member>,
    permissions: &PermissionValue,
    data: &v0::DataMessageSend,
) -> Result<()> {
    let Some(security) = &server.security else {
        return Ok(());
    };

    if server.owner == user.id || permissions.has_channel_permission(ChannelPermission::ManageServer)
    {
        return Ok(());
    }

    // Emergência: @everyone e @online silenciados para quem não administra.
    if security
        .active_emergency()
        .is_some_and(|emergency| emergency.silence_everyone)
        && data
            .content
            .as_deref()
            .is_some_and(content_mentions_everyone)
    {
        return Err(create_error!(MentionsSilenced));
    }

    // Nível de verificação: quem tem cargo já foi reconhecido pela moderação e
    // não precisa cumprir requisito de conta nova (mesma regra do Discord).
    if security.verification_level == ServerVerificationLevel::None
        || member.is_some_and(|member| !member.roles.is_empty())
    {
        return Ok(());
    }

    let level = &security.verification_level;
    let recusar = || {
        create_error!(VerificationRequired {
            level: format!("{level:?}")
        })
    };

    if !user_email_verified(db, user).await {
        return Err(recusar());
    }

    if matches!(
        level,
        ServerVerificationLevel::Medium | ServerVerificationLevel::High
    ) {
        let idade = ulid::Ulid::from_string(&user.id)
            .ok()
            .and_then(|id| id.datetime().elapsed().ok())
            .unwrap_or_default();

        if idade < IDADE_MINIMA_DA_CONTA {
            return Err(recusar());
        }
    }

    if *level == ServerVerificationLevel::High {
        if let Some(member) = member {
            if member.joined_at
                + iso8601_timestamp::Duration::minutes(MINUTOS_MINIMOS_NO_SERVIDOR)
                > Timestamp::now_utc()
            {
                return Err(recusar());
            }
        }
    }

    Ok(())
}

/// Remove convites de terceiros numa DM entre membros de um servidor que pediu
///
/// Só vale entre quem NÃO é amigo: a DM entre amigos não "nasceu" no servidor.
/// Convite para um dos servidores em comum que pediram o filtro fica — ele não
/// é de terceiro.
async fn filter_dm_invites(
    db: &Database,
    user: &User,
    recipients: &[String],
    data: &mut v0::DataMessageSend,
) -> Result<()> {
    let Some(content) = data.content.as_ref() else {
        return Ok(());
    };

    if !RE_INVITE.is_match(content) {
        return Ok(());
    }

    let Some(other) = recipients.iter().find(|id| *id != &user.id) else {
        return Ok(());
    };

    if user.relationship_with(other) == RelationshipStatus::Friend {
        return Ok(());
    }

    let servers = user
        .mutual_servers_with_policy(db, other, |security| security.filter_dm_invites)
        .await?;

    if servers.is_empty() {
        return Ok(());
    }

    let allowed: HashSet<&str> = servers.iter().map(|server| server.id.as_str()).collect();

    // Os códigos saem do texto ANTES de consultar o banco: o iterador da regex
    // não pode atravessar um `.await` num handler que precisa ser `Send`.
    let codes: Vec<String> = RE_INVITE
        .captures_iter(content)
        .map(|captures| captures[1].to_string())
        .collect();

    let mut kept = HashSet::new();
    for code in codes {
        if let Ok(Invite::Server { server, .. }) = db.fetch_invite(&code).await {
            if allowed.contains(server.as_str()) {
                kept.insert(code);
            }
        }
    }

    let filtered = RE_INVITE
        .replace_all(content, |captures: &regex::Captures| {
            if kept.contains(&captures[1]) {
                captures[0].to_string()
            } else {
                CONVITE_REMOVIDO.to_string()
            }
        })
        .into_owned();

    data.content = Some(filtered);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::RE_INVITE;

    #[test]
    fn reconhece_os_formatos_de_convite() {
        for (texto, codigo) in [
            ("entra aí https://vortex.exemplo/convite/Ab12Cd", "Ab12Cd"),
            ("http://localhost:8880/invite/xyz99", "xyz99"),
            ("rvlt.gg/Revolt", "Revolt"),
            ("stt.gg/abc", "abc"),
        ] {
            let captures = RE_INVITE.captures(texto).expect(texto);
            assert_eq!(&captures[1], codigo);
        }

        assert!(!RE_INVITE.is_match("https://exemplo.com/sobre/nada"));
    }
}
