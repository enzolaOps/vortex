use revolt_database::{
    util::reference::Reference, Channel, Database, Invite, Member, ServerJoinRequest, User, AMQP,
};
use revolt_models::v0::{self, InviteJoinResponse};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};

/// # Join Invite
///
/// Join an invite by its ID
#[openapi(tag = "Invites")]
#[post("/<target>")]
pub async fn join(
    db: &State<Database>,
    amqp: &State<AMQP>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::InviteJoinResponse>> {
    if user.bot.is_some() {
        return Err(create_error!(IsBot));
    }

    user.can_acquire_server(db).await?;

    let invite = target.as_invite(db).await?;
    match &invite {
        Invite::Server {
            server,
            channel,
            roles,
            ..
        } => {
            // Vortex: um canal com convites pausados recusa a entrada sem apagar
            // o convite — despausar devolve o link a quem já o tinha.
            if let Channel::TextChannel {
                invites_paused: true,
                ..
            } = db.fetch_channel(channel).await?
            {
                return Err(create_error!(InvitesPaused));
            }

            let server = db.fetch_server(server).await?;

            // Vortex: política de entrada. Servidor sem `security` passa direto.
            if server.check_join_policy(db, &user).await? {
                if db.fetch_ban(&server.id, &user.id).await.is_ok() {
                    return Err(create_error!(Banned));
                }

                if db.fetch_member(&server.id, &user.id).await.is_ok() {
                    return Err(create_error!(AlreadyInServer));
                }

                // Aprovação manual: o convite vira pedido. Responder com erro e
                // não com uma variante nova de `InviteJoinResponse` é o que
                // mantém cliente antigo funcionando — ele mostra a falha em vez
                // de tratar um pedido como entrada.
                ServerJoinRequest::create(db, &server, &user).await?;
                return Err(create_error!(JoinRequestPending));
            }

            let (_, channels) =
                Member::create_with_roles(db, &server, &user, None, roles.clone()).await?;

            Ok(Json(InviteJoinResponse::Server {
                channels: channels.into_iter().map(|c| c.into()).collect(),
                server: server.into(db).await,
            }))
        }
        Invite::Group {
            channel, creator, ..
        } => {
            let mut channel = db.fetch_channel(channel).await?;
            channel.add_user_to_group(db, amqp, &user, creator).await?;
            if let Channel::Group { recipients, .. } = &channel {
                Ok(Json(InviteJoinResponse::Group {
                    users: User::fetch_many_ids_as_mutuals(db, &user, recipients).await?,
                    channel: channel.into(),
                }))
            } else {
                unreachable!()
            }
        }
    }
}
