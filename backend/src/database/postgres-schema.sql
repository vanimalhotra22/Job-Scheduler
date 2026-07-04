-- Users Table
CREATE TABLE IF NOT EXISTS Users (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organizations Table
CREATE TABLE IF NOT EXISTS Organizations (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id VARCHAR(255) NOT NULL REFERENCES Users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE IF NOT EXISTS Projects (
    id VARCHAR(255) PRIMARY KEY,
    organization_id VARCHAR(255) NOT NULL REFERENCES Organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Retry Policies Table
CREATE TABLE IF NOT EXISTS RetryPolicies (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    delay_ms INTEGER NOT NULL DEFAULT 5000,
    multiplier DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Queues Table
CREATE TABLE IF NOT EXISTS Queues (
    id VARCHAR(255) PRIMARY KEY,
    project_id VARCHAR(255) NOT NULL REFERENCES Projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 1,
    concurrency_limit INTEGER NOT NULL DEFAULT 10,
    retry_policy_id VARCHAR(255) REFERENCES RetryPolicies(id) ON DELETE SET NULL,
    paused INTEGER NOT NULL DEFAULT 0,
    rate_limit_per_minute INTEGER,
    webhook_url TEXT,
    shard_count INTEGER DEFAULT 1,
    region VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

-- Workers Table
CREATE TABLE IF NOT EXISTS Workers (
    id VARCHAR(255) PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS Jobs (
    id VARCHAR(255) PRIMARY KEY,
    queue_id VARCHAR(255) NOT NULL REFERENCES Queues(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    priority INTEGER NOT NULL DEFAULT 1,
    payload TEXT NOT NULL,
    scheduled_for TIMESTAMP NOT NULL,
    worker_id VARCHAR(255) REFERENCES Workers(id) ON DELETE SET NULL,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    timeout_ms INTEGER NOT NULL DEFAULT 60000,
    idempotency_key VARCHAR(255),
    dependency_job_id VARCHAR(255) REFERENCES Jobs(id) ON DELETE SET NULL,
    tags TEXT,
    version INTEGER DEFAULT 1,
    correlation_id VARCHAR(255),
    payload_history TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_selection ON Jobs(status, scheduled_for, priority DESC, created_at ASC);

-- Job Executions Table
CREATE TABLE IF NOT EXISTS JobExecutions (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL REFERENCES Jobs(id) ON DELETE CASCADE,
    worker_id VARCHAR(255) REFERENCES Workers(id) ON DELETE SET NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_ms INTEGER,
    status VARCHAR(50) NOT NULL,
    error_message TEXT
);

-- Worker Heartbeats Table
CREATE TABLE IF NOT EXISTS WorkerHeartbeats (
    id VARCHAR(255) PRIMARY KEY,
    worker_id VARCHAR(255) NOT NULL REFERENCES Workers(id) ON DELETE CASCADE,
    heartbeat_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cpu_usage DOUBLE PRECISION NOT NULL,
    memory_usage DOUBLE PRECISION NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workers_heartbeat ON Workers(last_heartbeat);

-- Dead Letter Queue Table
CREATE TABLE IF NOT EXISTS DeadLetterQueue (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) UNIQUE NOT NULL REFERENCES Jobs(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved INTEGER NOT NULL DEFAULT 0
);

-- Job Logs Table
CREATE TABLE IF NOT EXISTS JobLogs (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL REFERENCES Jobs(id) ON DELETE CASCADE,
    worker_id VARCHAR(255),
    message TEXT NOT NULL,
    level VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_job_logs_job_id ON JobLogs(job_id, timestamp);

-- Scheduled Jobs
CREATE TABLE IF NOT EXISTS ScheduledJobs (
    id VARCHAR(255) PRIMARY KEY,
    queue_id VARCHAR(255) NOT NULL REFERENCES Queues(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    next_run_at TIMESTAMP NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS AuditLogs (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255),
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys Table
CREATE TABLE IF NOT EXISTS ApiKeys (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
    project_id VARCHAR(255) NOT NULL REFERENCES Projects(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    permissions TEXT,
    rate_limit INTEGER DEFAULT 100,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job Tags Table
CREATE TABLE IF NOT EXISTS JobTags (
    id VARCHAR(255) PRIMARY KEY,
    job_id VARCHAR(255) NOT NULL REFERENCES Jobs(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL
);
