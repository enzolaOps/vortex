//! Vortex — acesso, segurança e modelo do servidor.
//!
//! Tudo aqui é ADITIVO ao protocolo do Stoat: um servidor sem `security` se
//! comporta exatamente como antes (entra quem tem convite, ninguém precisa de
//! nada para falar, DM só entre amigos, sem emergência). Os defaults dos campos
//! são escolhidos para que "ausente" e "valor padrão" signifiquem a mesma coisa.

use std::collections::HashMap;

use iso8601_timestamp::Timestamp;
use revolt_permissions::OverrideField;

use super::{LegacyServerChannelType, User, VoiceInformation};

#[cfg(feature = "validator")]
use validator::Validate;

auto_derived!(
    /// Quem consegue entrar no servidor
    #[derive(Default)]
    pub enum ServerJoinMode {
        /// Qualquer pessoa com convite entra na hora (comportamento do Stoat)
        #[default]
        Invite,
        /// O convite gera um pedido que a moderação aprova ou recusa
        Approval,
        /// Nenhum convite funciona
        Closed,
    }

    /// O que uma conta precisa cumprir antes de falar no servidor
    #[derive(Default)]
    pub enum ServerVerificationLevel {
        /// Sem restrição
        #[default]
        None,
        /// Email confirmado na conta
        Low,
        /// Email confirmado e conta com pelo menos 5 minutos
        Medium,
        /// Tudo de `Medium` e pelo menos 10 minutos como membro
        High,
    }

    /// Ações de emergência ativas até `until`
    pub struct ServerEmergency {
        /// Momento em que as ações expiram sozinhas
        pub until: Timestamp,
        /// Convites não funcionam e não podem ser criados
        pub pause_invites: bool,
        /// Ninguém sem `ManageServer` menciona @everyone / @online
        pub silence_everyone: bool,
        /// Nenhuma entrada nova, nem por aprovação
        pub freeze_joins: bool,
    }

    /// Política de acesso e segurança do servidor
    #[derive(Default)]
    pub struct ServerSecurity {
        /// Quem consegue entrar
        #[cfg_attr(feature = "serde", serde(default))]
        pub join_mode: ServerJoinMode,
        /// Exigir email verificado para entrar
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub require_verified_email: bool,
        /// O que é preciso cumprir antes de falar
        #[cfg_attr(feature = "serde", serde(default))]
        pub verification_level: ServerVerificationLevel,
        /// Membros deste servidor podem abrir DM sem serem amigos
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub allow_member_dms: bool,
        /// Remover links de convite de terceiros nas DMs entre membros
        #[cfg_attr(
            feature = "serde",
            serde(skip_serializing_if = "crate::if_false", default)
        )]
        pub filter_dm_invites: bool,
        /// Ações de emergência (podem ter expirado; ver `active_emergency`)
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub emergency: Option<ServerEmergency>,
    }

    /// Mudança parcial da política de acesso e segurança
    #[derive(Default)]
    pub struct DataEditServerSecurity {
        pub join_mode: Option<ServerJoinMode>,
        pub require_verified_email: Option<bool>,
        pub verification_level: Option<ServerVerificationLevel>,
        pub allow_member_dms: Option<bool>,
        pub filter_dm_invites: Option<bool>,
    }

    /// Pedido de entrada pendente
    pub struct ServerJoinRequest {
        /// Servidor pedido
        pub server: String,
        /// Quem pediu
        pub user: String,
        /// Quando pediu
        pub created_at: Timestamp,
    }

    /// Pedidos de entrada com os usuários que os fizeram
    pub struct ServerJoinRequestList {
        pub requests: Vec<ServerJoinRequest>,
        pub users: Vec<User>,
    }

    /// Modelo de servidor: estrutura sem conteúdo
    pub struct ServerTemplate {
        /// Código do modelo (vai no link)
        #[cfg_attr(feature = "serde", serde(rename = "_id"))]
        pub code: String,
        /// Servidor de origem
        pub server: String,
        /// Quem gerou
        pub creator: String,
        /// Nome do modelo
        pub name: String,
        /// Descrição do modelo
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub description: Option<String>,
        /// Quando foi gerado
        pub created_at: Timestamp,
        /// Última sincronização com o servidor de origem
        pub updated_at: Timestamp,
        /// Quantas vezes foi usado
        #[cfg_attr(feature = "serde", serde(default))]
        pub uses: u64,
        /// A estrutura
        pub snapshot: ServerTemplateSnapshot,
    }

    /// Estrutura capturada — nunca mensagens, membros nem convites
    pub struct ServerTemplateSnapshot {
        pub name: String,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub description: Option<String>,
        pub default_permissions: i64,
        #[cfg_attr(feature = "serde", serde(default))]
        pub roles: Vec<ServerTemplateRole>,
        #[cfg_attr(feature = "serde", serde(default))]
        pub channels: Vec<ServerTemplateChannel>,
        #[cfg_attr(feature = "serde", serde(default))]
        pub categories: Vec<ServerTemplateCategory>,
    }

    /// Cargo no modelo (o `id` só amarra as exceções dos canais)
    pub struct ServerTemplateRole {
        pub id: String,
        pub name: String,
        pub permissions: OverrideField,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub colour: Option<String>,
        #[cfg_attr(feature = "serde", serde(default))]
        pub hoist: bool,
        #[cfg_attr(feature = "serde", serde(default))]
        pub rank: i64,
    }

    /// Canal no modelo
    pub struct ServerTemplateChannel {
        pub id: String,
        pub name: String,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub description: Option<String>,
        #[cfg_attr(feature = "serde", serde(rename = "type", default))]
        pub channel_type: LegacyServerChannelType,
        #[cfg_attr(feature = "serde", serde(default))]
        pub nsfw: bool,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub voice: Option<VoiceInformation>,
        #[cfg_attr(feature = "serde", serde(skip_serializing_if = "Option::is_none"))]
        pub default_permissions: Option<OverrideField>,
        #[cfg_attr(feature = "serde", serde(default))]
        pub role_permissions: HashMap<String, OverrideField>,
    }

    /// Categoria no modelo (canais por `id` do modelo)
    pub struct ServerTemplateCategory {
        pub title: String,
        pub channels: Vec<String>,
    }

    /// Gerar o modelo de um servidor
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataCreateServerTemplate {
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 100)))]
        pub name: String,
        #[cfg_attr(feature = "validator", validate(length(min = 0, max = 1024)))]
        pub description: Option<String>,
    }

    /// Criar um servidor a partir de um modelo
    #[cfg_attr(feature = "validator", derive(Validate))]
    pub struct DataUseServerTemplate {
        #[cfg_attr(feature = "validator", validate(length(min = 1, max = 32)))]
        pub name: String,
    }
);

impl ServerSecurity {
    /// Emergência vigente, se houver — expirada conta como ausente
    pub fn active_emergency(&self) -> Option<&ServerEmergency> {
        let now = Timestamp::now_utc();
        self.emergency.as_ref().filter(|e| e.until > now)
    }
}

impl DataEditServerSecurity {
    /// Aplica a mudança sobre a política existente
    pub fn apply(self, security: &mut ServerSecurity) {
        if let Some(v) = self.join_mode {
            security.join_mode = v;
        }
        if let Some(v) = self.require_verified_email {
            security.require_verified_email = v;
        }
        if let Some(v) = self.verification_level {
            security.verification_level = v;
        }
        if let Some(v) = self.allow_member_dms {
            security.allow_member_dms = v;
        }
        if let Some(v) = self.filter_dm_invites {
            security.filter_dm_invites = v;
        }
    }

    pub fn is_empty(&self) -> bool {
        self.join_mode.is_none()
            && self.require_verified_email.is_none()
            && self.verification_level.is_none()
            && self.allow_member_dms.is_none()
            && self.filter_dm_invites.is_none()
    }
}
