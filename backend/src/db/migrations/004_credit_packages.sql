-- 004_credit_packages.sql
-- Server-side credit packages catalog for Meoow SaaS

CREATE TABLE IF NOT EXISTS credit_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    credits INTEGER NOT NULL CHECK (credits > 0),
    amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_packages_code ON credit_packages(code);
CREATE INDEX IF NOT EXISTS idx_credit_packages_active ON credit_packages(active);

-- Seed initial standard packages
INSERT INTO credit_packages (code, name, credits, amount_paise, currency, active)
VALUES 
    ('credits_40', '40 Credits', 40, 10000, 'INR', TRUE)
ON CONFLICT (code) DO UPDATE 
SET 
    name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    amount_paise = EXCLUDED.amount_paise,
    currency = EXCLUDED.currency,
    active = EXCLUDED.active,
    updated_at = NOW();

