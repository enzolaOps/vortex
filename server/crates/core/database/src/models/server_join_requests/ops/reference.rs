use revolt_result::Result;

use crate::ReferenceDb;
use crate::{MemberCompositeKey, ServerJoinRequest};

use super::AbstractServerJoinRequests;

#[async_trait]
impl AbstractServerJoinRequests for ReferenceDb {
    /// Insert new join request into database
    async fn insert_join_request(&self, request: &ServerJoinRequest) -> Result<()> {
        let mut requests = self.server_join_requests.lock().await;
        if requests.contains_key(&request.id) {
            Err(create_database_error!("insert", "server_join_requests"))
        } else {
            requests.insert(request.id.clone(), request.clone());
            Ok(())
        }
    }

    /// Fetch a join request by server and user id
    async fn fetch_join_request(
        &self,
        server_id: &str,
        user_id: &str,
    ) -> Result<ServerJoinRequest> {
        let requests = self.server_join_requests.lock().await;
        requests
            .get(&MemberCompositeKey {
                server: server_id.to_string(),
                user: user_id.to_string(),
            })
            .cloned()
            .ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all join requests in a server
    async fn fetch_join_requests(&self, server_id: &str) -> Result<Vec<ServerJoinRequest>> {
        let requests = self.server_join_requests.lock().await;
        Ok(requests
            .values()
            .filter(|request| request.id.server == server_id)
            .cloned()
            .collect())
    }

    /// Delete a join request from the database
    async fn delete_join_request(&self, id: &MemberCompositeKey) -> Result<()> {
        let mut requests = self.server_join_requests.lock().await;
        if requests.remove(id).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }
}
