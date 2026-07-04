-- Enable WAL mode and foreign key constraints on connection
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'USER', -- 'ADMIN', 'USER'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Organizations Table
CREATE TABLE IF NOT EXISTS Organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES Users(id) ON DELETE RESTRICT
);

-- Projects Table
CREATE TABLE IF NOT EXISTS Projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organization_id) REFERENCES Organizations(id) ON DELETE CASCADE
);

-- Retry Policies Table
CREATE TABLE IF NOT EXISTS RetryPolicies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'FIXED', 'LINEAR', 'EXPONENTIAL'
    delay_ms INTEGER NOT NULL DEFAULT 5000,
    multiplier REAL NOT NULL DEFAULT 2.0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Queues Table
CREATE TABLE IF NOT EXISTS Queues (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1, -- 1=LOW, 2=MEDIUM, 3=HIGH
    concurrency_limit INTEGER NOT NULL DEFAULT 10,
    retry_policy_id TEXT,
    paused INTEGER NOT NULL DEFAULT 0, -- 0=FALSE, 1=TRUE
    rate_limit_per_minute INTEGER,     -- Token bucket rate limit
    webhook_url TEXT,                  -- Slack/Discord webhook alerts URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
    FOREIGN KEY (retry_policy_id) REFERENCES RetryPolicies(id) ON DELETE SET NULL,
    UNIQUE(project_id, name)
);

-- Workers Table
CREATE TABLE IF NOT EXISTS Workers (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'IDLE', 'OFFLINE'
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS Jobs (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- 'QUEUED', 'SCHEDULED', 'CLAIMED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD', 'BLOCKED', 'CANCELLED'
    priority INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL, -- JSON string
    scheduled_for DATETIME NOT NULL, -- When the job should run
    worker_id TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    timeout_ms INTEGER NOT NULL DEFAULT 60000, -- 1 minute default
    idempotency_key TEXT,
    dependency_job_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES Queues(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES Workers(id) ON DELETE SET NULL,
    FOREIGN KEY (dependency_job_id) REFERENCES Jobs(id) ON DELETE SET NULL
);

-- Unique index for idempotency keys per queue
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_idempotency ON Jobs(queue_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Composite index for fast job selection by scheduler / workers
CREATE INDEX IF NOT EXISTS idx_jobs_selection ON Jobs(status, scheduled_for, priority DESC, created_at ASC);

-- Job Executions Table (History of executions)
CREATE TABLE IF NOT EXISTS JobExecutions (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    worker_id TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_ms INTEGER,
    status TEXT NOT NULL, -- 'SUCCESS', 'FAILED'
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES Workers(id) ON DELETE SET NULL
);

-- Worker Heartbeats Table
CREATE TABLE IF NOT EXISTS WorkerHeartbeats (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    heartbeat_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES Workers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workers_heartbeat ON Workers(last_heartbeat);

-- Dead Letter Queue Table
CREATE TABLE IF NOT EXISTS DeadLetterQueue (
    id TEXT PRIMARY KEY,
    job_id TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL,
    failed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved INTEGER NOT NULL DEFAULT 0, -- 0=FALSE, 1=TRUE
    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE
);

-- Job Logs Table (detailed logs for developers)
CREATE TABLE IF NOT EXISTS JobLogs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    worker_id TEXT,
    message TEXT NOT NULL,
    level TEXT NOT NULL, -- 'INFO', 'WARN', 'ERROR'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON JobLogs(job_id, timestamp);

-- Scheduled Jobs (Cron templates)
CREATE TABLE IF NOT EXISTS ScheduledJobs (
    id TEXT PRIMARY KEY,
    queue_id TEXT NOT NULL,
    name TEXT NOT NULL,
    cron_expression TEXT NOT NULL,
    payload TEXT NOT NULL, -- JSON string
    next_run_at DATETIME NOT NULL,
    active INTEGER NOT NULL DEFAULT 1, -- 0=FALSE, 1=TRUE
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (queue_id) REFERENCES Queues(id) ON DELETE CASCADE
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS AuditLogs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS ApiKeys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT,
    rate_limit INTEGER DEFAULT 100,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE
);

-- Job Tags Table
CREATE TABLE IF NOT EXISTS JobTags (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    FOREIGN KEY (job_id) REFERENCES Jobs(id) ON DELETE CASCADE
);

