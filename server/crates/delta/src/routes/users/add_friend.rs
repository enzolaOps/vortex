use revolt_database::util::privacidade_do_servidor::{verificar_contato, Contato};
use revolt_database::util::reference::Reference;
use revolt_database::{Database, User, AMQP};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use rocket::State;

/// # Accept Friend Request
///
/// Accept another user's friend request.
#[openapi(tag = "Relationships")]
#[put("/<target>/friend")]
pub async fn add(
    db: &State<Database>,
    amqp: &State<AMQP>,
    mut user: User,
    target: Reference<'_>,
) -> Result<Json<v0::User>> {
    let mut target = target.as_user(db).await?;

    if user.bot.is_some() || target.bot.is_some() {
        return Err(create_error!(IsBot));
    }

    // Vortex: esta rota também CRIA pedido quando não há relação — sem a
    // checagem aqui, ela contornaria a de `send_friend_request`.
    verificar_contato(db, &user, &target, Contato::Amizade).await?;
    user.add_friend(db, amqp, &mut target).await?;
    Ok(Json(target.into(db, &user).await))
}
