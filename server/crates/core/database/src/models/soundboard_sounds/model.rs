use revolt_result::Result;

use crate::events::client::EventV1;
use crate::Database;

auto_derived!(
    /// Efeito sonoro do painel de sons de um servidor (Vortex)
    ///
    /// ⚠ O `id` É o id do arquivo no `autumn`, como no emoji.
    pub struct SoundboardSound {
        /// Id único (o mesmo do arquivo)
        #[serde(rename = "_id")]
        pub id: String,
        /// Servidor dono
        pub server: String,
        /// Quem enviou
        pub creator_id: String,
        /// Nome
        pub name: String,
        /// Emoji que acompanha o nome
        #[serde(default)]
        pub emoji: Option<String>,
        /// Volume de origem, de 0 a 100
        pub volume: u8,
    }
);

#[allow(clippy::disallowed_methods)]
impl SoundboardSound {
    /// Guarda e avisa os membros do servidor
    pub async fn create(&self, db: &Database) -> Result<()> {
        db.insert_sound(self).await?;

        EventV1::SoundboardSoundCreate(self.clone().into())
            .p(self.server.clone())
            .await;

        Ok(())
    }

    /// Regrava os campos editáveis e avisa com o objeto inteiro
    pub async fn update(&self, db: &Database) -> Result<()> {
        db.update_sound(self).await?;

        EventV1::SoundboardSoundUpdate(self.clone().into())
            .p(self.server.clone())
            .await;

        Ok(())
    }

    /// Apaga de vez
    ///
    /// ⚠ O ARQUIVO fica: mensagens antigas apontam para ele pelo id.
    pub async fn delete(self, db: &Database) -> Result<()> {
        db.delete_sound(&self.id).await?;

        EventV1::SoundboardSoundDelete {
            id: self.id,
            server: self.server.clone(),
        }
        .p(self.server)
        .await;

        Ok(())
    }
}
