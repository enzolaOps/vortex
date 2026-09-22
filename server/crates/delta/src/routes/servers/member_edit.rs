use std::collections::HashSet;

use revolt_database::{
    events::client::EventV1,
    util::{
        permissions::{perms, DatabasePermissionQuery},
        reference::Reference,
    },
    voice::{
        get_channel_node, get_user_voice_channel_in_server, set_channel_node,
        set_user_moved_from_voice, set_user_moved_to_voice, sync_user_voice_permissions,
        UserVoiceChannel, VoiceClient,
    },
    AuditLogEntryAction, Database, FieldsMember, File, PartialMember, User,
};
use revolt_models::v0;

use revolt_permissions::{
    calculate_channel_permissions, calculate_server_permissions, ChannelPermission,
};
use revolt_result::{create_error, Result};
use rocket::{form::validate::Contains, serde::json::Json, State};
use validator::Validate;

use crate::util::audit_log_reason::AuditLogReason;

/// # Edit Member
///
/// Edit a member by their id.
#[openapi(tag = "Server Members")]
#[patch("/<server_id>/members/<member_id>", data = "<data>")]
pub async fn edit(
    db: &State<Database>,
    voice_client: &State<VoiceClient>,
    user: User,
    reason: AuditLogReason,
    server_id: Reference<'_>,
    member_id: Reference<'_>,
    data: Json<v0::DataMemberEdit>,
) -> Result<Json<v0::Member>> {
    let data = data.into_inner();
    data.validate().map_err(|error| {
        create_error!(FailedValidation {
            error: error.to_string()
        })
    })?;

    // Fetch server and member
    let mut server = server_id.as_server(db).await?;
    let target_user = member_id.as_user(db).await?;
    let mut member = member_id.as_member(db, &server.id).await?;

    // Fetch our currrent permissions
    let mut query = DatabasePermissionQuery::new(db, &user).server(&server);
    let permissions = calculate_server_permissions(&mut query).await;

    // Fetch target permissions
    let mut target_query = DatabasePermissionQuery::new(db, &target_user)
        .server(&server)
        .member(&member);
    let target_permissions = calculate_server_permissions(&mut target_query).await;

    // Check permissions in server
    if data.nickname.is_some() || data.remove.contains(&v0::FieldsMember::Nickname) {
        if user.id == member.id.user {
            permissions.throw_if_lacking_channel_permission(ChannelPermission::ChangeNickname)?;
        } else {
            permissions.throw_if_lacking_channel_permission(ChannelPermission::ManageNicknames)?;
        }
    }

    // Vortex: exibir a tag do servidor é escolha de quem a exibe, e só dela.
    if data.show_tag.is_some() && user.id != member.id.user {
        return Err(create_error!(InvalidOperation));
    }

    if (data.pronouns.is_some() || data.remove.contains(&v0::FieldsMember::Pronouns))
        && user.id != member.id.user
    {
        return Err(create_error!(InvalidOperation));
    }

    if data.avatar.is_some() || data.remove.contains(&v0::FieldsMember::Avatar) {
        if user.id == member.id.user {
            permissions.throw_if_lacking_channel_permission(ChannelPermission::ChangeAvatar)?;
        } else if data.remove.contains(&v0::FieldsMember::Avatar) {
            permissions.throw_if_lacking_channel_permission(ChannelPermission::RemoveAvatars)?;
        } else {
            return Err(create_error!(InvalidOperation));
        }
    }

    if data.roles.is_some() || data.remove.contains(&v0::FieldsMember::Roles) {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::AssignRoles)?;
    }

    if data.timeout.is_some() || data.remove.contains(&v0::FieldsMember::Timeout) {
        if data.timeout.is_some() {
            if member.id.user == user.id {
                return Err(create_error!(CannotTimeoutYourself));
            }

            if target_permissions.has_channel_permission(ChannelPermission::TimeoutMembers) {
                return Err(create_error!(IsElevated));
            }
        }

        permissions.throw_if_lacking_channel_permission(ChannelPermission::TimeoutMembers)?;
    }

    if data.can_publish.is_some() {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::MuteMembers)?;
    }

    if data.can_receive.is_some() {
        permissions.throw_if_lacking_channel_permission(ChannelPermission::DeafenMembers)?;
    }

    if data.voice_channel.is_some() && data.remove.contains(&v0::FieldsMember::VoiceChannel) {
        return Err(create_error!(InvalidOperation));
    }

    if data.voice_channel.is_some() || data.remove.contains(&v0::FieldsMember::VoiceChannel) {
        if !voice_client.is_enabled() {
            return Err(create_error!(LiveKitUnavailable));
        };

        if member.id.user != user.id {
            permissions.throw_if_lacking_channel_permission(ChannelPermission::MoveMembers)?;
        }
    }

    let new_voice_channel = if let Some(new_channel) = &data.voice_channel {
        // ensure the channel we are moving them to is in the server and is a voice channel

        let channel = Reference::from_unchecked(new_channel)
            .as_channel(db)
            .await
            .map_err(|_| create_error!(UnknownChannel))?;

        if channel.server().is_none_or(|v| v != member.id.server) {
            Err(create_error!(UnknownChannel))?
        }

        let channel_permissions =
            calculate_channel_permissions(&mut query.clone().channel(&channel)).await;
        channel_permissions.throw_if_lacking_channel_permission(ChannelPermission::Connect)?;

        if get_user_voice_channel_in_server(&target_user.id, &server.id)
            .await?
            .is_none()
        {
            Err(create_error!(NotConnected))?
        };

        Some(channel)
    } else {
        None
    };

    // Resolve our ranking
    let our_ranking = query.get_member_rank().unwrap_or(i64::MIN);

    // Check that we have permissions to act against this member
    if member.id.user != user.id
        && member.get_ranking(query.server_ref().as_ref().unwrap()) <= our_ranking
    {
        return Err(create_error!(NotElevated));
    }

    // Check permissions against roles in diff
    if let Some(roles) = &data.roles {
        let current_roles = member.roles.iter().collect::<HashSet<&String>>();

        let new_roles = roles.iter().collect::<HashSet<&String>>();
        let added_roles: Vec<&&String> = new_roles.difference(&current_roles).collect();

        for role_id in added_roles {
            if let Some(role) = server.roles.remove(*role_id) {
                if role.rank <= our_ranking {
                    return Err(create_error!(NotElevated));
                }
            } else {
                return Err(create_error!(InvalidRole));
            }
        }
    }

    // Apply edits to the member object
    let v0::DataMemberEdit {
        nickname,
        pronouns,
        avatar,
        roles,
        timeout,
        remove,
        can_publish,
        can_receive,
        voice_channel: _,
        show_tag,
    } = data;

    let mut partial = PartialMember {
        nickname,
        pronouns,
        roles,
        timeout,
        can_publish,
        can_receive,
        show_tag,
        ..Default::default()
    };

    // 1. Remove fields from object
    if remove.contains(&v0::FieldsMember::Avatar) {
        if let Some(avatar) = &member.avatar {
            db.mark_attachment_as_deleted(&avatar.id).await?;
        }
    }

    // 2. Apply new avatar
    if let Some(avatar) = avatar {
        partial.avatar = Some(File::use_user_avatar(db, &avatar, &user.id, &user.id).await?);
    }

    let remove = remove
        .into_iter()
        .map(Into::into)
        .collect::<Vec<FieldsMember>>();

    let before = member.generate_diff(&partial, &remove);

    // Vortex: quem moveu ou desconectou, para o evento dizer "por Fulano".
    let by = autor_de_voz(
        &user.id,
        &member.id.user,
        new_voice_channel.is_some(),
        remove.contains(&FieldsMember::VoiceChannel),
    );

    member
        .update_by(db, partial.clone(), remove.clone(), by.clone())
        .await?;

    AuditLogEntryAction::MemberEdit {
        user: member.id.user.clone(),
        before,
        after: partial,
    }
    .insert(
        db,
        server.id.clone(),
        reason,
        user.id.clone(),
        Some(member.id.user.clone()),
    )
    .await;

    if let Some(new_voice_channel) = new_voice_channel {
        if let Some(channel) = get_user_voice_channel_in_server(&target_user.id, &server.id).await?
        {
            let old_node = get_channel_node(&channel).await?.unwrap();

            let new_node = match get_channel_node(new_voice_channel.id()).await? {
                Some(node) => node,
                None => {
                    set_channel_node(new_voice_channel.id(), &old_node).await?;
                    old_node.clone()
                }
            };

            let new_user_voice_channel = UserVoiceChannel::from_channel(&new_voice_channel);
            let old_user_voice_channel = UserVoiceChannel {
                id: channel.clone(),
                server_id: new_user_voice_channel.server_id.clone(),
            };

            set_user_moved_from_voice(&channel, &new_user_voice_channel, &target_user.id).await?;
            set_user_moved_to_voice(
                new_voice_channel.id(),
                &old_user_voice_channel,
                &target_user.id,
            )
            .await?;

            let mut query = perms(db, &target_user).channel(&new_voice_channel);
            let permissions = calculate_channel_permissions(&mut query).await;

            voice_client
                .create_room(&new_node, &new_voice_channel)
                .await?;
            let token = voice_client
                .create_token(&new_node, db, &target_user, permissions, &new_voice_channel)
                .await?;

            voice_client
                .remove_user(&old_node, &target_user.id, &channel)
                .await?;

            EventV1::UserMoveVoiceChannel {
                node: new_node,
                from: channel,
                to: new_voice_channel.id().to_string(),
                token,
                by: by.clone(),
            }
            .private(target_user.id.clone())
            .await;
        };
    } else if can_publish.is_some()
        || can_receive.is_some()
        || remove.contains(FieldsMember::CanPublish)
        || remove.contains(FieldsMember::CanReceive)
    {
        if let Some(channel) = get_user_voice_channel_in_server(&target_user.id, &server.id).await?
        {
            let node = get_channel_node(&channel).await?.unwrap();
            let channel = Reference::from_unchecked(&channel).as_channel(db).await?;

            // The member being edited, not the moderator: their LiveKit
            // grants are the ones that changed.
            sync_user_voice_permissions(
                db,
                voice_client,
                &node,
                &target_user,
                &channel,
                Some(&server),
                None,
            )
            .await?;
        };
    };

    if remove.contains(&FieldsMember::VoiceChannel) {
        if let Some(channel) = get_user_voice_channel_in_server(&target_user.id, &server.id).await?
        {
            let node = get_channel_node(&channel).await?.unwrap();

            // Disconnect the member being edited, not the moderator.
            voice_client.remove_user(&node, &target_user.id, &channel).await?;
        };
    }

    Ok(Json(member.into()))
}

