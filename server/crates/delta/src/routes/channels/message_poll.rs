//! Enquete em mensagem (Vortex).
//!
//! Criar é o mesmo `POST /channels/<id>/messages` com o campo `poll` — assim a
//! enquete passa por idempotência, modo lento e reconciliação por nonce como
//! qualquer mensagem. Aqui ficam só votar e encerrar.

use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;

/// # Vote On Poll
///
/// Replace your vote on a message's poll. An empty list removes the vote.
#[openapi(tag = "Interactions")]
#[put("/<target>/messages/<msg>/poll/votes", data = "<data>")]
pub async fn vote_poll(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    msg: Reference<'_>,
    data: Json<v0::DataPollVote>,
) -> Result<EmptyResponse> {
    let channel = target.as_channel(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    calculate_channel_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;

    let message = msg.as_message_in_channel(db, channel.id()).await?;
    message
        .vote_poll(db, &user, data.into_inner().answers)
        .await
        .map(|_| EmptyResponse)
}

/// # End Poll
///
/// Stop a message's poll from accepting votes. Its author or anyone with
/// `ManageMessages` may end it.
#[openapi(tag = "Interactions")]
#[post("/<target>/messages/<msg>/poll/end")]
pub async fn end_poll(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    msg: Reference<'_>,
) -> Result<EmptyResponse> {
    let channel = target.as_channel(db).await?;
    let mut message = msg.as_message_in_channel(db, channel.id()).await?;

    if message.author != user.id {
        let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
        let permissions = calculate_channel_permissions(&mut query).await;
        if !permissions.has_channel_permission(ChannelPermission::ManageMessages) {
            return Err(create_error!(MissingPermission {
                permission: ChannelPermission::ManageMessages.to_string()
            }));
        }
    }

    message.end_poll(db).await.map(|_| EmptyResponse)
}
