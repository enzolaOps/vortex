use revolt_config::config;
use revolt_models::v0;
use revolt_result::{create_error, Result};

/// Faixa de bitrate aceita, em kbps.
///
/// O teto de 384 é o do Opus em estéreo com folga; abaixo de 8 o codec não
/// produz fala inteligível. O cliente oferece 8–128 hoje, e a faixa do servidor
/// é mais larga de propósito: é ela que decide o que é INVÁLIDO, não o que a
/// tela desenha.
pub const BITRATE_KBPS: std::ops::RangeInclusive<u32> = 8..=384;

/// Valida os campos de voz do Vortex antes de gravar.
///
/// `DataEditChannel.voice` não carrega `#[validate]` aninhado — ligá-lo
/// passaria a recusar o `max_users: 0` que clientes antigos ainda mandam.
/// Por isso a conferência dos campos novos é explícita, aqui.
pub async fn validate_voice_information(voice: &v0::VoiceInformation) -> Result<()> {
    if let Some(bitrate) = voice.bitrate {
        if !BITRATE_KBPS.contains(&bitrate) {
            return Err(create_error!(FailedValidation {
                error: format!(
                    "voice.bitrate must be between {} and {} kbps",
                    BITRATE_KBPS.start(),
                    BITRATE_KBPS.end()
                )
            }));
        }
    }

    // Região fixada precisa existir: um nó desconhecido faria o join_call
    // falhar para todo mundo daquele canal, e a causa ficaria longe do erro.
    if let Some(region) = &voice.rtc_region {
        if !config().await.hosts.livekit.contains_key(region) {
            return Err(create_error!(UnknownNode));
        }
    }

    Ok(())
}