/// Vortex: o autor de uma ação de VOZ sobre outra pessoa, e só dela.
///
/// ⚠ **Estreito de propósito.** O evento de membro vai para o servidor
/// inteiro, e dizer a todo mundo quem trocou o apelido ou o cargo de alguém é
/// o que o registro de auditoria guarda atrás de `ViewAuditLog`. Mover e
/// desconectar da voz são diferentes: o design escreve o autor na própria
/// sala ("Ana moveu Téo para Foco"), à vista de quem está nela. Mexer na
/// própria voz não tem autor a anunciar.
fn autor_de_voz(
    quem_edita: &str,
    alvo: &str,
    moveu: bool,
    desconectou: bool,
) -> Option<String> {
    if quem_edita == alvo || !(moveu || desconectou) {
        return None;
    }
    Some(quem_edita.to_string())
}

#[cfg(test)]
mod test {
    use revolt_database::{events::client::EventV1, Member};
    use rocket::http::{Header, Status};

    use super::autor_de_voz;
    use crate::util::test::TestHarness;

    #[test]
    fn autor_so_em_acao_de_voz_sobre_outra_pessoa() {
        assert_eq!(autor_de_voz("ana", "teo", true, false), Some("ana".into()));
        assert_eq!(autor_de_voz("ana", "teo", false, true), Some("ana".into()));
        // Apelido, cargo, castigo: sem autor no evento.
        assert_eq!(autor_de_voz("ana", "teo", false, false), None);
        // A própria voz não tem autor a anunciar.
        assert_eq!(autor_de_voz("teo", "teo", true, false), None);
        assert_eq!(autor_de_voz("teo", "teo", false, true), None);
    }

    /// Edição que não é de voz continua publicando o evento SEM `by` — o
    /// contrato aditivo visto de ponta a ponta, pelo pub/sub de verdade.
    #[rocket::async_test]
    async fn edicao_comum_nao_anuncia_autor() {
        let mut harness = TestHarness::new().await;
        let (_, session, user) = harness.new_user().await;
        let (server, _) = harness.new_server(&user).await;
        Member::create(&harness.db, &server, &user, None)
            .await
            .unwrap();

        let response = harness
            .client
            .patch(format!("/servers/{}/members/{}", server.id, user.id))
            .header(Header::new("x-session-token", session.token.clone()))
            .json(&serde_json::json!({ "nickname": "Apelido" }))
            .dispatch()
            .await;
        assert_eq!(response.status(), Status::Ok);
        drop(response);

        let event = harness
            .wait_for_event(&server.id, |event| {
                matches!(event, EventV1::ServerMemberUpdate { id, .. } if id.user == user.id)
            })
            .await;

        match event {
            EventV1::ServerMemberUpdate { by, .. } => assert_eq!(by, None),
            _ => unreachable!(),
        }
    }
}
