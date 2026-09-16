use revolt_result::Result;

use crate::ReferenceDb;
use crate::Sticker;

use super::AbstractStickers;

#[async_trait]
impl AbstractStickers for ReferenceDb {
    async fn insert_sticker(&self, sticker: &Sticker) -> Result<()> {
        let mut lista = self.stickers.lock().await;
        if lista.contains_key(&sticker.id) {
            Err(create_database_error!("insert", "sticker"))
        } else {
            lista.insert(sticker.id.to_string(), sticker.clone());
            Ok(())
        }
    }

    async fn fetch_sticker(&self, id: &str) -> Result<Sticker> {
        let lista = self.stickers.lock().await;
        lista.get(id).cloned().ok_or_else(|| create_error!(NotFound))
    }

    async fn fetch_stickers_by_server(&self, server_id: &str) -> Result<Vec<Sticker>> {
        let lista = self.stickers.lock().await;
        Ok(lista
            .values()
            .filter(|item| item.server == server_id)
            .cloned()
            .collect())
    }

    async fn update_sticker(&self, sticker: &Sticker) -> Result<()> {
        let mut lista = self.stickers.lock().await;
        if let Some(item) = lista.get_mut(&sticker.id) {
            *item = sticker.clone();
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }

    async fn delete_sticker(&self, id: &str) -> Result<()> {
        let mut lista = self.stickers.lock().await;
        if lista.remove(id).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }
}
