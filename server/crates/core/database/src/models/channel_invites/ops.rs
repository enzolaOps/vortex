use revolt_result::Result;

use crate::Invite;

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractChannelInvites: Sync + Send {
    /// Insert a new invite into the database
    async fn insert_invite(&self, invite: &Invite) -> Result<()>;

    /// Fetch an invite by its id
    async fn fetch_invite(&self, code: &str) -> Result<Invite>;

    /// Fetch all invites for a server
    async fn fetch_invites_for_server(&self, server_id: &str) -> Result<Vec<Invite>>;

    /// Delete an invite by its id
    async fn delete_invite(&self, code: &str) -> Result<()>;

    /// Vortex: count one use of an invite, atomically against `max_uses`
    ///
    /// `false` when nothing was counted: the invite is out of uses, or it is
    /// not a stored invite at all (a discoverable server's pseudo-invite).
    /// Check-then-increment in two steps would let two people race past the
    /// last use; the condition lives in the same write.
    async fn use_invite(&self, code: &str) -> Result<bool>;

    /// Vortex: give back a use counted by `use_invite` whose join then failed
    async fn release_invite_use(&self, code: &str) -> Result<()>;
}
