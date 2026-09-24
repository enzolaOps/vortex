use revolt_database::util::politica_de_pedido::{self, Politica};
use revolt_database::util::privacidade_do_servidor::{verificar_contato, Contato};
use revolt_database::{Database, User};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::serde::json::Json;
use rocket::State;

/// # Look Up User By Username
///
/// Vortex: resolve an exact `username#discriminator` before sending a friend
/// request, returning who it is, the relationship and whether a new request
/// would be refused.
///
/// ⚠ Not a search. The full name is required, the username is compared with
/// its exact case (the design's rule: "ele diferencia maiúsculas e
/// minúsculas"), and there is no prefix or partial match — the answer is the
/// same existence bit `POST /users/friend` already reveals, without creating a
/// request. The body carries the name so it never lands in a URL or proxy log,
/// and the route has its own ratelimit bucket (`user_lookup`).
#[openapi(tag = "Relationships")]
#[post("/lookup", data = "<data>")]
pub async fn lookup_user(
    db: &State<Database>,
    user: User,
    data: Json<v0::DataSendFriendRequest>,
) -> Result<Json<v0::FriendLookup>> {
    let Some((username, discriminator)) = data.username.split_once('#') else {
        return Err(create_error!(InvalidProperty));
    };

    let target = db.fetch_user_by_username(username, discriminator).await?;
    // The lookup is case-insensitive in both databases; the exact case is the
    // contract of this route.
    if target.username != username {
        return Err(create_error!(NotFound));
    }

    let restriction = restricao(db, &user, &target).await;

    Ok(Json(v0::FriendLookup {
        display_name: target
            .display_name
            .clone()
            .unwrap_or_else(|| target.username.clone()),
        relationship: user.relationship_with(&target.id).into(),
        id: target.id,
        restriction,
    }))
}

/// The same two checks `send_friend_request` makes, in the same order, turned
/// into a reason instead of an error.
async fn restricao(
    db: &Database,
    user: &User,
    target: &User,
) -> Option<v0::FriendRequestRestriction> {
    if target.bot.is_some() {
        return Some(v0::FriendRequestRestriction::Bot);
    }
    if let Some(politica) = politica_de_pedido::recusa(db, user, target).await {
        return Some(match politica {
            Politica::Ninguem => v0::FriendRequestRestriction::Nobody,
            Politica::AmigosDeAmigos => v0::FriendRequestRestriction::FriendsOfFriends,
            Politica::MeusServidores => v0::FriendRequestRestriction::MutualServers,
            // `recusa` never refuses with `Todos`.
            Politica::Todos => return None,
        });
    }
    if verificar_contato(db, user, target, Contato::Amizade)
        .await
        .is_err()
    {
        return Some(v0::FriendRequestRestriction::ServerPrivacy);
    }
    None
}

#[cfg(test)]
mod test {
    use crate::{rocket, util::test::TestHarness};
    use revolt_database::User;
    use rocket::http::{ContentType, Header, Status};
    use serde_json::{json, Value};

    fn nome(u: &User) -> String {
        format!("{}#{}", u.username, u.discriminator)
    }

    #[rocket::async_test]
    async fn consulta_exige_nome_completo_e_caixa_exata() {
        let harness = TestHarness::new().await;
        let (_, sessao, _) = harness.new_user().await;
        let (_, _, alvo) = harness.new_user().await;

        let consultar = |username: String| {
            harness
                .client
                .post("/users/lookup")
                .header(Header::new("x-session-token", sessao.token.clone()))
                .header(ContentType::JSON)
                .body(json!({ "username": username }).to_string())
                .dispatch()
        };

        let resposta = consultar(nome(&alvo)).await;
        assert_eq!(resposta.status(), Status::Ok);
        let corpo: Value = resposta.into_json().await.expect("JSON");
        assert_eq!(corpo["_id"], alvo.id);
        assert_eq!(corpo["relationship"], "None");
        assert!(corpo.get("restriction").is_none());

        // Sem discriminador não é consulta: não há busca parcial.
        assert_eq!(
            consultar(alvo.username.clone()).await.status(),
            Status::BadRequest
        );

        // Mesma letra, outra caixa: não existe para esta rota.
        let outra_caixa = format!(
            "{}#{}",
            alvo.username.to_uppercase(),
            alvo.discriminator
        );
        if outra_caixa != nome(&alvo) {
            assert_eq!(consultar(outra_caixa).await.status(), Status::NotFound);
        }
    }

    #[rocket::async_test]
    async fn consulta_diz_a_politica_que_recusaria() {
        let harness = TestHarness::new().await;
        let (_, sessao, _) = harness.new_user().await;
        let (_, _, alvo) = harness.new_user().await;
        harness
            .set_friend_request_policy(&alvo, "amigosDeAmigos")
            .await;

        let resposta = harness
            .client
            .post("/users/lookup")
            .header(Header::new("x-session-token", sessao.token.clone()))
            .header(ContentType::JSON)
            .body(json!({ "username": nome(&alvo) }).to_string())
            .dispatch()
            .await;
        assert_eq!(resposta.status(), Status::Ok);
        let corpo: Value = resposta.into_json().await.expect("JSON");
        assert_eq!(corpo["restriction"], "FriendsOfFriends");
    }
}
