use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Channel, Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

/// # Create Thread
///
/// Vortex: starts a thread inside a server text channel, optionally from one of
/// its messages. In a forum or media channel the thread is a post, and its
/// first message is the post body.
#[openapi(tag = "Channel Information")]
#[post("/<target>/threads", data = "<data>")]
pub async fn create_thread(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataCreateThread>,
) -> Result<Json<v0::Channel>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let parent = target.as_channel(db).await?;

    // Only a server text channel can hold threads, and a thread cannot hold
    // another one.
    if !matches!(parent, Channel::TextChannel { .. }) || parent.thread().is_some() {
        return Err(create_error!(InvalidOperation));
    }

    let mut query = DatabasePermissionQuery::new(db, &user).channel(&parent);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::SendMessage)?;

    // Tags must exist in the parent's forum.
    if !data.tags.is_empty() {
        let Some(forum) = parent.forum() else {
            return Err(create_error!(InvalidOperation));
        };

        if data
            .tags
            .iter()
            .any(|tag| !forum.tags.iter().any(|known| &known.id == tag))
        {
            return Err(create_error!(InvalidOperation));
        }
    }

    if let Some(message_id) = &data.message {
        // A post has no message of origin: it starts with its own.
        if parent.forum().is_some() {
            return Err(create_error!(InvalidOperation));
        }

        let message = Reference::from_unchecked(message_id)
            .as_message_in_channel(db, parent.id())
            .await?;

        // One thread per message: asking again answers with the existing one.
        let server = parent.server().unwrap_or_default().to_string();
        if let Some(existing) = db
            .fetch_threads(&[server], Some(parent.id()), None)
            .await?
            .into_iter()
            .find(|thread| {
                thread
                    .thread()
                    .and_then(|info| info.message.as_deref())
                    == Some(message.id.as_str())
            })
        {
            return Ok(Json(existing.into()));
        }
    }

    let thread = Channel::create_thread(db, &parent, &user.id, data).await?;
    Ok(Json(thread.into()))
}
