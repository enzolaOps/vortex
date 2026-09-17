use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    AuditLogEntryAction, Database, Invite, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission, PermissionQuery};

use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};

use crate::util::audit_log_reason::AuditLogReason;

/// # Create Invite
///
/// Creates an invite to this channel.
///
/// Channel must be a `TextChannel`.
///
/// Vortex: an optional body with `roles` makes an invite that gives those
/// roles to whoever joins through it. Clients that send no body get the same
/// plain invite as before.
#[openapi(tag = "Channel Invites")]
#[post("/<target>/invites", data = "<data>")]
pub async fn create_invite(
    db: &State<Database>,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
    data: Option<Json<v0::DataCreateInvite>>,
) -> Result<Json<v0::Invite>> {
    if user.bot.is_some() {
        return Err(create_error!(IsBot));
    }

    let roles = data.map(|data| data.into_inner().roles).unwrap_or_default();

    let channel = target.as_channel(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::InviteOthers)?;

    // Vortex: com a emergência pausando convites, nem criar um novo funciona.
    if let Some(server_id) = channel.server() {
        let server = db.fetch_server(server_id).await?;
        if server
            .security
            .as_ref()
            .and_then(|security| security.active_emergency())
            .is_some_and(|emergency| emergency.pause_invites)
        {
            return Err(create_error!(JoinBlocked {
                reason: "InvitesPaused".to_string()
            }));
        }
    }

    if !roles.is_empty() {
        // Giving roles through a link is assigning them: same permission and
        // the same ranking rule as editing a member.
        permissions.throw_if_lacking_channel_permission(ChannelPermission::AssignRoles)?;

        if roles.len() > 10 {
            return Err(create_error!(InvalidOperation));
        }

        query.set_server_from_channel().await;
        let Some(server) = query.server_ref() else {
            return Err(create_error!(InvalidOperation));
        };

        let is_owner = server.owner == user.id;
        let our_ranking = query.get_member_rank().unwrap_or(i64::MIN);

        for role_id in &roles {
            let Some(role) = server.roles.get(role_id) else {
                return Err(create_error!(InvalidRole));
            };

            if !is_owner && role.rank <= our_ranking {
                return Err(create_error!(NotElevated));
            }
        }
    }

    let invite = Invite::create_channel_invite(db, &user, &channel, roles).await?;

    if let Some(server_id) = channel.server() {
        AuditLogEntryAction::InviteCreate {
            invite: invite.code().to_string(),
            channel: channel.id().to_string(),
        }
        .insert(db, server_id.to_string(), reason, user.id, None)
        .await;
    }

    Ok(Json(invite.into()))
}
