use revolt_database::{
    thread_archive_cutoff_now,
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    Database, PartialChannel, User,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use ulid::Ulid;
use validator::Validate;

/// # Edit Thread
///
/// Vortex: renames, archives, reopens, retags, pins or marks a thread as in
/// review. The one who started the thread can rename, archive, reopen and
/// retag it; so can anyone who manages the channel. Pinning and review are
/// moderation of the forum and take the permission to manage messages.
#[openapi(tag = "Channel Information")]
#[patch("/<target>/thread", data = "<data>")]
pub async fn edit_thread(
    db: &State<Database>,
    user: User,
    target: Reference<'_>,
    data: Json<v0::DataEditThread>,
) -> Result<Json<v0::Channel>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    let mut channel = target.as_channel(db).await?;
    // Starts from the derived state, so an edit to an idle thread publishes it
    // as the archived thread it already is.
    let Some(mut info) = channel.thread_now(&thread_archive_cutoff_now()) else {
        return Err(create_error!(InvalidOperation));
    };

    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    let permissions = calculate_channel_permissions(&mut query).await;
    permissions.throw_if_lacking_channel_permission(ChannelPermission::ViewChannel)?;
    // Pinning and review alone are moderation of the forum, not of the
    // thread, and are checked on their own below.
    let edits_thread = data.name.is_some() || data.archived.is_some() || data.tags.is_some();
    if edits_thread && info.owner != user.id {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageChannel)?;
    }

    if !edits_thread && data.pinned.is_none() && data.in_review.is_none() {
        return Err(create_error!(NoEffect));
    }

    // Pinning orders the forum for everyone, so starting the post is not
    // enough: it takes the same permission as pinning a message.
    if let Some(pinned) = data.pinned {
        let parent = db.fetch_channel(&info.parent).await?;
        if parent.forum().is_none() {
            return Err(create_error!(InvalidOperation));
        }

        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageMessages)?;
        info.pinned = pinned;
    }

    // "In review" is the state of a post: the team looking into it. Like a
    // pin it tells everyone something about the forum, so it takes the same
    // permission.
    if let Some(in_review) = data.in_review {
        let parent = db.fetch_channel(&info.parent).await?;
        if parent.forum().is_none() {
            return Err(create_error!(InvalidOperation));
        }

        permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageMessages)?;
        info.in_review = in_review;
    }

    if let Some(archived) = data.archived {
        // Reopening by hand is activity: without it, a thread idle for a week
        // would count as archived again the moment it was reopened.
        if info.archived && !archived {
            info.reopened = Some(Ulid::new().to_string());
        }

        info.archived = archived;
    }

    if let Some(tags) = data.tags {
        if !tags.is_empty() {
            let parent = db.fetch_channel(&info.parent).await?;
            let Some(forum) = parent.forum() else {
                return Err(create_error!(InvalidOperation));
            };

            if tags
                .iter()
                .any(|tag| !forum.tags.iter().any(|known| &known.id == tag))
            {
                return Err(create_error!(InvalidOperation));
            }
        }

        info.tags = tags;
    }

    channel
        .update(
            db,
            PartialChannel {
                name: data.name,
                thread: Some(info),
                ..Default::default()
            },
            vec![],
        )
        .await?;

    Ok(Json(channel.into()))
}

#[cfg(test)]
mod test {
    use std::collections::HashMap;

    use crate::util::test::TestHarness;
    use revolt_database::{Channel, Member};
    use revolt_models::v0;
    use rocket::http::{ContentType, Header, Status};
    use ulid::Ulid;

    const DAY: u64 = 24 * 60 * 60 * 1000;

    fn thread_of(channel: &v0::Channel) -> v0::ThreadInformation {
        match channel {
            v0::Channel::TextChannel {
                thread: Some(thread),
                ..
            } => thread.clone(),
            _ => panic!("not a thread"),
        }
    }

    async fn forum(harness: &TestHarness, server: &revolt_database::Server) -> Channel {
        Channel::create_server_channel(
            &harness.db,
            &mut server.clone(),
            v0::DataCreateServerChannel {
                channel_type: v0::LegacyServerChannelType::Forum,
                name: "ideias".to_string(),
                ..Default::default()
            },
            true,
        )
        .await
        .expect("`Channel`")
    }

