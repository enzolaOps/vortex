use revolt_result::Result;

use crate::Invite;
use crate::ReferenceDb;

use super::AbstractChannelInvites;

#[async_trait]
impl AbstractChannelInvites for ReferenceDb {
    /// Insert a new invite into the database
    async fn insert_invite(&self, invite: &Invite) -> Result<()> {
        let mut invites = self.channel_invites.lock().await;
        if invites.contains_key(invite.code()) {
            Err(create_database_error!("insert", "invite"))
        } else {
            invites.insert(invite.code().to_string(), invite.clone());
            Ok(())
        }
    }

    /// Fetch an invite by the code
    async fn fetch_invite(&self, code: &str) -> Result<Invite> {
        let invites = self.channel_invites.lock().await;
        invites
            .get(code)
            .cloned()
            .ok_or_else(|| create_error!(NotFound))
    }

    /// Fetch all invites for a server
    async fn fetch_invites_for_server(&self, server_id: &str) -> Result<Vec<Invite>> {
        let invites = self.channel_invites.lock().await;
        Ok(invites
            .values()
            .filter(|invite| match invite {
                Invite::Server { server, .. } => server == server_id,
                _ => false,
            })
            .cloned()
            .collect())
    }

    /// Count one use of an invite, atomically against `max_uses`
    async fn use_invite(&self, code: &str) -> Result<bool> {
        let mut invites = self.channel_invites.lock().await;
        match invites.get_mut(code) {
            Some(Invite::Server { uses, max_uses, .. }) => {
                if max_uses.is_some_and(|max| *uses >= max) {
                    Ok(false)
                } else {
                    *uses += 1;
                    Ok(true)
                }
            }
            _ => Ok(false),
        }
    }

    /// Give back a use counted by `use_invite`
    async fn release_invite_use(&self, code: &str) -> Result<()> {
        let mut invites = self.channel_invites.lock().await;
        if let Some(Invite::Server { uses, .. }) = invites.get_mut(code) {
            *uses = uses.saturating_sub(1);
        }
        Ok(())
    }

    /// Delete an invite by its code
    async fn delete_invite(&self, code: &str) -> Result<()> {
        let mut invites = self.channel_invites.lock().await;
        if invites.remove(code).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }
}
