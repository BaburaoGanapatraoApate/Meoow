-- 002_credit_usage_mode.sql
-- Add usage_mode to users table with constraint and index

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS usage_mode VARCHAR(20) NOT NULL DEFAULT 'credits';

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_users_usage_mode'
    ) THEN 
        ALTER TABLE users 
        ADD CONSTRAINT check_users_usage_mode 
        CHECK (usage_mode IN ('credits', 'unlimited'));
    END IF; 
END $$;

CREATE INDEX IF NOT EXISTS idx_users_usage_mode ON users(usage_mode);

