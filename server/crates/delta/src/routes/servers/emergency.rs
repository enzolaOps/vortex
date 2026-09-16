use iso8601_timestamp::{Duration, Timestamp};
use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    AuditLogEntryAction, Database, PartialServer, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::Result;
use rocket::{serde::json::Json, State};

use crate::util::audit_log_reason::AuditLogReason;

/// Duração das ações de emergência
const MINUTOS_DE_EMERGENCIA: i64 = 60;

/// # Activate Emergency
///
/// Vortex: pausa convites, silencia @everyone e congela entradas por 1 hora.
/// Ativar de novo renova o prazo. Registrado na auditoria como edição do
/// servidor.
#[openapi(tag = "Server Information")]
#[put("/<target>/emergency")]
pub async fn activate(
    db: &State<Database>,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
) -> Result<Json<v0::Server>> {
    set(
        db,
        user,
        reason,
        target,
        Some(v0::ServerEmergency {
            until: Timestamp::now_utc() + Duration::minutes(MINUTOS_DE_EMERGENCIA),
            pause_invites: true,
            silence_everyone: true,
            freeze_joins: true,
        }),
    )
    .await
}

/// # End Emergency
///
/// Vortex: encerra as ações de emergência antes do prazo.
#[openapi(tag = "Server Information")]
#[delete("/<target>/emergency")]
pub async fn end(
    db: &State<Database>,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
) -> Result<Json<v0::Server>> {
    set(db, user, reason, target, None).await
}

async fn set(
    db: &Database,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
    emergency: Option<v0::ServerEmergency>,
) -> Result<Json<v0::Server>> {
    let mut server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    calculate_server_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageServer)?;

    let mut security = server.security.clone().unwrap_or_default();
    security.emergency = emergency;

    let partial = PartialServer {
        security: Some(security),
        ..Default::default()
    };

    let before = server.generate_diff(&partial, &[]);
    server.update(db, partial.clone(), vec![]).await?;

    AuditLogEntryAction::ServerEdit {
        before,
        after: partial,
    }
    .insert(db, server.id.clone(), reason, user.id, None)
    .await;

    Ok(Json(server.into(db).await))
}