    /// "Em análise" é moderação do fórum: quem abriu o post não marca, quem
    /// gerencia mensagens marca — a mesma régua de fixar.
    #[rocket::async_test]
    async fn em_analise_exige_gerenciar_mensagens() {
        let harness = TestHarness::new().await;
        let (_, owner_session, owner) = harness.new_user().await;
        let (_, member_session, member) = harness.new_user().await;
        let (server, _) = harness.new_server(&owner).await;
        Member::create(&harness.db, &server, &member, None)
            .await
            .expect("`Member`");

        let forum = forum(&harness, &server).await;
        let post = Channel::create_thread(
            &harness.db,
            &forum,
            &member.id,
            v0::DataCreateThread {
                name: "Rail duplica a pasta".to_string(),
                message: None,
                tags: vec![],
            },
        )
        .await
        .expect("`Channel`");

        let response = harness
            .client
            .patch(format!("/channels/{}/thread", post.id()))
            .header(Header::new("x-session-token", member_session.token.to_string()))
            .header(ContentType::JSON)
            .body(json!({ "in_review": true }).to_string())
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Forbidden);
        drop(response);

        let response = harness
            .client
            .patch(format!("/channels/{}/thread", post.id()))
            .header(Header::new("x-session-token", owner_session.token.to_string()))
            .header(ContentType::JSON)
            .body(json!({ "in_review": true }).to_string())
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Ok);
        let edited: v0::Channel = response.into_json().await.expect("`Channel`");
        assert!(thread_of(&edited).in_review);
    }

    /// Uma semana sem atividade arquiva sem job; reabrir à mão conta como
    /// atividade, senão o tópico voltaria a contar como arquivado na hora.
    #[rocket::async_test]
    async fn semana_parada_arquiva_e_reabrir_reinicia_o_relogio() {
        let harness = TestHarness::new().await;
        let (_, session, owner) = harness.new_user().await;
        let (server, _) = harness.new_server(&owner).await;
        let forum = forum(&harness, &server).await;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let idle = Channel::TextChannel {
            id: Ulid::from_parts(now - 8 * DAY, 1).to_string(),
            server: server.id.clone(),
            name: "Parado".to_string(),
            description: None,
            icon: None,
            last_message_id: None,
            default_permissions: None,
            role_permissions: HashMap::new(),
            nsfw: false,
            voice: None,
            slowmode: None,
            forum: None,
            thread: Some(v0::ThreadInformation {
                parent: forum.id().to_string(),
                owner: owner.id.clone(),
                followers: vec![owner.id.clone()],
                ..Default::default()
            }),
            spoiler: false,
            invites_paused: false,
        };
        harness.db.insert_channel(&idle).await.expect("`Channel`");

        let listed = |archived: bool| {
            let path = format!(
                "/servers/{}/threads?channel={}&archived={}",
                server.id,
                forum.id(),
                archived
            );
            let token = session.token.to_string();
            let client = &harness.client;
            async move {
                let response = client
                    .get(path)
                    .header(Header::new("x-session-token", token))
                    .dispatch()
                    .await;
                assert_eq!(response.status(), Status::Ok);
                let list: v0::ThreadListResponse =
                    response.into_json().await.expect("`ThreadListResponse`");
                list.threads
            }
        };

        let archived = listed(true).await;
        assert_eq!(archived.len(), 1);
        assert!(thread_of(&archived[0]).archived);
        assert!(listed(false).await.is_empty());

        let response = harness
            .client
            .patch(format!("/channels/{}/thread", idle.id()))
            .header(Header::new("x-session-token", session.token.to_string()))
            .header(ContentType::JSON)
            .body(json!({ "archived": false }).to_string())
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Ok);
        let reopened: v0::Channel = response.into_json().await.expect("`Channel`");
        let info = thread_of(&reopened);
        assert!(!info.archived);
        assert!(info.reopened.is_some());

        assert_eq!(listed(false).await.len(), 1);
        assert!(listed(true).await.is_empty());
    }
}
