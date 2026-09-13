#[cfg(feature = "validator")]
use validator::Validate;

auto_derived!(
    /// Efeito sonoro do painel de sons de um servidor
    ///
    /// ⚠ **Vortex, não Stoat.** O `id` É o id do arquivo de áudio no `autumn`.
    pub struct SoundboardSound {
        /// Id único (o mesmo do arquivo)
        #[cfg_attr(feature = "serde", serde(rename = "_id"))]
        pub id: String,
        /// Servidor dono do som
        pub server: String,
        /// Quem enviou
        pub creator_id: String,
        /// Nome
        pub name: String,
        /// Emoji que acompanha o nome
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub emoji: Option<String>,
        /// Volume de ORIGEM, de 0 a 100 — o que todo mundo ouve
        pub volume: u8,
    }

    /// Criar efeito sonoro
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataCreateSoundboardSound {
        /// Servidor onde o som entra
        pub server: String,
        /// Nome
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        pub name: String,
        /// Emoji que acompanha o nome
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub emoji: Option<String>,
        /// Volume de origem, de 0 a 100 (padrão 100)
        #[cfg_attr(feature = "serde", serde(default))]
        pub volume: Option<u8>,
    }

    /// Editar efeito sonoro
    ///
    /// Campo ausente não muda; string VAZIA em `emoji` apaga.
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataEditSoundboardSound {
        /// Nome
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub name: Option<String>,
        /// Emoji que acompanha o nome
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 32)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub emoji: Option<String>,
        /// Volume de origem, de 0 a 100
        #[cfg_attr(feature = "serde", serde(default))]
        pub volume: Option<u8>,
    }
);
