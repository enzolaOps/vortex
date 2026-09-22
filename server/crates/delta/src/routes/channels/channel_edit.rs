use revolt_database::{
    util::{permissions::DatabasePermissionQuery, reference::Reference},
    voice::{delete_voice_channel, UserVoiceChannel, VoiceClient},
    AuditLogEntryAction, Channel, Database, FieldsChannel, File, PartialChannel, SystemMessage,
    User, AMQP,
};
use revolt_models::v0;
use revolt_permissions::{calculate_channel_permissions, ChannelPermission};
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use validator::Validate;

use crate::util::{
    audit_log_reason::AuditLogReason,
    voice::{keep_voice_kind, validate_voice_information},
};

/// # Edit Channel
///
/// Edit a channel object by its id.
#[openapi(tag = "Channel Information")]
#[patch("/<target>", data = "<data>")]
pub async fn edit(
    db: &State<Database>,
    voice_client: &State<VoiceClient>,
    amqp: &State<AMQP>,
    user: User,
    reason: AuditLogReason,
    target: Reference<'_>,
    data: Json<v0::DataEditChannel>,
) -> Result<Json<v0::Channel>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    if let Some(voice) = &data.voice {
        validate_voice_information(voice).await?;
    }

    let mut channel = target.as_channel(db).await?;
    let mut query = DatabasePermissionQuery::new(db, &user).channel(&channel);
    calculate_channel_permissions(&mut query)
        .await
        .throw_if_lacking_channel_permission(ChannelPermission::ManageChannel)?;

    if data.name.is_none()
        && data.description.is_none()
        && data.icon.is_none()
        && data.nsfw.is_none()
        && data.owner.is_none()
        && data.voice.is_none()
        && data.slowmode.is_none()
        && data.spoiler.is_none()
        && data.invites_paused.is_none()
        && data.remove.is_empty()
    {
        return Ok(Json(channel.into()));
    }

    let mut partial: PartialChannel = Default::default();

    // Transfer group ownership
    if let Some(new_owner) = data.owner {
        if let Channel::Group {
            owner, recipients, ..
        } = &mut channel
        {
            // Make sure we are the owner of this group
            if owner != &user.id {
                return Err(create_error!(NotOwner));
            }

            // Ensure user is part of group
            if !recipients.contains(&new_owner) {
                return Err(create_error!(NotInGroup));
            }

            // Transfer ownership
            partial.owner = Some(new_owner.to_string());
            let old_owner = std::mem::replace(owner, new_owner.to_string());

            // Notify clients
            SystemMessage::ChannelOwnershipChanged {
                from: old_owner,
                to: new_owner,
            }
        } else {
            return Err(create_error!(InvalidOperation));
        }
        .into_message(channel.id().to_string())
        .send(
            db,
            Some(amqp),
            user.as_author_for_system(),
            None,
            None,
            &channel,
            false,
        )
        .await
        .ok();
    }

    let before_channel = channel.clone();

    match &mut channel {
        Channel::Group {
            id,
            name,
            description,
            icon,
            nsfw,
            ..
        } => {
            if data.remove.contains(&v0::FieldsChannel::Icon) {
                if let Some(icon) = &icon {
                    db.mark_attachment_as_deleted(&icon.id).await?;
                }
            }

            for field in &data.remove {
                match field {
                    v0::FieldsChannel::Description => {
                        description.take();
                    }
                    v0::FieldsChannel::Icon => {
                        icon.take();
                    }
                    _ => {}
                }
            }

            if let Some(icon_id) = data.icon {
                partial.icon = Some(File::use_channel_icon(db, &icon_id, id, &user.id).await?);
                *icon = partial.icon.clone();
            }

            if let Some(new_name) = data.name {
                *name = new_name.clone();
                partial.name = Some(new_name);
            }

            if let Some(new_description) = data.description {
                partial.description = Some(new_description);
                *description = partial.description.clone();
            }

            if let Some(new_nsfw) = data.nsfw {
                *nsfw = new_nsfw;
                partial.nsfw = Some(new_nsfw);
            }

            // Send out mutation system messages.
            if let Some(name) = &partial.name {
                SystemMessage::ChannelRenamed {
                    name: name.to_string(),
                    by: user.id.clone(),
                }
                .into_message(channel.id().to_string())
                .send(
                    db,
                    Some(amqp),
                    user.as_author_for_system(),
                    None,
                    None,
                    &channel,
                    false,
                )
                .await
                .ok();
            }

            if partial.description.is_some() {
                SystemMessage::ChannelDescriptionChanged {
                    by: user.id.clone(),
                }
                .into_message(channel.id().to_string())
                .send(
                    db,
                    Some(amqp),
                    user.as_author_for_system(),
                    None,
                    None,
                    &channel,
                    false,
                )
                .await
                .ok();
            }

            if partial.icon.is_some() {
                SystemMessage::ChannelIconChanged {
                    by: user.id.clone(),
                }
                .into_message(channel.id().to_string())
                .send(
                    db,
                    Some(amqp),
                    user.as_author_for_system(),
                    None,
                    None,
                    &channel,
                    false,
                )
                .await
                .ok();
            }
        }
        Channel::TextChannel {
            id,
            name,
            description,
            icon,
            nsfw,
            voice,
            slowmode,
            spoiler,
            invites_paused,
            ..
        } => {
            if data.remove.contains(&v0::FieldsChannel::Icon) {
                if let Some(icon) = &icon {
                    db.mark_attachment_as_deleted(&icon.id).await?;
                }
            }

            for field in &data.remove {
                match field {
                    v0::FieldsChannel::Description => {
                        description.take();
                    }
                    v0::FieldsChannel::Icon => {
                        icon.take();
                    }
                    v0::FieldsChannel::Voice => {
                        voice.take();
                    }
                    v0::FieldsChannel::Slowmode => {
                        slowmode.take();
                    }
                    _ => {}
                }
            }

            if let Some(icon_id) = data.icon {
                partial.icon = Some(File::use_channel_icon(db, &icon_id, id, &user.id).await?);
                *icon = partial.icon.clone();
            }

            if let Some(new_name) = data.name {
                *name = new_name.clone();
                partial.name = Some(new_name);
            }

            if let Some(new_description) = data.description {
                partial.description = Some(new_description);
                *description = partial.description.clone();
            }

            if let Some(new_nsfw) = data.nsfw {
                *nsfw = new_nsfw;
                partial.nsfw = Some(new_nsfw);
            }

            if let Some(new_voice) = data.voice {
                let new_voice = keep_voice_kind(voice.as_ref(), new_voice);
                *voice = Some(new_voice.clone().into());
                partial.voice = Some(new_voice.into());
            }

            if let Some(new_slowmode) = data.slowmode {
                *slowmode = Some(new_slowmode);
                partial.slowmode = Some(new_slowmode);
            }

            if let Some(new_spoiler) = data.spoiler {
                *spoiler = new_spoiler;
                partial.spoiler = Some(new_spoiler);
            }

            if let Some(new_invites_paused) = data.invites_paused {
                *invites_paused = new_invites_paused;
                partial.invites_paused = Some(new_invites_paused);
            }
        }
        _ => return Err(create_error!(InvalidOperation)),
    };

    let remove = data
        .remove
        .into_iter()
        .map(|f| f.into())
        .collect::<Vec<FieldsChannel>>();

    let before = if before_channel.server().is_some() {
        Some(before_channel.generate_diff(&partial, &remove))
    } else {
        None
    };

    channel.update(db, partial.clone(), remove).await?;

    if channel.voice().is_none() {
        delete_voice_channel(voice_client, &UserVoiceChannel::from_channel(&channel)).await?;
    }

    if let Some(before) = before {
        AuditLogEntryAction::ChannelEdit {
            channel: channel.id().to_string(),
            before,
            after: partial,
        }
        .insert(db, channel.server().unwrap().to_string(), reason, user.id, None)
        .await;
    };

    Ok(Json(channel.into()))
}

