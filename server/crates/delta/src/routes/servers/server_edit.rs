use std::collections::HashSet;

use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    AuditLogEntryAction, Database, FieldsServer, File, PartialServer, User, ValidatedTicket,
};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

use crate::util::audit_log_reason::AuditLogReason;

/// # Edit Server
///
/// Edit a server by its id.
#[openapi(tag = "Server Information")]
#[patch("/<target>", data = "<data>")]
pub async fn edit(
    db: &State<Database>,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
    data: Json<v0::DataEditServer>,
    validated_ticket: Option<ValidatedTicket>,
) -> Result<Json<v0::Server>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    let permissions = calculate_server_permissions(&mut query).await;

    // Check permissions
    if data.name.is_none()
        && data.description.is_none()
        && data.icon.is_none()
        && data.banner.is_none()
        && data.tag.is_none()
        && data.tag_badge.is_none()
        && data.characteristics.is_none()
        && data.system_messages.is_none()
        && data.categories.is_none()
        // && data.nsfw.is_none()
        && data.flags.is_none()
        && data.analytics.is_none()
        && data.discoverable.is_none()
        && data.owner.is_none()
        && data.security.is_none()
        && data.explicit_content_filter.is_none()
        && data.remove.is_empty()
    {
        return Ok(Json(server.into(db).await));
    } else if data.name.is_some()
        || data.description.is_some()
        || data.icon.is_some()
        || data.banner.is_some()
        || data.tag.is_some()
        || data.tag_badge.is_some()
        || data.characteristics.is_some()
        || data.system_messages.is_some()
        || data.analytics.is_some()
        || data.security.is_some()
        // Vortex: o filtro de mídia é política do servidor sobre todo mundo
        || data.explicit_content_filter.is_some()
        || !data.remove.is_empty()
    {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageServer)?;
    }

    // Check we are the server owner or privileged if changing sensitive fields
    if data.owner.is_some() {
        if user.id != server.owner && !user.privileged {
            return Err(create_error!(NotOwner));
        }

        if validated_ticket.is_none() {
            return Err(create_error!(InvalidCredentials));
        }
    }

    // Check we are privileged if changing sensitive fields
    if (data.flags.is_some() /*|| data.nsfw.is_some()*/ || data.discoverable.is_some())
        && !user.privileged
    {
        return Err(create_error!(NotPrivileged));
    }

    // Changing categories requires manage channel
    if data.categories.is_some() {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageChannel)?;
    }

    let v0::DataEditServer {
        name,
        description,
        icon,
        banner,
        tag,
        tag_badge,
        characteristics,
        categories,
        system_messages,
        flags,
        // nsfw,
        discoverable,
        analytics,
        owner,
        security,
        explicit_content_filter,
        remove,
    } = data;

    // Vortex: a tag é identificador curto, sempre em caixa alta, e o que
    // chega fora da forma é recusado em vez de corrigido — corrigir no
    // servidor faria a tela mostrar uma tag diferente da que foi digitada.
    if let Some(tag) = &tag {
        if !tag.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit()) {
            return Err(create_error!(FailedValidation {
                error: "tag: only uppercase letters and digits".to_string()
            }));
        }
    }

    // Características: até cinco (o validador conta), cada uma com texto,
    // sem repetição. Espaço nas pontas sai, que é ruído e não escolha.
    let characteristics = match characteristics {
        Some(list) => {
            let mut clean: Vec<String> = Vec::with_capacity(list.len());
            for item in list {
                let item = item.trim().to_string();
                let length = item.chars().count();
                if length == 0 || length > 32 {
                    return Err(create_error!(FailedValidation {
                        error: "characteristics: each must have 1 to 32 characters".to_string()
                    }));
                }

                if !clean.contains(&item) {
                    clean.push(item);
                }
            }

            Some(clean)
        }
        None => None,
    };

    let mut partial = PartialServer {
        name,
        description,
        tag,
        characteristics,
        categories: categories.map(|v| v.into_iter().map(Into::into).collect()),
        system_messages: system_messages.map(Into::into),
        flags,
        // nsfw,
        discoverable,
        analytics,
        owner: owner.clone(),
        explicit_content_filter: explicit_content_filter.map(Into::into),
        ..Default::default()
    };

    // Vortex: política de acesso e segurança é mesclada sobre a atual, para
    // que mudar um interruptor não apague os outros nem a emergência.
    if let Some(security) = security {
        if !security.is_empty() {
            let mut current = server.security.clone().unwrap_or_default();
            security.apply(&mut current);
            partial.security = Some(current);
        }
    }

    // 1. Remove fields from object
    if remove.contains(&v0::FieldsServer::Banner) {
        if let Some(banner) = &server.banner {
            db.mark_attachment_as_deleted(&banner.id).await?;
        }
    }

    if remove.contains(&v0::FieldsServer::Icon) {
        if let Some(icon) = &server.icon {
            db.mark_attachment_as_deleted(&icon.id).await?;
        }
    }

    if remove.contains(&v0::FieldsServer::TagBadge) {
        if let Some(badge) = &server.tag_badge {
            db.mark_attachment_as_deleted(&badge.id).await?;
        }
    }

    // 2. Validate changes
    if let Some(system_messages) = &partial.system_messages {
        for id in system_messages.clone().into_channel_ids() {
            if !server.channels.contains(&id) {
                return Err(create_error!(NotFound));
            }
        }
    }

    if let Some(categories) = &mut partial.categories {
        // Vortex: as sobreposições da categoria só mudam pela rota própria
        // (`PUT /servers/:id/categories/:category_id/permissions`), que confere
        // `ManagePermissions`. Aqui elas são COPIADAS da categoria existente
        // com o mesmo id: um cliente que só conhece `{id, title, channels}`
        // reenvia o array sem os campos, e aceitar isso apagaria a
        // privacidade de toda categoria a cada reordenação de canal.
        let existing = server.categories.clone().unwrap_or_default();

        let mut channel_ids = HashSet::new();
        for category in categories {
            match existing.iter().find(|c| c.id == category.id) {
                Some(previous) => {
                    category.default_permissions = previous.default_permissions;
                    category.role_permissions = previous.role_permissions.clone();
                }
                None => {
                    category.default_permissions = None;
                    category.role_permissions = Default::default();
                }
            }

            for channel in &category.channels {
                if channel_ids.contains(channel) {
                    return Err(create_error!(InvalidOperation));
                }

                channel_ids.insert(channel.to_string());
            }

            category
                .channels
                .retain(|item| server.channels.contains(item));
        }
    }

    // 3. Apply new icon
    if let Some(icon) = icon {
        partial.icon = Some(File::use_server_icon(db, &icon, &server.id, &user.id).await?);
        server.icon = partial.icon.clone();
    }

    // 4. Apply new banner
    if let Some(banner) = banner {
        partial.banner = Some(File::use_server_banner(db, &banner, &server.id, &user.id).await?);
        server.banner = partial.banner.clone();
    }

    // 4.1. Apply new tag badge
    if let Some(tag_badge) = tag_badge {
        partial.tag_badge =
            Some(File::use_server_tag_badge(db, &tag_badge, &server.id, &user.id).await?);
        server.tag_badge = partial.tag_badge.clone();
    }

    // 5. Transfer ownership
    if let Some(owner) = owner {
        let owner_reference = Reference::from_unchecked(&owner);
        // Check if member exists
        owner_reference.as_member(db, &server.id).await?;
        let owner_user = owner_reference.as_user(db).await?;

        if owner_user.bot.is_some() {
            return Err(create_error!(InvalidOperation));
        }

        server.owner = owner;
        partial.owner = Some(server.owner.clone());
    }

    let remove = remove
        .into_iter()
        .map(Into::into)
        .collect::<Vec<FieldsServer>>();

    let before = server.generate_diff(&partial, &remove);

    server.update(db, partial.clone(), remove).await?;

    AuditLogEntryAction::ServerEdit {
        before,
        after: partial,
    }
    .insert(db, server.id.clone(), reason, user.id, None)
    .await;

    Ok(Json(server.into(db).await))
}
