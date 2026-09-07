-- 008_production_and_test_packages.sql
-- Add is_test column and populate production + temporary test packages

ALTER TABLE credit_packages ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_credit_packages_is_test ON credit_packages(is_test);

-- 1. Ensure production package 1: 40 credits / ₹100
INSERT INTO credit_packages (code, name, credits, amount_paise, currency, active, is_test)
VALUES ('credits_40', '40 Credits', 40, 10000, 'INR', TRUE, FALSE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    amount_paise = EXCLUDED.amount_paise,
    currency = EXCLUDED.currency,
    active = TRUE,
    is_test = FALSE,
    updated_at = NOW();

-- 2. Ensure production package 2: 90 credits / ₹200 (10 bonus credits)
INSERT INTO credit_packages (code, name, credits, amount_paise, currency, active, is_test)
VALUES ('credits_90', '90 Credits', 90, 20000, 'INR', TRUE, FALSE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    amount_paise = EXCLUDED.amount_paise,
    currency = EXCLUDED.currency,
    active = TRUE,
    is_test = FALSE,
    updated_at = NOW();

-- 3. Controlled Live Test Package 1: 5 credits / ₹5
INSERT INTO credit_packages (code, name, credits, amount_paise, currency, active, is_test)
VALUES ('test_credits_5', '5 Credits (Test)', 5, 500, 'INR', TRUE, TRUE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    amount_paise = EXCLUDED.amount_paise,
    currency = EXCLUDED.currency,
    active = TRUE,
    is_test = TRUE,
    updated_at = NOW();

-- 4. Controlled Live Test Package 2: 10 credits / ₹10
INSERT INTO credit_packages (code, name, credits, amount_paise, currency, active, is_test)
VALUES ('test_credits_10', '10 Credits (Test)', 10, 1000, 'INR', TRUE, TRUE)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    credits = EXCLUDED.credits,
    amount_paise = EXCLUDED.amount_paise,
    currency = EXCLUDED.currency,
    active = TRUE,
    is_test = TRUE,
    updated_at = NOW();
