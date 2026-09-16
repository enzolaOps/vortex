use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, PartialChannel, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

/// # Edit Thread
///
/// Vortex: renames, archives, reopens, retags or pins a thread. The one who started
/// the thread can do it; so can anyone who manages the channel.
#[openapi(tag = "Channel Information")]
#[patch("/<target>/thread", data = "<data>")]
pub async fn edit_thread(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataEditThread>,
) -> Result<Json<v0::Channel>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut channel = target.as_channel(db).await?;
    let Some(mut info) = channel.thread().cloned() else {
        return Err(create_error!(InvalidOperation));
    };

    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;
    // Pinning alone is a moderation of the forum, not of the thread, and is
    // checked on its own below.
    let edits_thread = data.name.is_some() || data.archived.is_some() || data.tags.is_some();
    if edits_thread && info.owner != user.id {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageChannel)?;
    }

    if !edits_thread && data.pinned.is_none() {
        return Err(create_error!(NoEffect));
    }

    // Pinning orders the forum for everyone, so starting the post is not
    // enough: it takes the same permission as pinning a message.
    if let Some(pinned) = data.pinned {
        let parent = db.fetch_channel(&info.parent).await?;
        if parent.forum().is_none() {
            return Err(create_error!(InvalidOperation));
        }

        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageMessages)?;
        info.pinned = pinned;
    }

    if let Some(archived) = data.archived {
        info.archived = archived;
    }

    if let Some(tags) = data.tags {
        if !tags.is_empty() {
            let parent = db.fetch_channel(&info.parent).await?;
            let Some(forum) = parent.forum() else {
                return Err(create_error!(InvalidOperation));
            };

            if tags
                .iter()
                .any(|tag| !forum.tags.iter().any(|known| &known.id == tag))
            {
                return Err(create_error!(InvalidOperation));
            }
        }

        info.tags = tags;
    }

    channel
        .update(
            db,
            PartialChannel {
                name: data.name,
                thread: Some(info),
                ..Default::default()
            },
            vec![],
        )
        .await?;

    Ok(Json(channel.into()))
}
