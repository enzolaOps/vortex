use revolt_database::{
    util::{
        permissions::DatabasePermissionQuery,
        privacidade_do_servidor::{verificar_contato, Contato},
        reference::Reference,
    },
    Channel, Database, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_user_permissions, UserPermission};
use revolt_result::Result;
use rocket::{serde::json::Json, State};

/// # Open Direct Message
///
/// Open a DM with another user.
///
/// If the target is oneself, a saved messages channel is returned.
#[openapi(tag = "Direct Messaging")]
#[get("/<target>/dm")]
pub async fn open_dm(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
) -> Result<Json<v0::Channel>> {
    let target = target.as_user(db).await?;

    let mut query = DatabasePermissionQuery::new(db, &user).user(&target);
    calculate_user_permissions(&mut query)
        .await
        .throw_if_lacking_user_permission(UserPermission::SendMessage)?;

    // Vortex: a privacidade por servidor do destinatário. A conversa que já
    // existe passa lá dentro — ela é vínculo, e reabri-la não é contato novo.
    verificar_contato(db, &user, &target, Contato::Dm).await?;

    Channel::create_dm(db, &user, &target)
        .await
        .map(Into::into)
        .map(Json)
}

#[cfg(test)]
mod test {
    use crate::{rocket, util::test::TestHarness};
    use rocket::http::{Header, Status};
    use serde_json::{json, Value};

    fn privacidade(dm: &str) -> Value {
        let escolha = json!({
            "dm": dm,
            "filtro": "nao",
            "mostrarPresenca": true,
            "mostrarAtividade": false,
            "permitirAmizade": true,
        });
        json!({ "versao": 2, "padrao": escolha, "porServidor": {} })
    }

    #[rocket::async_test]
    async fn privacidade_por_servidor_barra_dm_nova() {
        let harness = TestHarness::new().await;
        let (_, _, dono) = harness.new_user().await;
        let (_, sessao, remetente) = harness.new_user().await;
        let (_, _, destinatario) = harness.new_user().await;
        harness
            .new_server_with_member_dms(&dono, &[&remetente, &destinatario])
            .await;

        let abrir = || {
            harness
                .client
                .get(format!("/users/{}/dm", destinatario.id))
                .header(Header::new("x-session-token", sessao.token.to_string()))
                .dispatch()
        };

        // O formato sem versão é de quem nunca escolheu, e os testes de
        // `privacidade_do_servidor` guardam que ele não barra. Aqui não dá
        // para conferir por rota: a DM aberta viraria vínculo e mascararia o
        // caso seguinte.
        harness
            .set_server_privacy(&destinatario, privacidade("ninguem"))
            .await;

        let resposta = abrir().await;
        assert_eq!(resposta.status(), Status::Forbidden);
        let corpo: Value = resposta.into_json().await.expect("erro em JSON");
        assert_eq!(corpo["type"], "PrivacyRestricted");

        // Cargo em comum, sem cargo nenhum: também barra.
        harness
            .set_server_privacy(&destinatario, privacidade("cargoComum"))
            .await;
        assert_eq!(abrir().await.status(), Status::Forbidden);

        // Liberado: abre, e a DM criada passa a ser vínculo mesmo se fechar.
        harness
            .set_server_privacy(&destinatario, privacidade("todos"))
            .await;
        assert_eq!(abrir().await.status(), Status::Ok);
        harness
            .set_server_privacy(&destinatario, privacidade("ninguem"))
            .await;
        assert_eq!(abrir().await.status(), Status::Ok);
    }
}
