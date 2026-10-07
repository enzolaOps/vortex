use revolt_database::{
    events::client::EventV1,
    util::reference::Reference,
    voice::{get_user_voice_channels, remove_user_from_voice_channel, VoiceClient},
    User,
};
use revolt_result::Result;

use rocket::State;
use rocket_empty::EmptyResponse;

/// # Leave Call
///
/// Removes the authenticated user from the call of this channel.
///
/// Acts only on the caller and never requires `Connect`, so someone who lost
/// the permission can still leave. Idempotent: returns `204` when the user is
/// not in the call, without revealing whether the channel exists.
#[openapi(tag = "Voice")]
#[post("/<target>/leave_call")]
pub async fn leave_call(
    voice_client: &State<VoiceClient>,
    user: User,
    target: Reference<'_>,
) -> Result<EmptyResponse> {
    let Some(voice_channel) = get_user_voice_channels(&user.id)
        .await?
        .into_iter()
        .find(|c| c.id == target.id)
    else {
        return Ok(EmptyResponse);
    };

    // Removes the participant from LiveKit (best effort) and deletes the state.
    remove_user_from_voice_channel(voice_client, &voice_channel, &user.id).await?;

    // Published right away; the `participant_left` webhook arrives later and
    // the client treats the duplicate Leave as a no-op.
    EventV1::VoiceChannelLeave {
        id: voice_channel.id.clone(),
        user: user.id.clone(),
    }
    .p(voice_channel.id)
    .await;

    Ok(EmptyResponse)
}

#[cfg(test)]
mod test {
    use crate::{rocket, util::test::TestHarness};
    use iso8601_timestamp::Timestamp;
    use revolt_database::{
        events::client::EventV1,
        voice::{create_voice_state, get_user_voice_channels, UserVoiceChannel},
    };
    use rocket::http::{Header, Status};

    #[rocket::async_test]
    async fn leave_removes_state_and_publishes_event() {
        let mut harness = TestHarness::new().await;
        let (_, session, user) = harness.new_user().await;
        let (server, _) = harness.new_server(&user).await;
        let channel = harness.new_channel(&server).await;

        let vc = UserVoiceChannel::from_channel(&channel);
        create_voice_state(&vc, &user.id, Timestamp::now_utc())
            .await
            .unwrap();

        let res = harness
            .client
            .post(format!("/channels/{}/leave_call", channel.id()))
            .header(Header::new("x-session-token", session.token.to_string()))
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::NoContent);
        drop(res);

        assert!(get_user_voice_channels(&user.id).await.unwrap().is_empty());

        let event = harness
            .wait_for_event(channel.id(), |e| {
                matches!(e, EventV1::VoiceChannelLeave { user: u, .. } if *u == user.id)
            })
            .await;
        assert!(matches!(event, EventV1::VoiceChannelLeave { id, .. } if id == channel.id()));
    }

    #[rocket::async_test]
    async fn leave_when_absent_is_idempotent() {
        let harness = TestHarness::new().await;
        let (_, session, user) = harness.new_user().await;
        let (server, _) = harness.new_server(&user).await;
        let channel = harness.new_channel(&server).await;

        for _ in 0..2 {
            let res = harness
                .client
                .post(format!("/channels/{}/leave_call", channel.id()))
                .header(Header::new("x-session-token", session.token.to_string()))
                .dispatch()
                .await;
            assert_eq!(res.status(), Status::NoContent);
        }

        // unknown channel: same answer, no existence oracle
        let res = harness
            .client
            .post("/channels/01ARZ3NDEKTSV4RRFFQ69G5FAV/leave_call")
            .header(Header::new("x-session-token", session.token.to_string()))
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::NoContent);
    }

    #[rocket::async_test]
    async fn leave_only_affects_the_caller() {
        let harness = TestHarness::new().await;
        let (_, session_a, user_a) = harness.new_user().await;
        let (_, _, user_b) = harness.new_user().await;
        let (server, _) = harness.new_server(&user_a).await;
        let channel = harness.new_channel(&server).await;

        let vc = UserVoiceChannel::from_channel(&channel);
        create_voice_state(&vc, &user_a.id, Timestamp::now_utc())
            .await
            .unwrap();
        create_voice_state(&vc, &user_b.id, Timestamp::now_utc())
            .await
            .unwrap();

        let res = harness
            .client
            .post(format!("/channels/{}/leave_call", channel.id()))
            .header(Header::new("x-session-token", session_a.token.to_string()))
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::NoContent);
        drop(res);

        assert!(get_user_voice_channels(&user_a.id).await.unwrap().is_empty());
        assert_eq!(get_user_voice_channels(&user_b.id).await.unwrap().len(), 1);
    }

    #[rocket::async_test]
    async fn leave_requires_authentication() {
        let harness = TestHarness::new().await;
        let res = harness
            .client
            .post("/channels/01ARZ3NDEKTSV4RRFFQ69G5FAV/leave_call")
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::Unauthorized);
    }
}
