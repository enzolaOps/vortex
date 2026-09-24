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

/// Mantém o `kind` gravado quando a edição não o traz.
///
/// A edição troca o objeto `voice` INTEIRO. Um cliente Stoat não conhece
/// `kind` e o omite ao mudar o limite de vagas — sem isto, mexer no limite de
/// um canal de vídeo o rebaixaria a voz sem ninguém ter pedido. `kind`
/// explícito sempre ganha, inclusive `voice`, que é como se rebaixa de
/// propósito.
pub fn keep_voice_kind(
    current: Option<&revolt_database::VoiceInformation>,
    mut new: v0::VoiceInformation,
) -> v0::VoiceInformation {
    if new.kind.is_none() {
        new.kind = current
            .and_then(|voice| voice.kind.clone())
            .map(Into::into);
    }
    new
}

#[cfg(test)]
mod test {
    use super::keep_voice_kind;
    use revolt_models::v0;

    fn gravado(kind: Option<revolt_database::VoiceChannelKind>) -> revolt_database::VoiceInformation {
        revolt_database::VoiceInformation {
            max_users: Some(10),
            kind,
            ..Default::default()
        }
    }

    #[test]
    fn edicao_sem_kind_preserva_o_gravado() {
        let atual = gravado(Some(revolt_database::VoiceChannelKind::Video));
        let novo = v0::VoiceInformation {
            max_users: Some(4),
            ..Default::default()
        };
        let saida = keep_voice_kind(Some(&atual), novo);
        assert_eq!(saida.kind, Some(v0::VoiceChannelKind::Video));
        assert_eq!(saida.max_users, Some(4));
    }

    #[test]
    fn kind_explicito_ganha_do_gravado() {
        let atual = gravado(Some(revolt_database::VoiceChannelKind::Stage));
        let novo = v0::VoiceInformation {
            kind: Some(v0::VoiceChannelKind::Voice),
            ..Default::default()
        };
        let saida = keep_voice_kind(Some(&atual), novo);
        assert_eq!(saida.kind, Some(v0::VoiceChannelKind::Voice));
    }

    #[test]
    fn sem_voz_gravada_continua_ausente() {
        let saida = keep_voice_kind(None, v0::VoiceInformation::default());
        assert_eq!(saida.kind, None);
        let saida = keep_voice_kind(Some(&gravado(None)), v0::VoiceInformation::default());
        assert_eq!(saida.kind, None);
    }
}
