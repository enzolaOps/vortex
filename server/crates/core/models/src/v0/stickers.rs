#[cfg(feature = "validator")]
use validator::Validate;

auto_derived!(
    /// Figurinha de servidor
    ///
    /// ⚠ **Vortex, não Stoat.** Emoji vive dentro de uma linha de texto;
    /// figurinha é a mensagem inteira. O `id` É o id do arquivo no `autumn`,
    /// como no emoji — não há dois identificadores.
    pub struct Sticker {
        /// Id único (o mesmo do arquivo)
        #[cfg_attr(feature = "serde", serde(rename = "_id"))]
        pub id: String,
        /// Servidor dono da figurinha
        pub server: String,
        /// Quem enviou
        pub creator_id: String,
        /// Nome
        pub name: String,
        /// Descrição curta
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub description: Option<String>,
        /// Emoji relacionado (o que a busca usa)
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "Option::is_none", default)
        )]
        pub emoji: Option<String>,
        /// Tipo do arquivo, para quem precisa decidir como desenhar
        pub content_type: String,
        /// Nome do arquivo no `autumn` — compõe a URL do original
        #[cfg_attr(feature = "serde", serde(default))]
        pub filename: String,
    }

    /// Criar figurinha
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataCreateSticker {
        /// Servidor onde a figurinha entra
        pub server: String,
        /// Nome
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 30)))]
        pub name: String,
        /// Descrição curta
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 100)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub description: Option<String>,
        /// Emoji relacionado
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub emoji: Option<String>,
    }

    /// Editar figurinha
    ///
    /// Campo ausente não muda; string VAZIA em `description` ou `emoji` apaga.
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataEditSticker {
        /// Nome
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 30)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub name: Option<String>,
        /// Descrição curta
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 100)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub description: Option<String>,
        /// Emoji relacionado
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 32)))]
        #[cfg_attr(feature = "serde", serde(default))]
        pub emoji: Option<String>,
    }
);
