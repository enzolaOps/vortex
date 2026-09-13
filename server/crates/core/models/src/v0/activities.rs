auto_derived!(
    /// Vortex: shared activity running inside a voice channel
    ///
    /// The server only stores and relays; what the activity means is up to the
    /// embedded host running on each client. `ops` is the replay log a late
    /// joiner uses to catch up, capped on the server.
    pub struct ActivitySession {
        /// Unique Id of this session
        #[cfg_attr(feature = "serde", serde(rename = "_id"))]
        pub id: String,
        /// Voice channel this session lives in
        pub channel_id: String,
        /// Kind of activity, from the client catalogue
        pub kind: String,
        /// User who started the session
        pub host: String,
        /// Unix time in milliseconds when it started
        pub started_at: i64,
        /// Replay log, oldest first
        #[cfg_attr(feature = "serde", serde(default))]
        pub ops: Vec<ActivityOp>,
    }

    /// Vortex: one operation inside an activity
    pub struct ActivityOp {
        /// Who sent it
        pub user: String,
        /// Unix time in milliseconds on the server
        pub at: i64,
        /// Opaque payload (JSON text), validated by the activity host on each client
        pub op: String,
    }

    /// Vortex: start an activity
    pub struct DataStartActivity {
        /// Kind of activity, from the client catalogue
        pub kind: String,
    }

    /// Vortex: send an operation to the running activity
    pub struct DataActivityOp {
        /// Session this operation is meant for
        pub activity_id: String,
        /// Opaque payload (JSON text)
        pub op: String,
    }
);
