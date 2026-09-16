use revolt_result::Result;

use crate::ReferenceDb;
use crate::SoundboardSound;

use super::AbstractSoundboardSounds;

#[async_trait]
impl AbstractSoundboardSounds for ReferenceDb {
    async fn insert_sound(&self, sound: &SoundboardSound) -> Result<()> {
        let mut lista = self.soundboard_sounds.lock().await;
        if lista.contains_key(&sound.id) {
            Err(create_database_error!("insert", "sound"))
        } else {
            lista.insert(sound.id.to_string(), sound.clone());
            Ok(())
        }
    }

    async fn fetch_sound(&self, id: &str) -> Result<SoundboardSound> {
        let lista = self.soundboard_sounds.lock().await;
        lista.get(id).cloned().ok_or_else(|| create_error!(NotFound))
    }

    async fn fetch_sounds_by_server(&self, server_id: &str) -> Result<Vec<SoundboardSound>> {
        let lista = self.soundboard_sounds.lock().await;
        Ok(lista
            .values()
            .filter(|item| item.server == server_id)
            .cloned()
            .collect())
    }

    async fn update_sound(&self, sound: &SoundboardSound) -> Result<()> {
        let mut lista = self.soundboard_sounds.lock().await;
        if let Some(item) = lista.get_mut(&sound.id) {
            *item = sound.clone();
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }

    async fn delete_sound(&self, id: &str) -> Result<()> {
        let mut lista = self.soundboard_sounds.lock().await;
        if lista.remove(id).is_some() {
            Ok(())
        } else {
            Err(create_error!(NotFound))
        }
    }
}
