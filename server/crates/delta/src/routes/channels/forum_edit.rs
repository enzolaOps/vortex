use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, PartialChannel, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

/// # Edit Forum Tags
///
/// Vortex: replaces the tags available to posts in a forum or media channel.
#[openapi(tag = "Channel Information")]
#[patch("/<target>/forum", data = "<data>")]
pub async fn edit_forum(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataEditForum>,
) -> Result<Json<v0::Channel>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut channel = target.as_channel(db).await?;
    let Some(mut forum) = channel.forum().cloned() else {
        return Err(create_error!(InvalidOperation));
    };

    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    calculate_channel_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageChannel)?;

    for (index, tag) in data.tags.iter().enumerate() {
        let name_ok = !tag.name.trim().is_empty() && tag.name.chars().count() <= 32;
        let id_ok = !tag.id.is_empty() && tag.id.len() <= 32;
        // The colour reaches the client as style, so only `#rrggbb` passes.
        let colour_ok = tag.colour.as_ref().is_none_or(|colour| {
            colour.len() == 7
                && colour.starts_with('#')
                && colour[1..].chars().all(|c| c.is_ascii_hexdigit())
        });
        let unique = !data.tags[..index].iter().any(|other| other.id == tag.id);

        if !(name_ok && id_ok && colour_ok && unique) {
            return Err(create_error!(FailedValidation {
                error: format!("invalid tag at {index}")
            }));
        }
    }

    forum.tags = data.tags;

    channel
        .update(
            db,
            PartialChannel {
                forum: Some(forum),
                ..Default::default()
            },
            vec![],
        )
        .await?;

    Ok(Json(channel.into()))
}
