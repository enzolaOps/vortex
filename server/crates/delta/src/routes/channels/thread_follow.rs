use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Channel, Database, PartialChannel, User,
};
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::State;
use rocket_empty::EmptyResponse;

/// Adds or removes the user from the followers of a thread.
async fn set_following(
    db: &Database,
    user: &User,
    target: Reference<'_>,
    follow: bool,
) -> Result<EmptyResponse> {
    let mut channel: Channel = target.as_channel(db).await?;
    // The derived state, so following an idle thread does not publish it as
    // active — see `Channel::thread_archived`.
    let Some(mut info) = channel.thread_now(&revolt_database::thread_archive_cutoff_now()) else {
        return Err(create_error!(InvalidOperation));
    };

    let mut query = DatabasePermissionQuery::new(db, user).channel(&channel);
    calculate_channel_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;

    let following = info.followers.iter().any(|id| id == &user.id);
    if following == follow {
        return Err(create_error!(NoEffect));
    }

    if follow {
        info.followers.push(user.id.clone());
    } else {
        info.followers.retain(|id| id != &user.id);
    }

    channel
        .update(
            db,
            PartialChannel {
                thread: Some(info),
                ..Default::default()
            },
            vec![],
        )
        .await?;

    Ok(EmptyResponse)
}

/// # Follow Thread
///
/// Vortex: follow a thread.
#[openapi(tag = "Channel Information")]
#[put("/<target>/follow")]
pub async fn follow_thread(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    set_following(db, &user, target, true).await
}

/// # Unfollow Thread
///
/// Vortex: stop following a thread.
#[openapi(tag = "Channel Information")]
#[delete("/<target>/follow")]
pub async fn unfollow_thread(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    set_following(db, &user, target, false).await
}