#[cfg(test)]
mod test {
    use crate::util::test::TestHarness;
    use revolt_models::v0;
    use rocket::http::{ContentType, Header, Status};

    fn tipo_da_sala(channel: &v0::Channel) -> Option<v0::VoiceChannelKind> {
        match channel {
            v0::Channel::TextChannel { voice, .. } => voice.as_ref().and_then(|v| v.kind.clone()),
            _ => None,
        }
    }

    /// Um cliente que não conhece `kind` (Stoat) muda o limite de vagas e
    /// manda o objeto `voice` sem ele: o canal de vídeo tem de continuar vídeo.
    #[rocket::async_test]
    async fn edicao_de_voz_sem_kind_preserva_o_tipo() {
        let harness = TestHarness::new().await;
        let (_, session, user) = harness.new_user().await;
        let (server, _) = harness.new_server(&user).await;

        let response = harness
            .client
            .post(format!("/servers/{}/channels", server.id))
            .header(Header::new("x-session-token", session.token.to_string()))
            .header(ContentType::JSON)
            .body(
                json!({
                    "type": "Voice",
                    "name": "Apresentações",
                    "voice": { "max_users": 25, "kind": "video" }
                })
                .to_string(),
            )
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Ok);
        let criado: v0::Channel = response.into_json().await.expect("`Channel`");
        assert_eq!(tipo_da_sala(&criado), Some(v0::VoiceChannelKind::Video));

