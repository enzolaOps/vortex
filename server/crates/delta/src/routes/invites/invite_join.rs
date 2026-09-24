use revolt_database::{
    util::reference::Reference, Channel, Database, Invite, Member, PartialMember,
    ServerJoinRequest, User, AMQP,
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
    // Vortex: expiry and use limit are checked here, on use, and never by a
    // job — the fork does not publish `crond`.
    invite.check_usable()?;

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

            // Vortex: count the use in the same write that checks the limit,
            // so two people can't both take the last one. A stored invite
            // without a limit is counted too (the "uses" column); only the
            // pseudo-invite of a discoverable server has nothing to count.
            let counted = db.use_invite(invite.code()).await?;
            if !counted && invite.has_max_uses() {
                return Err(create_error!(InviteExhausted));
            }

            let (member, channels) =
                match Member::create_with_roles(db, &server, &user, None, roles.clone()).await {
                    Ok(created) => created,
                    Err(err) => {
                        if counted {
                            db.release_invite_use(invite.code()).await.ok();
                        }
                        return Err(err);
                    }
                };

            if invite.is_temporary() {
                db.update_member(
                    &member.id,
                    &PartialMember {
                        temporary: Some(true),
                        ..Default::default()
                    },
                    vec![],
                )
                .await?;
            }

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

#[cfg(test)]
mod test {
    use crate::{rocket, util::test::TestHarness};
    use revolt_database::{
        iso8601_timestamp::{Duration, Timestamp},
        Invite, Member, PartialMember, Session,
    };
    use revolt_models::v0;
    use rocket::http::Status;
    use rocket::local::asynchronous::LocalResponse;

    /// Cria o convite pela ROTA, com os limites dados, e devolve o código.
    async fn create_invite(
        harness: &TestHarness,
        session: Session,
        channel: &str,
        data: v0::DataCreateInvite,
    ) -> String {
        let response = TestHarness::with_session(
            session,
            harness
                .client
                .post(format!("/channels/{channel}/invites"))
                .json(&data),
        )
        .await;
        assert_eq!(response.status(), Status::Ok);
        match response.into_json::<v0::Invite>().await.expect("`Invite`") {
            v0::Invite::Server { code, .. } => code,
            _ => unreachable!(),
        }
    }

    async fn error_type(response: LocalResponse<'_>) -> String {
        let body: serde_json::Value = response.into_json().await.expect("error body");
        body["type"].as_str().unwrap_or_default().to_string()
    }

    #[rocket::async_test]
    async fn max_uses_counts_and_refuses_the_next_join() {
        let harness = TestHarness::new().await;
        let (_, owner_session, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();

        let code = create_invite(
            &harness,
            owner_session,
            &channel,
            v0::DataCreateInvite {
                max_uses: Some(1),
                ..Default::default()
            },
        )
        .await;

        let (_, first_session, first) = harness.new_user().await;
        let response = TestHarness::with_session(
            first_session,
            harness.client.post(format!("/invites/{code}")),
        )
        .await;
        assert_eq!(response.status(), Status::Ok);
        assert!(harness.db.fetch_member(&server.id, &first.id).await.is_ok());

        match harness.db.fetch_invite(&code).await.expect("invite") {
            Invite::Server { uses, max_uses, .. } => {
                assert_eq!(uses, 1);
                assert_eq!(max_uses, Some(1));
            }
            _ => unreachable!(),
        }

        let (_, second_session, second) = harness.new_user().await;
        let response = TestHarness::with_session(
            second_session,
            harness.client.post(format!("/invites/{code}")),
        )
        .await;
        assert_eq!(response.status(), Status::Forbidden);
        assert_eq!(error_type(response).await, "InviteExhausted");
        assert!(harness.db.fetch_member(&server.id, &second.id).await.is_err());

        // A prévia diz o mesmo antes de alguém tentar entrar.
        let response = harness
            .client
            .get(format!("/invites/{code}"))
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Forbidden);
        assert_eq!(error_type(response).await, "InviteExhausted");
    }

    #[rocket::async_test]
    async fn failed_join_gives_the_use_back() {
        let harness = TestHarness::new().await;
        let (_, owner_session, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();

        let code = create_invite(
            &harness,
            owner_session,
            &channel,
            v0::DataCreateInvite {
                max_uses: Some(1),
                ..Default::default()
            },
        )
        .await;

        // Quem já é membro falha ao entrar, e a tentativa não pode gastar o uso.
        let (_, member_session, member) = harness.new_user().await;
        Member::create(&harness.db, &server, &member, None)
            .await
            .expect("member");
        let response = TestHarness::with_session(
            member_session,
            harness.client.post(format!("/invites/{code}")),
        )
        .await;
        assert_ne!(response.status(), Status::Ok);

        match harness.db.fetch_invite(&code).await.expect("invite") {
            Invite::Server { uses, .. } => assert_eq!(uses, 0),
            _ => unreachable!(),
        }
    }

    #[rocket::async_test]
    async fn expired_invite_is_refused_on_read_and_use() {
        let harness = TestHarness::new().await;
        let (_, _, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();

        // Venceu há um minuto. Nenhum job o apagou — e nenhum precisa.
        let code = TestHarness::rand_string();
        harness
            .db
            .insert_invite(&Invite::Server {
                code: code.clone(),
                server: server.id.clone(),
                creator: owner.id.clone(),
                channel,
                roles: vec![],
                uses: 0,
                max_uses: None,
                expires_at: Some(Timestamp::now_utc() + Duration::minutes(-1)),
                temporary: false,
            })
            .await
            .expect("insert");

        let response = harness
            .client
            .get(format!("/invites/{code}"))
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Forbidden);
        assert_eq!(error_type(response).await, "InviteExpired");

        let (_, session, user) = harness.new_user().await;
        let response =
            TestHarness::with_session(session, harness.client.post(format!("/invites/{code}")))
                .await;
        assert_eq!(response.status(), Status::Forbidden);
        assert_eq!(error_type(response).await, "InviteExpired");
        assert!(harness.db.fetch_member(&server.id, &user.id).await.is_err());

        // Continua listado, para a tabela dizer "expirado" e oferecer excluir.
        assert!(harness
            .db
            .fetch_invites_for_server(&server.id)
            .await
            .expect("list")
            .iter()
            .any(|invite| invite.code() == code));
    }

    #[rocket::async_test]
    async fn plain_invite_behaves_as_before() {
        let harness = TestHarness::new().await;
        let (_, owner_session, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();

        // Sem corpo, como um cliente Stoat manda.
        let response = TestHarness::with_session(
            owner_session,
            harness.client.post(format!("/channels/{channel}/invites")),
        )
        .await;
        assert_eq!(response.status(), Status::Ok);
        let body: serde_json::Value = response.into_json().await.expect("invite");
        assert!(body.get("max_uses").is_none());
        assert!(body.get("expires_at").is_none());
        assert!(body.get("temporary").is_none());
        assert!(body.get("uses").is_none());
        let code = body["_id"].as_str().expect("code").to_string();

        let (_, session, user) = harness.new_user().await;
        let response =
            TestHarness::with_session(session, harness.client.post(format!("/invites/{code}")))
                .await;
        assert_eq!(response.status(), Status::Ok);
        let member = harness
            .db
            .fetch_member(&server.id, &user.id)
            .await
            .expect("member");
        assert!(!member.temporary);

        // Sem limite, o uso é contado mesmo assim — é a coluna "Usos".
        match harness.db.fetch_invite(&code).await.expect("invite") {
            Invite::Server { uses, .. } => assert_eq!(uses, 1),
            _ => unreachable!(),
        }
    }

    #[rocket::async_test]
    async fn create_refuses_bad_limits() {
        let harness = TestHarness::new().await;
        let (_, session, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();
        let role = harness.new_role(&server, 1, None).await;

        for data in [
            v0::DataCreateInvite {
                max_uses: Some(0),
                ..Default::default()
            },
            v0::DataCreateInvite {
                max_uses: Some(1001),
                ..Default::default()
            },
            v0::DataCreateInvite {
                max_age: Some(59),
                ..Default::default()
            },
            v0::DataCreateInvite {
                max_age: Some(30 * 24 * 60 * 60 + 1),
                ..Default::default()
            },
            // Cargo é o que segura um membro temporário: os dois se contradizem.
            v0::DataCreateInvite {
                temporary: true,
                roles: vec![role.id.clone()],
                ..Default::default()
            },
        ] {
            let response = TestHarness::with_session(
                session.clone(),
                harness
                    .client
                    .post(format!("/channels/{channel}/invites"))
                    .json(&data),
            )
            .await;
            assert_ne!(response.status(), Status::Ok, "{data:?}");
        }

        let code = create_invite(
            &harness,
            session,
            &channel,
            v0::DataCreateInvite {
                max_age: Some(7 * 24 * 60 * 60),
                ..Default::default()
            },
        )
        .await;
        match harness.db.fetch_invite(&code).await.expect("invite") {
            Invite::Server {
                expires_at: Some(at),
                ..
            } => {
                let seven_days = Timestamp::now_utc() + Duration::days(7);
                assert!(*at <= *seven_days);
                assert!(*at > *(seven_days + Duration::minutes(-1)));
            }
            _ => panic!("expected an expiring server invite"),
        }
    }

    #[rocket::async_test]
    async fn temporary_member_leaves_on_disconnect_unless_given_a_role() {
        let harness = TestHarness::new().await;
        let (_, owner_session, owner) = harness.new_user().await;
        let (server, channels) = harness.new_server(&owner).await;
        let channel = channels.first().expect("channel").id().to_string();
        let role = harness.new_role(&server, 1, None).await;

        let code = create_invite(
            &harness,
            owner_session,
            &channel,
            v0::DataCreateInvite {
                temporary: true,
                ..Default::default()
            },
        )
        .await;

        let (_, guest_session, guest) = harness.new_user().await;
        let (_, kept_session, kept) = harness.new_user().await;
        for session in [guest_session, kept_session] {
            let response =
                TestHarness::with_session(session, harness.client.post(format!("/invites/{code}")))
                    .await;
            assert_eq!(response.status(), Status::Ok);
        }

        for user in [&guest, &kept] {
            let member = harness
                .db
                .fetch_member(&server.id, &user.id)
                .await
                .expect("member");
            assert!(member.temporary);
        }

        // Quem ganhou cargo fica.
        let kept_member = harness
            .db
            .fetch_member(&server.id, &kept.id)
            .await
            .expect("member");
        harness
            .db
            .update_member(
                &kept_member.id,
                &PartialMember {
                    roles: Some(vec![role.id.clone()]),
                    ..Default::default()
                },
                vec![],
            )
            .await
            .expect("role");

        // O dono nunca é temporário, e a varredura dele não mexe em nada.
        Member::create(&harness.db, &server, &owner, None)
            .await
            .expect("owner member");
        Member::remove_temporary_memberships(&harness.db, &owner.id)
            .await
            .expect("owner");
        assert!(harness.db.fetch_member(&server.id, &owner.id).await.is_ok());

        Member::remove_temporary_memberships(&harness.db, &guest.id)
            .await
            .expect("guest");
        Member::remove_temporary_memberships(&harness.db, &kept.id)
            .await
            .expect("kept");

        assert!(harness.db.fetch_member(&server.id, &guest.id).await.is_err());
        assert!(harness.db.fetch_member(&server.id, &kept.id).await.is_ok());
    }
}
