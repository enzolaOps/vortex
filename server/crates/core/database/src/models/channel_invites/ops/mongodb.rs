use bson::Document;
use futures::StreamExt;
use revolt_result::Result;

use crate::Invite;
use crate::MongoDb;

use super::AbstractChannelInvites;

static COL: &str = "channel_invites";

#[async_trait]
impl AbstractChannelInvites for MongoDb {
    /// Insert a new invite into the database
    async fn insert_invite(&self, invite: &Invite) -> Result<()> {
        query!(self, insert_one, COL, &invite).map(|_| ())
    }

    /// Fetch an invite by the code
    async fn fetch_invite(&self, code: &str) -> Result<Invite> {
        query!(self, find_one_by_id, COL, code)?.ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all invites for a server
    async fn fetch_invites_for_server(&self, server_id: &str) -> Result<Vec<Invite>> {
        Ok(self
            .col::<Invite>(COL)
            .find(doc! {
                "server": server_id,
            })
            .await
            .map_err(|_| create_database_error!("find", COL))?
            .filter_map(|s| async {
                if cfg!(debug_assertions) {
                    Some(s.unwrap())
                } else {
                    s.ok()
                }
            })
            .collect()
            .await)
    }

    /// Delete an invite by its code
    async fn delete_invite(&self, code: &str) -> Result<()> {
        query!(self, delete_one_by_id, COL, code).map(|_| ())
    }

    /// Count one use of an invite, atomically against `max_uses`
    async fn use_invite(&self, code: &str) -> Result<bool> {
        let result = self
            .col::<Document>(COL)
            .update_one(
                doc! {
                    "_id": code,
                    "$or": [
                        { "max_uses": { "$exists": false } },
                        { "max_uses": null },
                        { "$expr": { "$lt": [ { "$ifNull": [ "$uses", 0 ] }, "$max_uses" ] } }
                    ]
                },
                doc! { "$inc": { "uses": 1_i64 } },
            )
            .await
            .map_err(|_| create_database_error!("update_one", COL))?;

        Ok(result.modified_count > 0)
    }

    /// Give back a use counted by `use_invite`
    async fn release_invite_use(&self, code: &str) -> Result<()> {
        self.col::<Document>(COL)
            .update_one(
                doc! { "_id": code, "uses": { "$gt": 0 } },
                doc! { "$inc": { "uses": -1_i64 } },
            )
            .await
            .map(|_| ())
            .map_err(|_| create_database_error!("update_one", COL))
    }
}
