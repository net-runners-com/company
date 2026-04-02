-- AI Company — PostgreSQL Schema
-- All tables include user_id for multi-tenancy

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users ───
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'lite', 'pro', 'business')),
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Companies ───
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    industry TEXT DEFAULT '',
    mission TEXT DEFAULT '',
    goals TEXT DEFAULT '',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies(user_id);

-- ─── Employees ───
CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_employees_user ON employees(user_id);

-- ─── Data Store (generic key-value JSON, multi-tenant) ───
CREATE TABLE IF NOT EXISTS data_store (
    id TEXT NOT NULL,
    collection TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (id, collection, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ds_collection ON data_store(user_id, collection);
CREATE INDEX IF NOT EXISTS idx_ds_created ON data_store(user_id, collection, created_at);

-- ─── Chat Threads ───
CREATE TABLE IF NOT EXISTS chat_threads (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emp_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_threads_user_emp ON chat_threads(user_id, emp_id);

-- ─── Chat Messages ───
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emp_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_msgs_thread ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_msgs_user_emp ON chat_messages(user_id, emp_id);

-- ─── Connectors ───
CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_connectors_user ON connectors(user_id);

-- ─── API Usage Tracking ───
CREATE TABLE IF NOT EXISTS api_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    employee_id TEXT,
    model TEXT NOT NULL,
    tokens_in INTEGER NOT NULL DEFAULT 0,
    tokens_out INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(10,6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_user_month ON api_usage(user_id, created_at);

-- ─── Google Tokens ───
CREATE TABLE IF NOT EXISTS google_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, scope)
);

-- ─── Default user for development ───
INSERT INTO users (id, email, password_hash, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'dev@example.com', 'dev', 'Dev User')
ON CONFLICT (id) DO NOTHING;
