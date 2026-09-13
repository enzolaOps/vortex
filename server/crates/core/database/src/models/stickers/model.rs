use revolt_result::Result;

use crate::events::client::EventV1;
use crate::Database;

auto_derived!(
    /// Figurinha de servidor (Vortex)
    ///
    /// ⚠ O `id` É o id do arquivo no `autumn`, como no emoji.
    pub struct Sticker {
        /// Id único (o mesmo do arquivo)
        #[serde(rename = "_id")]
        pub id: String,
        /// Servidor dono
        pub server: String,
        /// Quem enviou
        pub creator_id: String,
        /// Nome
        pub name: String,
        /// Descrição curta
        #[serde(default)]
        pub description: Option<String>,
        /// Emoji relacionado
        #[serde(default)]
        pub emoji: Option<String>,
        /// Tipo do arquivo
        pub content_type: String,
    }
);

#[allow(clippy::disallowed_methods)]
impl Sticker {
    /// Guarda e avisa os membros do servidor
    pub async fn create(&self, db: &Database) -> Result<()> {
        db.insert_sticker(self).await?;

        EventV1::StickerCreate(self.clone().into())
            .p(self.server.clone())
            .await;

        Ok(())
    }

    /// Regrava os campos editáveis e avisa com o objeto inteiro
    pub async fn update(&self, db: &Database) -> Result<()> {
        db.update_sticker(self).await?;

        EventV1::StickerUpdate(self.clone().into())
            .p(self.server.clone())
            .await;

        Ok(())
    }

    /// Apaga de vez
    ///
    /// ⚠ O ARQUIVO fica: mensagens antigas apontam para ele pelo id.
    pub async fn delete(self, db: &Database) -> Result<()> {
        db.delete_sticker(&self.id).await?;

        EventV1::StickerDelete {
            id: self.id,
            server: self.server.clone(),
        }
        .p(self.server)
        .await;

        Ok(())
    }
}
