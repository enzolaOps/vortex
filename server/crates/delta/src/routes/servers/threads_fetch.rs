use std::collections::HashSet;

use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::Result;
use rocket::{serde::json::Json, State};

/// # Fetch Threads
///
/// Vortex: threads of a server that the user can see, with their opening
/// messages and message counts. Active by default; `archived=true` lists the
/// archived ones, and `channel` narrows to one channel (a forum, for example).
#[openapi(tag = "Server Information")]
#[get("/<target>/threads?<options..>")]
pub async fn fetch_threads(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    options: v0::OptionsFetchThreads,
) -> Result<Json<v0::ThreadListResponse>> {
    let server = target.as_server(db).await?;

    let threads = db
        .fetch_threads(
            &[server.id.clone()],
            options.channel.as_deref(),
            Some(options.archived.unwrap_or(false)),
        )
        .await?;

    let mut visible = vec![];
    for thread in threads {
        let can_view = {
            let mut query = DatabasePermissionQuery::new(db, &user)
                .channel(&thread)
                .server(&server);
            calculate_channel_permissions(&mut query)
                .await
                .has_channel_permission(ChannelPermission::ViewChannel)
        };

        if can_view {
            visible.push(thread);
        }
    }

    let ids: Vec<String> = visible.iter().map(|thread| thread.id().to_string()).collect();
    let message_counts = if ids.is_empty() {
        Default::default()
    } else {
        db.count_messages_in_channels(&ids).await?
    };

    let opening_ids: Vec<String> = visible
        .iter()
        .filter_map(|thread| thread.thread().and_then(|info| info.message.clone()))
        .collect();

    // A deleted opening message must not take the whole list down with it.
    let messages = if opening_ids.is_empty() {
        vec![]
    } else {
        db.fetch_messages_by_id(&opening_ids)
            .await
            .unwrap_or_default()
    };

    let author_ids: Vec<String> = messages
        .iter()
        .map(|message| message.author.clone())
        .collect::<HashSet<String>>()
        .into_iter()
        .collect();

    let users = if author_ids.is_empty() {
        vec![]
    } else {
        User::fetch_many_ids_as_mutuals(db, &user, &author_ids)
            .await
            .unwrap_or_default()
    };

    Ok(Json(v0::ThreadListResponse {
        threads: visible.into_iter().map(Into::into).collect(),
        messages: messages
            .into_iter()
            .map(|message| message.into_model(None, None))
            .collect(),
        users,
        message_counts,
    }))
}
