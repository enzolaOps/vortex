use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, Message, MessageFilter, MessageQuery, MessageTimePeriod, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

/// # Search for Messages in Server
///
/// Searches every channel of this server that you can read.
///
/// Vortex: same options and cursors as the per-channel search. Channels you
/// cannot view, or whose history you cannot read, are left out of the query
/// before it reaches the database, so a hidden channel never contributes a
/// result, not even to the ordering.
#[openapi(tag = "Messaging")]
#[post("/<target>/search", data = "<options>")]
pub async fn search(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    options: Json<v0::DataMessageSearch>,
) -> Result<Json<v0::BulkMessageResponse>> {
    if user.bot.is_some() {
        return Err(create_error!(IsBot));
    }

    let options = options.into_inner();
    options.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    if options.query.is_some() && options.pinned.is_some() {
        return Err(create_error!(InvalidOperation));
    }

    let server = target.as_server(db).await?;

    // Only members search a server. The permission check below would hide
    // every channel from a stranger anyway, but an empty page would read as
    // "nothing found" instead of "not yours".
    db.fetch_member(&server.id, &user.id).await?;

    let query = DatabasePermissionQuery::new(db, &user).server(&server);
    let mut readable = Vec::new();

    for channel in db.fetch_channels(&server.channels).await? {
        let mut channel_query = query.clone().channel(&channel);
        let permissions = calculate_channel_permissions(&mut channel_query).await;

        if permissions.has_channel_permission(ChannelPermission::ViewChannel)
            && permissions.has_channel_permission(ChannelPermission::ReadMessageHistory)
        {
            readable.push(channel.id().to_string());
        }
    }

    let v0::DataMessageSearch {
        query,
        pinned,
        limit,
        before,
        after,
        sort,
        include_users,
        author,
        has,
    } = options;

    Message::fetch_with_users(
        db,
        MessageQuery {
            filter: MessageFilter {
                channels: Some(readable),
                query,
                pinned,
                author,
                has,
                ..Default::default()
            },
            time_period: MessageTimePeriod::Absolute {
                before,
                after,
                sort: Some(sort),
            },
            limit,
        },
        &user,
        include_users,
        Some(server.id.as_str()),
    )
    .await
    .map(Json)
}