        let response = harness
            .client
            .patch(format!("/channels/{}", criado.id()))
            .header(Header::new("x-session-token", session.token.to_string()))
            .header(ContentType::JSON)
            .body(json!({ "voice": { "max_users": 4 } }).to_string())
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Ok);
        let editado: v0::Channel = response.into_json().await.expect("`Channel`");
        assert_eq!(tipo_da_sala(&editado), Some(v0::VoiceChannelKind::Video));

        // E o que foi gravado, não só o que a rota devolveu.
        let gravado: v0::Channel = harness
            .db
            .fetch_channel(criado.id())
            .await
            .expect("`Channel`")
            .into();
        assert_eq!(tipo_da_sala(&gravado), Some(v0::VoiceChannelKind::Video));
        match gravado {
            v0::Channel::TextChannel { voice, .. } => {
                assert_eq!(voice.and_then(|v| v.max_users), Some(4));
            }
            _ => panic!("canal de servidor"),
        }
    }

    /// `kind` explícito na edição troca o tipo — inclusive rebaixando a voz.
    #[rocket::async_test]
    async fn edicao_com_kind_troca_o_tipo() {
        let harness = TestHarness::new().await;
        let (_, session, user) = harness.new_user().await;
        let (server, _) = harness.new_server(&user).await;

        let response = harness
            .client
            .post(format!("/servers/{}/channels", server.id))
            .header(Header::new("x-session-token", session.token.to_string()))
            .header(ContentType::JSON)
            .body(
                json!({ "type": "Voice", "name": "Palco", "voice": { "kind": "stage" } })
                    .to_string(),
            )
            .dispatch()
            .await;
        let criado: v0::Channel = response.into_json().await.expect("`Channel`");
        assert_eq!(tipo_da_sala(&criado), Some(v0::VoiceChannelKind::Stage));

        let response = harness
            .client
            .patch(format!("/channels/{}", criado.id()))
            .header(Header::new("x-session-token", session.token.to_string()))
            .header(ContentType::JSON)
            .body(json!({ "voice": { "kind": "voice" } }).to_string())
            .dispatch()
            .await;
        let editado: v0::Channel = response.into_json().await.expect("`Channel`");
        assert_eq!(tipo_da_sala(&editado), Some(v0::VoiceChannelKind::Voice));
    }
}
