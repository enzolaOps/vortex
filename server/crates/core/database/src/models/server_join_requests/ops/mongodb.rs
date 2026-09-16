use revolt_result::Result;

use crate::MongoDb;
use crate::{MemberCompositeKey, ServerJoinRequest};

use super::AbstractServerJoinRequests;

static COL: &str = "server_join_requests";

#[async_trait]
impl AbstractServerJoinRequests for MongoDb {
    /// Insert new join request into database
    async fn insert_join_request(&self, request: &ServerJoinRequest) -> Result<()> {
        query!(self, insert_one, COL, &request).map(|_| ())
    }

    /// Fetch a join request by server and user id
    async fn fetch_join_request(
        &self,
        server_id: &str,
        user_id: &str,
    ) -> Result<ServerJoinRequest> {
        query!(
            self,
            find_one,
            COL,
            doc! {
                "_id.server": server_id,
                "_id.user": user_id
            }
        )?
        .ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all join requests in a server
    async fn fetch_join_requests(&self, server_id: &str) -> Result<Vec<ServerJoinRequest>> {
        query!(
            self,
            find,
            COL,
            doc! {
                "_id.server": server_id
            }
        )
    }

    /// Delete a join request from the database
    async fn delete_join_request(&self, id: &MemberCompositeKey) -> Result<()> {
        query!(
            self,
            delete_one,
            COL,
            doc! {
                "_id.server": &id.server,
                "_id.user": &id.user
            }
        )
        .map(|_| ())
    }
}
