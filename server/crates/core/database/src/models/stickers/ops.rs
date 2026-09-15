use revolt_result::Result;

use crate::Sticker;

#[cfg(feature = "mongodb")]
mod mongodb;
mod reference;

#[async_trait]
pub trait AbstractStickers: Sync + Send {
    /// Insert into database
    async fn insert_sticker(&self, sticker: &Sticker) -> Result<()>;

    /// Fetch by id
    async fn fetch_sticker(&self, id: &str) -> Result<Sticker>;

    /// Fetch all of a server
    async fn fetch_stickers_by_server(&self, server_id: &str) -> Result<Vec<Sticker>>;

    /// Rewrite the editable fields
    async fn update_sticker(&self, sticker: &Sticker) -> Result<()>;

    /// Delete by id
    async fn delete_sticker(&self, id: &str) -> Result<()>;
}
