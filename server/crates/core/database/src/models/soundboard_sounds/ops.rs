use revolt_result::Result;

use crate::SoundboardSound;

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractSoundboardSounds: Sync + Send {
    /// Insert into database
    async fn insert_sound(&self, sound: &SoundboardSound) -> Result<()>;

    /// Fetch by id
    async fn fetch_sound(&self, id: &str) -> Result<SoundboardSound>;

    /// Fetch all of a server
    async fn fetch_sounds_by_server(&self, server_id: &str) -> Result<Vec<SoundboardSound>>;

    /// Rewrite the editable fields
    async fn update_sound(&self, sound: &SoundboardSound) -> Result<()>;

    /// Delete by id
    async fn delete_sound(&self, id: &str) -> Result<()>;
}
