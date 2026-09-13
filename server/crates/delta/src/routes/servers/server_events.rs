//! Eventos agendados do servidor (Vortex).
//!
//! Superfície a mais sobre o protocolo Stoat: clientes que não a conhecem
//! nunca chamam estas rotas e ignoram os eventos `ServerEvent*`.

use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, File, Server, ServerEvent, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_server_permissions, ChannelPermission, PermissionQuery};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;
use validator::Validate;

/// Comprimento máximo de um link externo de evento.
const EXTERNAL_URL_MAX_LENGTH: usize = 512;

/// Confere que o local pertence a este servidor e que o evento externo é coerente.
fn validate_location(
    server: &Server,
    location: &v0::ServerEventLocation,
    starts_at: &iso8601_timestamp::Timestamp,
    ends_at: Option<&iso8601_timestamp::Timestamp>,
) -> Result<()> {
    match location {
        v0::ServerEventLocation::Channel { channel } => {
            if !server.channels.contains(channel) {
                return Err(create_error!(UnknownChannel));
            }
        }
        v0::ServerEventLocation::External { url } => {
            let url_ok = (url.starts_with("https://") || url.starts_with("http://"))
                && url.len() <= EXTERNAL_URL_MAX_LENGTH;
            if !url_ok {
                return Err(create_error!(FailedValidation {
                    error: "location.url must be an http(s) link".to_string()
                }));
            }

            // O design pede fim obrigatório no link externo: sem ele não há
            // como dizer quando o evento deixa de estar "ao vivo".
            if ends_at.is_none() {
                return Err(create_error!(FailedValidation {
                    error: "external events require ends_at".to_string()
                }));
            }
        }
    }

    if let Some(ends_at) = ends_at {
        if ends_at <= starts_at {
            return Err(create_error!(FailedValidation {
                error: "ends_at must be after starts_at".to_string()
            }));
        }
    }

    Ok(())
}

/// Busca o evento garantindo que ele é deste servidor.
async fn fetch_event_in_server(db: &Database, server: &Server, id: &str) -> Result<ServerEvent> {
    let event = db.fetch_server_event(id).await?;
    if event.server != server.id {
        return Err(create_error!(NotFound));
    }

    Ok(event)
}

/// Editar ou apagar: `ManageEvents` para qualquer evento, `CreateEvents` para
/// os próprios — a mesma divisão de "Criar eventos" e "Gerenciar eventos" da
/// referência.
async fn throw_if_cannot_manage(
    db: &Database,
    user: &User,
    server: &Server,
    event: &ServerEvent,
) -> Result<()> {
    let mut query = DatabasePermissionQuery::new(db, user).server(server);
    let permissions = calculate_server_permissions(&mut query).await;
    if permissions.has_channel_permission(ChannelPermission::ManageEvents) {
        return Ok(());
    }

    if event.creator == user.id
        && permissions.has_channel_permission(ChannelPermission::CreateEvents)
    {
        return Ok(());
    }

    Err(create_error!(MissingPermission {
        permission: ChannelPermission::ManageEvents.to_string()
    }))
}

/// # Fetch Server Events
///
/// Fetch all scheduled events of a server.
#[openapi(tag = "Server Events")]
#[get("/<target>/events")]
pub async fn fetch_events(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<Vec<v0::ServerEvent>>> {
    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    if !query.are_we_a_member().await {
        return Err(create_error!(NotFound));
    }

    db.fetch_server_events(&server.id)
        .await
        .map(|events| events.into_iter().map(Into::into).collect())
        .map(Json)
}

/// # Create Server Event
///
/// Schedule a new event on a server.
#[openapi(tag = "Server Events")]
#[post("/<target>/events", data = "<data>")]
pub async fn create_event(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataCreateServerEvent>,
) -> Result<Json<v0::ServerEvent>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    let permissions = calculate_server_permissions(&mut query).await;
    if !permissions.has_channel_permission(ChannelPermission::ManageEvents) {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::CreateEvents)?;
    }

    validate_location(
        &server,
        &data.location,
        &data.starts_at,
        data.ends_at.as_ref(),
    )?;

    let mut event = ServerEvent::new(
        &server.id,
        &user.id,
        data.name,
        data.description.filter(|d| !d.is_empty()),
        data.starts_at,
        data.ends_at,
        data.location.into(),
        data.recurrence.map(Into::into),
        data.remind,
    );

    if let Some(image) = data.image {
        event.image = Some(File::use_server_banner(db, &image, &event.id, &user.id).await?);
    }

    event.create(db).await?;
    Ok(Json(event.into()))
}

