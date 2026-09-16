use iso8601_timestamp::Timestamp;
use revolt_models::v0;
use revolt_result::Result;

use crate::{
    events::client::EventV1, Database, EmailVerification, MemberCompositeKey, Server, User,
};

auto_derived!(
    /// Vortex: pedido de entrada pendente
    pub struct ServerJoinRequest {
        /// Servidor e quem pediu
        #[serde(rename = "_id")]
        pub id: MemberCompositeKey,
        /// Quando pediu
        pub created_at: Timestamp,
    }
);

impl From<ServerJoinRequest> for v0::ServerJoinRequest {
    fn from(value: ServerJoinRequest) -> Self {
        v0::ServerJoinRequest {
            server: value.id.server,
            user: value.id.user,
            created_at: value.created_at,
        }
    }
}

#[allow(clippy::disallowed_methods)]
impl ServerJoinRequest {
    /// Registra o pedido e avisa a moderação
    ///
    /// Pedir de novo devolve o pedido que já existe: para quem pediu a
    /// situação é a mesma, e um segundo evento só faria a fila piscar.
    pub async fn create(db: &Database, server: &Server, user: &User) -> Result<ServerJoinRequest> {
        if let Ok(request) = db.fetch_join_request(&server.id, &user.id).await {
            return Ok(request);
        }

        let request = ServerJoinRequest {
            id: MemberCompositeKey {
                server: server.id.clone(),
                user: user.id.clone(),
            },
            created_at: Timestamp::now_utc(),
        };

        db.insert_join_request(&request).await?;

        EventV1::ServerJoinRequestCreate {
            id: server.id.clone(),
            request: request.clone().into(),
        }
        .p(server.id.clone())
        .await;

        Ok(request)
    }

    /// Remove o pedido e avisa a moderação
    pub async fn delete(self, db: &Database) -> Result<()> {
        db.delete_join_request(&self.id).await?;

        EventV1::ServerJoinRequestDelete {
            id: self.id.server.clone(),
            user: self.id.user.clone(),
        }
        .p(self.id.server.clone())
        .await;

        Ok(())
    }
}

impl Server {
    /// Vortex: aplica a política de entrada do servidor a quem quer entrar
    ///
    /// Devolve `true` quando a entrada precisa passar pela fila de aprovação.
    /// Um servidor sem `security` devolve `Ok(false)` sem consultar nada — é o
    /// comportamento do Stoat, e é o que garante a compatibilidade.
    pub async fn check_join_policy(&self, db: &Database, user: &User) -> Result<bool> {
        let Some(security) = &self.security else {
            return Ok(false);
        };

        if let Some(emergency) = security.active_emergency() {
            if emergency.freeze_joins {
                return Err(create_error!(JoinBlocked {
                    reason: "JoinsFrozen".to_string()
                }));
            }

            if emergency.pause_invites {
                return Err(create_error!(JoinBlocked {
                    reason: "InvitesPaused".to_string()
                }));
            }
        }

        if security.join_mode == v0::ServerJoinMode::Closed {
            return Err(create_error!(JoinBlocked {
                reason: "Closed".to_string()
            }));
        }

        if security.require_verified_email
            && user.bot.is_none()
            && !user_email_verified(db, user).await
        {
            return Err(create_error!(JoinBlocked {
                reason: "EmailUnverified".to_string()
            }));
        }

        Ok(security.join_mode == v0::ServerJoinMode::Approval)
    }
}

/// Vortex: se a conta por trás do usuário tem email confirmado
///
/// Conta que não se encontra conta como NÃO verificada: o requisito existe para
/// barrar, e a dúvida não pode abrir a porta.
pub async fn user_email_verified(db: &Database, user: &User) -> bool {
    match db.fetch_account(&user.id).await {
        Ok(account) => matches!(account.verification, EmailVerification::Verified),
        Err(_) => false,
    }
}

/// Vortex: se o texto menciona @everyone ou @online
///
/// Pelo MESMO analisador que decide a notificação em `Message::create`, e não
/// por `contains`: o que a emergência silencia é o ping, e só o analisador sabe
/// o que vira ping (`@everyone` escapado, por exemplo, não vira).
pub fn content_mentions_everyone(content: &str) -> bool {
    let results = revolt_parser::parse_message(content);
    results.mentions_everyone || results.mentions_online
}
