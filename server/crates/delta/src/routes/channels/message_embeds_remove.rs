use revolt_database::{
    embeds_without_generated,
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, MessageFlagsValue, PartialMessage, User,
};
use revolt_models::v0::MessageFlags;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::Result;
use rocket::State;
use rocket_empty::EmptyResponse;

/// # Remove Embeds from Message
///
/// Vortex: removes the link previews generated for a message and marks it with
/// `SuppressEmbeds`, so they are not generated again on a later edit.
///
/// Embeds the author sent explicitly (`Text`) are kept.
///
/// The author can always do this; anyone else requires `ManageMessages`.
#[openapi(tag = "Messaging")]
#[delete("/<target>/messages/<msg>/embeds")]
pub async fn remove_embeds(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    msg: Reference<'_>,
) -> Result<EmptyResponse> {
    let channel = target.as_channel(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;

    let mut message = msg.as_message_in_channel(db, channel.id()).await?;
    if message.author != user.id {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageMessages)?;
    }

    let mut flags = MessageFlagsValue(message.flags.unwrap_or_default());
    flags.set(MessageFlags::SuppressEmbeds, true);
    let embeds = embeds_without_generated(message.embeds.as_ref());

    message
        .update(
            db,
            PartialMessage {
                embeds: Some(embeds),
                flags: Some(flags.0),
                ..Default::default()
            },
            vec![],
        )
        .await
        .map(|_| EmptyResponse)
}
