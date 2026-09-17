// use revolt_database::util::reference::Reference;
use revolt_database::util::privacidade_do_servidor::{verificar_contato, Contato};
use revolt_database::{Database, User, AMQP};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use rocket::State;

/// # Send Friend Request
///
/// Send a friend request to another user.
#[openapi(tag = "Relationships")]
#[post("/friend", data = "<data>")]
pub async fn send_friend_request(
    db: &State<Database>,
    amqp: &State<AMQP>,
    mut user: User,
    data: Json<v0::DataSendFriendRequest>,
) -> Result<Json<v0::User>> {
    if let Some((username, discriminator)) = data.username.split_once('#') {
        let mut target = db.fetch_user_by_username(username, discriminator).await?;

        if user.bot.is_some() || target.bot.is_some() {
            return Err(create_error!(IsBot));
        }

        // Vortex: só pedido NOVO passa pela privacidade por servidor; aceitar
        // um pedido recebido é resposta, e `verificar_contato` o libera.
        verificar_contato(db, &user, &target, Contato::Amizade).await?;
        user.add_friend(db, amqp, &mut target).await?;
        Ok(Json(target.into(db, &user).await))
    } else {
        Err(create_error!(InvalidProperty))
    }
}

#[cfg(test)]
mod test {
    use crate::{rocket, util::test::TestHarness};
    use rocket::http::{ContentType, Header, Status};
    use serde_json::{json, Value};

    fn privacidade(permitir_amizade: bool) -> Value {
        let escolha = json!({
            "dm": "todos",
            "filtro": "nao",
            "mostrarPresenca": true,
            "mostrarAtividade": false,
            "permitirAmizade": permitir_amizade,
        });
        json!({ "versao": 2, "padrao": escolha, "porServidor": {} })
    }

    #[rocket::async_test]
    async fn privacidade_por_servidor_barra_pedido_de_amizade() {
        let harness = TestHarness::new().await;
        let (_, _, dono) = harness.new_user().await;
        let (_, sessao, remetente) = harness.new_user().await;
        let (_, sessao_destinatario, destinatario) = harness.new_user().await;
        harness
            .new_server_with_member_dms(&dono, &[&remetente, &destinatario])
            .await;
        harness
            .set_server_privacy(&destinatario, privacidade(false))
            .await;

        let pedir = |token: String, username: String| {
            harness
                .client
                .post("/users/friend")
                .header(Header::new("x-session-token", token))
                .header(ContentType::JSON)
                .body(json!({ "username": username }).to_string())
                .dispatch()
        };
        let nome = |u: &revolt_database::User| format!("{}#{}", u.username, u.discriminator);

        let resposta = pedir(sessao.token.clone(), nome(&destinatario)).await;
        assert_eq!(resposta.status(), Status::Forbidden);
        let corpo: Value = resposta.into_json().await.expect("erro em JSON");
        assert_eq!(corpo["type"], "PrivacyRestricted");

        // A rota por ID também cria pedido, e não pode contornar a regra.
        let por_id = harness
            .client
            .put(format!("/users/{}/friend", destinatario.id))
            .header(Header::new("x-session-token", sessao.token.clone()))
            .dispatch()
            .await;
        assert_eq!(por_id.status(), Status::Forbidden);

        // Quem restringiu continua podendo pedir, e a resposta ao pedido dele
        // é aceitar, que a regra não barra.
        let inverso = pedir(sessao_destinatario.token.clone(), nome(&remetente)).await;
        assert_eq!(inverso.status(), Status::Ok);
        let aceitar = pedir(sessao.token.clone(), nome(&destinatario)).await;
        assert_eq!(aceitar.status(), Status::Ok);
    }
}
