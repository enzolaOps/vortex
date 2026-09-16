use revolt_result::Result;

use crate::{MemberCompositeKey, ServerJoinRequest};

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractServerJoinRequests: Sync + Send {
    /// Insert new join request into database
    async fn insert_join_request(&self, request: &ServerJoinRequest) -> Result<()>;

    /// Fetch a join request by server and user id
    async fn fetch_join_request(&self, server_id: &str, user_id: &str)
        -> Result<ServerJoinRequest>;

    /// Fetch all join requests in a server
    async fn fetch_join_requests(&self, server_id: &str) -> Result<Vec<ServerJoinRequest>>;

    /// Delete a join request from the database
    async fn delete_join_request(&self, id: &MemberCompositeKey) -> Result<()>;
}
