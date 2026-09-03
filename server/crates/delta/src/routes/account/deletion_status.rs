//! Inspect or cancel an account deletion using its confirmation token.
use revolt_database::{Database, DeletionInfo};
use revolt_models::v0;
use revolt_result::{create_error, Result};
use rocket::{serde::json::Json, State};
use rocket_empty::EmptyResponse;

/// # Account Deletion Status
#[openapi(tag = "Account")]
#[get("/delete/<token>")]
pub async fn deletion_status(
    db: &State<Database>,
    token: &str,
) -> Result<Json<v0::AccountDeletionStatus>> {
    let account = db.fetch_account_with_deletion_token(token).await?;
    let status = match account.deletion {
        Some(DeletionInfo::WaitingForVerification { .. }) => {
            v0::AccountDeletionStatus::WaitingForConfirmation
        }
        Some(DeletionInfo::Scheduled { after, .. }) => v0::AccountDeletionStatus::Scheduled {
            delete_after: after,
        },
        _ => return Err(create_error!(InvalidToken)),
    };

    Ok(Json(status))
}

/// # Cancel Account Deletion
#[openapi(tag = "Account")]
#[delete("/delete/<token>")]
pub async fn cancel_deletion(db: &State<Database>, token: &str) -> Result<EmptyResponse> {
    let mut account = db.fetch_account_with_deletion_token(token).await?;
    account
        .cancel_deletion(db, token)
        .await
        .map(|_| EmptyResponse)
}

#[cfg(test)]
mod tests {
    use crate::{rocket, util::test::TestHarness};
    use iso8601_timestamp::{Duration, Timestamp};
    use revolt_database::DeletionInfo;
    use revolt_models::v0;
    use rocket::http::Status;

    #[rocket::async_test]
    async fn status_waiting_does_not_schedule() {
        let harness = TestHarness::new().await;
        let (mut account, _, _) = harness.new_user().await;
        account.deletion = Some(DeletionInfo::WaitingForVerification {
            token: "wait-token".into(),
            expiry: Timestamp::now_utc() + Duration::seconds(100),
        });
        account.save(&harness.db).await.unwrap();

        let res = harness
            .client
            .get("/auth/account/delete/wait-token")
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::Ok);
        let status = res.into_json::<v0::AccountDeletionStatus>().await.unwrap();
        assert!(matches!(
            status,
            v0::AccountDeletionStatus::WaitingForConfirmation
        ));

        let account = harness.db.fetch_account(&account.id).await.unwrap();
        assert!(matches!(
            account.deletion,
            Some(DeletionInfo::WaitingForVerification { .. })
        ));
        assert!(!account.disabled);
    }

    #[rocket::async_test]
    async fn confirm_then_cancel() {
        let harness = TestHarness::new().await;
        let (mut account, session, _) = harness.new_user().await;
        account.deletion = Some(DeletionInfo::WaitingForVerification {
            token: "del-token".into(),
            expiry: Timestamp::now_utc() + Duration::seconds(100),
        });
        account.save(&harness.db).await.unwrap();

        let res = harness
            .client
            .put("/auth/account/delete")
            .json(&v0::DataAccountDeletion {
                token: "del-token".into(),
            })
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::NoContent);

        let scheduled = harness.db.fetch_account(&account.id).await.unwrap();
        assert!(scheduled.disabled);
        assert!(matches!(
            scheduled.deletion,
            Some(DeletionInfo::Scheduled { token: Some(_), .. })
        ));
        assert!(harness.db.fetch_session(&session.id).await.is_err());

        let res = harness
            .client
            .get("/auth/account/delete/del-token")
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::Ok);
        assert!(matches!(
            res.into_json::<v0::AccountDeletionStatus>().await.unwrap(),
            v0::AccountDeletionStatus::Scheduled { .. }
        ));

        let res = harness
            .client
            .delete("/auth/account/delete/del-token")
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::NoContent);

        let restored = harness.db.fetch_account(&account.id).await.unwrap();
        assert!(!restored.disabled);
        assert!(restored.deletion.is_none());
        assert!(harness.db.fetch_session(&session.id).await.is_err());

        let res = harness
            .client
            .delete("/auth/account/delete/del-token")
            .dispatch()
            .await;
        assert_eq!(res.status(), Status::Unauthorized);
    }
}