/// # Edit Server Event
///
/// Edit a scheduled event. Its creator or anyone with `ManageEvents` may edit.
#[openapi(tag = "Server Events")]
#[patch("/<target>/events/<event_id>", data = "<data>")]
pub async fn edit_event(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    event_id: String,
    data: Json<v0::DataEditServerEvent>,
) -> Result<Json<v0::ServerEvent>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let server = target.as_server(db).await?;
    let mut event = fetch_event_in_server(db, &server, &event_id).await?;
    throw_if_cannot_manage(db, &user, &server, &event).await?;

    for field in &data.remove {
        match field {
            v0::FieldsServerEvent::Description => event.description = None,
            v0::FieldsServerEvent::EndsAt => event.ends_at = None,
            v0::FieldsServerEvent::Image => {
                if let Some(image) = event.image.take() {
                    db.mark_attachment_as_deleted(&image.id).await.ok();
                }
            }
            v0::FieldsServerEvent::Recurrence => event.recurrence = None,
        }
    }

    if let Some(name) = data.name {
        event.name = name;
    }

    if let Some(description) = data.description {
        event.description = Some(description).filter(|d| !d.is_empty());
    }

    if let Some(starts_at) = data.starts_at {
        event.starts_at = starts_at;
    }

    if let Some(ends_at) = data.ends_at {
        event.ends_at = Some(ends_at);
    }

    if let Some(recurrence) = data.recurrence {
        event.recurrence = Some(recurrence.into());
    }

    if let Some(remind) = data.remind {
        event.remind = remind;
    }

    let location: v0::ServerEventLocation = match data.location {
        Some(location) => location,
        None => event.location.clone().into(),
    };

    validate_location(
        &server,
        &location,
        &event.starts_at,
        event.ends_at.as_ref(),
    )?;
    event.location = location.into();

    if let Some(image) = data.image {
        if let Some(previous) = event.image.take() {
            db.mark_attachment_as_deleted(&previous.id).await.ok();
        }

        event.image = Some(File::use_server_banner(db, &image, &event.id, &user.id).await?);
    }

    event.save(db).await?;

    // Relê: `interested` não passa pelo `$set`, e a resposta precisa da lista
    // que está gravada, não da que foi lida antes da edição.
    let event = db.fetch_server_event(&event.id).await?;
    Ok(Json(event.into()))
}

/// # Delete Server Event
///
/// Delete a scheduled event. Its creator or anyone with `ManageEvents` may delete.
#[openapi(tag = "Server Events")]
#[delete("/<target>/events/<event_id>")]
pub async fn delete_event(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    event_id: String,
) -> Result<EmptyResponse> {
    let server = target.as_server(db).await?;
    let event = fetch_event_in_server(db, &server, &event_id).await?;
    throw_if_cannot_manage(db, &user, &server, &event).await?;

    event.delete(db).await.map(|_| EmptyResponse)
}

/// # Mark Interest In Server Event
///
/// Mark yourself as interested in a scheduled event.
#[openapi(tag = "Server Events")]
#[put("/<target>/events/<event_id>/interested")]
pub async fn add_interest(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    event_id: String,
) -> Result<EmptyResponse> {
    set_interest(db, user, target, event_id, true).await
}

/// # Remove Interest In Server Event
///
/// Remove yourself from the interested list of a scheduled event.
#[openapi(tag = "Server Events")]
#[delete("/<target>/events/<event_id>/interested")]
pub async fn remove_interest(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    event_id: String,
) -> Result<EmptyResponse> {
    set_interest(db, user, target, event_id, false).await
}

async fn set_interest(
    db: &Database,
    user: User,
    target: Reference<'_>,
    event_id: String,
    interested: bool,
) -> Result<EmptyResponse> {
    let server = target.as_server(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    if !query.are_we_a_member().await {
        return Err(create_error!(NotFound));
    }

    let event = fetch_event_in_server(db, &server, &event_id).await?;
    event
        .set_interest(db, &user.id, interested)
        .await
        .map(|_| EmptyResponse)
}
