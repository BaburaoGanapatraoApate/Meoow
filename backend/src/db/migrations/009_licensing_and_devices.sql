-- 009_licensing_and_devices.sql
-- Production licensing and device management

-- 1. Add max_devices to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 2;

-- Set default limits for admin and unlimited users
UPDATE users SET max_devices = 10 WHERE role = 'admin' AND max_devices = 2;
UPDATE users SET max_devices = 3 WHERE usage_mode = 'unlimited' AND role != 'admin' AND max_devices = 2;

-- 2. Update devices table with production device management columns
ALTER TABLE devices
ADD COLUMN IF NOT EXISTS device_token_hash TEXT,
ADD COLUMN IF NOT EXISTS device_name VARCHAR(100) DEFAULT 'Windows PC',
ADD COLUMN IF NOT EXISTS platform VARCHAR(50) DEFAULT 'win32',
ADD COLUMN IF NOT EXISTS os_version VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45),
ADD COLUMN IF NOT EXISTS replacement_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'check_devices_status'
    ) THEN 
        ALTER TABLE devices 
        ADD CONSTRAINT check_devices_status 
        CHECK (status IN ('active', 'revoked', 'deactivated'));
    END IF; 
END $$;

-- 3. Unique index on (user_id, device_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_devices_user_device ON devices(user_id, device_id);

-- 4. Fast lookup indexes on devices
CREATE INDEX IF NOT EXISTS idx_devices_user_status ON devices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at);

-- 5. Create device_audit_logs table
CREATE TABLE IF NOT EXISTS device_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    action VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_audit_logs_user_id ON device_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_device_audit_logs_device_id ON device_audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_device_audit_logs_action ON device_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_device_audit_logs_created_at ON device_audit_logs(created_at);

