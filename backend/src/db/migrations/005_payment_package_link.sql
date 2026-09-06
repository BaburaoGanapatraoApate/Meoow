-- 005_payment_package_link.sql
-- Linking payment orders to credit fulfillment and package definitions

DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_orders' AND column_name = 'credits_fulfilled_at'
    ) THEN 
        ALTER TABLE payment_orders 
        ADD COLUMN credits_fulfilled_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_orders' AND column_name = 'credits_awarded'
    ) THEN 
        ALTER TABLE payment_orders 
        ADD COLUMN credits_awarded INTEGER DEFAULT 0;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payment_orders_credits_fulfilled_at ON payment_orders(credits_fulfilled_at);
CREATE INDEX IF NOT EXISTS idx_payment_orders_package_id ON payment_orders(package_id);

