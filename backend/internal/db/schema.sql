-- ══════════════════════════════════════════════════════════════════════
-- EARN MINI APP POSTGRESQL SCHEMA (HIGH CONCURRENCY & OPTIMIZED INDEXES)
-- ══════════════════════════════════════════════════════════════════════

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(64),
    first_name VARCHAR(128) NOT NULL,
    photo_url VARCHAR(512),
    language_code VARCHAR(10) DEFAULT 'en',
    is_premium BOOLEAN DEFAULT FALSE,
    level INT DEFAULT 1,
    energy INT DEFAULT 50,
    max_energy INT DEFAULT 50,
    spins INT DEFAULT 12,
    diamonds BIGINT DEFAULT 0,
    balance_usd NUMERIC(12, 4) DEFAULT 0.0000,
    referrer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    ton_wallet VARCHAR(128),
    is_banned BOOLEAN DEFAULT FALSE,
    has_claimed_channel_reward BOOLEAN DEFAULT FALSE,
    last_energy_refill TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_referrer_id ON users(referrer_id);
CREATE INDEX IF NOT EXISTS idx_users_balance_usd ON users(balance_usd DESC);

-- 2. Audit Ledger / Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL, -- 'spins', 'daily', 'tasks', 'team', 'withdrawals', 'raffles', 'gift'
    title VARCHAR(128) NOT NULL,
    amount_usd NUMERIC(12, 4) DEFAULT 0.0000,
    amount_diamonds BIGINT DEFAULT 0,
    amount_spins INT DEFAULT 0,
    amount_tickets INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'completed', -- 'completed', 'processing', 'failed'
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    tx_hash VARCHAR(128),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON transactions(reference_id);

-- 3. Daily Rewards Streak Table
CREATE TABLE IF NOT EXISTS daily_streaks (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_day INT DEFAULT 1,
    last_claim_date DATE,
    total_claims INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Gift Codes Table
CREATE TABLE IF NOT EXISTS gift_codes (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    reward_diamonds BIGINT DEFAULT 0,
    reward_spins INT DEFAULT 0,
    reward_usd NUMERIC(12, 4) DEFAULT 0.00,
    max_claims INT DEFAULT 1000,
    current_claims INT DEFAULT 0,
    is_multi_use BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS reward_diamonds BIGINT DEFAULT 0;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS reward_spins INT DEFAULT 0;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS reward_usd NUMERIC(12, 4) DEFAULT 0.00;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS max_claims INT DEFAULT 1000;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS current_claims INT DEFAULT 0;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS is_multi_use BOOLEAN DEFAULT TRUE;
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS batch_id VARCHAR(64);
ALTER TABLE gift_codes ADD COLUMN IF NOT EXISTS batch_name VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_gift_codes_batch_id ON gift_codes(batch_id);

CREATE TABLE IF NOT EXISTS gift_code_claims (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    gift_code_id BIGINT REFERENCES gift_codes(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, gift_code_id)
);

CREATE TABLE IF NOT EXISTS user_gift_claims (
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    gift_code_id BIGINT REFERENCES gift_codes(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, gift_code_id)
);

-- 5. Tasks & Quest Management
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(32) NOT NULL, -- 'special', 'daily', 'socials'
    title VARCHAR(256) NOT NULL,
    icon VARCHAR(256),
    icon_url VARCHAR(512),
    is_icon_image BOOLEAN DEFAULT FALSE,
    reward_gems INT DEFAULT 0,
    reward_spins INT DEFAULT 0,
    secondary_reward_gems INT DEFAULT 0,
    target_count INT DEFAULT 1,
    task_type VARCHAR(64) NOT NULL, -- 'telegram_channel', 'social_x', 'spin_count', 'invite_count', 'level_reach'
    action_url VARCHAR(512),
    channel_id VARCHAR(128),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS icon_url VARCHAR(512);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reward_spins INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS channel_id VARCHAR(128);

CREATE TABLE IF NOT EXISTS user_tasks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE CASCADE,
    progress INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'pending', -- 'pending', 'verifying', 'completed'
    started_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, task_id)
);

ALTER TABLE user_tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);

-- 6. Raffles & Lotteries
CREATE TABLE IF NOT EXISTS raffles (
    id VARCHAR(64) PRIMARY KEY, -- '#VIP260803'
    title VARCHAR(128) NOT NULL,
    cash_reward NUMERIC(12, 2) DEFAULT 0.00,
    coin_reward_str VARCHAR(32) DEFAULT '1M',
    ticket_price_gems INT DEFAULT 200,
    ticket_price_usd NUMERIC(10, 4) DEFAULT 0.50,
    ticket_price_stars INT DEFAULT 25,
    ticket_gem_price INT DEFAULT 200,
    enable_usd_payment BOOLEAN DEFAULT TRUE,
    enable_stars_payment BOOLEAN DEFAULT TRUE,
    enable_gems_payment BOOLEAN DEFAULT TRUE,
    max_tickets_per_user INT DEFAULT 50,
    total_tickets_sold INT DEFAULT 0,
    participants_count INT DEFAULT 0,
    total_tickets_count INT DEFAULT 0,
    status VARCHAR(32) DEFAULT 'ongoing', -- 'ongoing', 'ended'
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    winners_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE raffles ADD COLUMN IF NOT EXISTS ticket_price_usd NUMERIC(10, 4) DEFAULT 0.50;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS ticket_price_stars INT DEFAULT 25;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS ticket_gem_price INT DEFAULT 200;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS enable_usd_payment BOOLEAN DEFAULT TRUE;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS enable_stars_payment BOOLEAN DEFAULT TRUE;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS enable_gems_payment BOOLEAN DEFAULT TRUE;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS max_tickets_per_user INT DEFAULT 50;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS total_tickets_sold INT DEFAULT 0;
ALTER TABLE raffles ADD COLUMN IF NOT EXISTS prize_tiers JSONB DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS raffle_tickets (
    id BIGSERIAL PRIMARY KEY,
    raffle_id VARCHAR(64) REFERENCES raffles(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    ticket_count INT DEFAULT 1,
    source VARCHAR(32) DEFAULT 'gems', -- 'gems', 'vip', 'stars', 'usdt'
    payment_method VARCHAR(32) DEFAULT 'usdt',
    payment_ref VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE raffle_tickets ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) DEFAULT 'usdt';
ALTER TABLE raffle_tickets ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_raffle_tickets_raffle_user ON raffle_tickets(raffle_id, user_id);

-- 7. Tournaments (Dynamic Weekly & Monthly Contests)
CREATE TABLE IF NOT EXISTS contests (
    id BIGSERIAL PRIMARY KEY,
    contest_id VARCHAR(64) UNIQUE NOT NULL, -- 'spin_weekly', 'referral_monthly'
    type VARCHAR(32) NOT NULL,              -- 'spins', 'referrals'
    title VARCHAR(128) NOT NULL,
    prize_pool_usd NUMERIC(12, 2) DEFAULT 500.00,
    prize_pool_str VARCHAR(64) DEFAULT '$500.00 USDT',
    icon VARCHAR(512) DEFAULT './assets/wheel-of-fortune.png',
    prize_distribution JSONB NOT NULL DEFAULT '[]'::jsonb,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) DEFAULT 'active',     -- 'active', 'upcoming', 'ended'
    is_active BOOLEAN DEFAULT TRUE,
    winners_json JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contests ADD COLUMN IF NOT EXISTS prize_pool_str VARCHAR(64) DEFAULT '$500.00 USDT';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS icon VARCHAR(512) DEFAULT './assets/wheel-of-fortune.png';
ALTER TABLE contests ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS winners_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE contests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. Withdrawals Table
CREATE TABLE IF NOT EXISTS withdrawals (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount_usd NUMERIC(12, 4) NOT NULL,
    fee_usd NUMERIC(12, 4) NOT NULL,
    net_payout_usd NUMERIC(12, 4) NOT NULL,
    ton_address VARCHAR(128) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing', -- 'processing', 'completed', 'rejected'
    reference_id VARCHAR(64) UNIQUE NOT NULL,
    tx_hash VARCHAR(128),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

-- 9. Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'general',
    description TEXT NOT NULL,
    screenshot_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 10. Crypto Invoices Table (BEP-20 USDT Deposits)
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    invoice_id VARCHAR(64) UNIQUE NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    wallet_index BIGINT NOT NULL DEFAULT 0,
    deposit_address VARCHAR(128) NOT NULL,
    amount_usd NUMERIC(16, 2) NOT NULL,
    purpose VARCHAR(64) NOT NULL DEFAULT 'diamonds', -- 'diamonds', 'raffle_tickets', 'vip'
    reference_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',   -- 'pending', 'paid', 'expired'
    sweep_status VARCHAR(32) NOT NULL DEFAULT 'unclaimed', -- 'unclaimed', 'sweeping', 'swept', 'failed'
    tx_hash VARCHAR(128),
    sweep_tx_hash VARCHAR(128),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_invoices_deposit_address ON invoices(deposit_address);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_sweep_status ON invoices(sweep_status);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);

-- 11. System Settings & Admin Master Wallet Storage
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Gift Code Multi-User Claims (Enforces 1 claim per user for shared promo codes)
CREATE TABLE IF NOT EXISTS gift_code_claims (
    id BIGSERIAL PRIMARY KEY,
    gift_code_id BIGINT REFERENCES gift_codes(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(gift_code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gift_code_claims_user ON gift_code_claims(user_id);

-- 13. Dynamic Tournaments & Contests (Referral Champions & Spin Champions)
CREATE TABLE IF NOT EXISTS contests (
    id BIGSERIAL PRIMARY KEY,
    contest_id VARCHAR(64) UNIQUE NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'referrals' or 'spins'
    title VARCHAR(128) NOT NULL,
    prize_pool_usd NUMERIC(16, 2) NOT NULL DEFAULT 100.00,
    prize_distribution JSONB NOT NULL, -- [{"rank": 1, "prize": 50}, {"rank": 2, "prize": 25}, ...]
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'active', -- 'active', 'ended'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contests_status ON contests(status);
CREATE INDEX IF NOT EXISTS idx_contests_type ON contests(type);

-- 14. Connected Telegram Channels & Groups (For Bot Tasks Verification)
CREATE TABLE IF NOT EXISTS connected_chats (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT UNIQUE NOT NULL,
    type VARCHAR(32) NOT NULL, -- 'channel', 'group', 'supergroup'
    title VARCHAR(255) NOT NULL,
    username VARCHAR(128),
    invite_link VARCHAR(255),
    connected_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connected_chats_type ON connected_chats(type);

-- 15. Telegram Channel & Group Join Requests (For "Request to Join" private channels)
CREATE TABLE IF NOT EXISTS telegram_join_requests (
    id BIGSERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    chat_username TEXT,
    telegram_user_id BIGINT NOT NULL,
    invite_link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_chat_user_join_request UNIQUE (chat_id, telegram_user_id)
);

CREATE INDEX IF NOT EXISTS idx_join_requests_chat_user ON telegram_join_requests(chat_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON telegram_join_requests(telegram_user_id);

-- Initial Tasks matching frontend
INSERT INTO tasks (id, category, title, icon, is_icon_image, reward_gems, secondary_reward_gems, target_count, task_type, action_url) VALUES
('special-1', 'special', 'Reach lvl 3 FOR THE FIRST TIME!', './assets/coin_3d.png', true, 1600, 0, 3, 'level_reach', ''),
('special-2', 'special', 'Invite 3 active spinners', './assets/inviteFeatureCardIcon.png', true, 3000, 0, 3, 'invite_count', ''),
('special-3', 'special', 'Join Spin Craft VIP Get More Rewards', './assets/wheel-of-fortune.png', true, 3200, 1, 1, 'telegram_channel', 'https://t.me/SpinCraftCommunity'),
('daily-1', 'daily', 'Spin the Lucky Wheel 5 times', './assets/wheel-of-fortune.png', true, 160, 0, 5, 'spin_count', ''),
('daily-2', 'daily', 'Complete 10 tasks today', './assets/giftIconInDailySignIn.png', true, 800, 0, 10, 'spin_count', ''),
('social-1', 'socials', 'Subscribe to Spin Craft Telegram Channel', '📣', false, 500, 0, 1, 'telegram_channel', 'https://t.me/SpinCraftCommunity'),
('social-2', 'socials', 'Follow Spin Craft on X (Twitter)', '🐦', false, 400, 0, 1, 'social_x', 'https://x.com/SpinCraft')
ON CONFLICT (id) DO NOTHING;

-- Initial Gift Codes for testing & promo
INSERT INTO gift_codes (code, reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, is_multi_use, expires_at, is_active) VALUES
('WELCOME2026', 500, 0, 0.00, 10000, 0, true, NOW() + INTERVAL '90 days', true),
('SPINFREE', 0, 5, 0.00, 5000, 0, true, NOW() + INTERVAL '90 days', true),
('LUCKYJACKPOT', 0, 0, 0.50, 1000, 0, true, NOW() + INTERVAL '30 days', true)
ON CONFLICT (code) DO NOTHING;

-- Initial Contests & Tournaments
INSERT INTO contests (contest_id, type, title, prize_pool_usd, prize_pool_str, icon, prize_distribution, starts_at, ends_at, status, is_active) VALUES
(
    'spin_weekly',
    'spins',
    'Weekly Spin Championship',
    500.00,
    '$500.00 USDT',
    './assets/wheel-of-fortune.png',
    '[
      {"rank": 1, "prize": "$200.00", "amount_usd": 200.00},
      {"rank": 2, "prize": "$100.00", "amount_usd": 100.00},
      {"rank": 3, "prize": "$50.00", "amount_usd": 50.00},
      {"rank": 4, "prize": "$25.00", "amount_usd": 25.00},
      {"rank": 5, "prize": "$25.00", "amount_usd": 25.00},
      {"rank": 6, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 7, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 8, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 9, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 10, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 11, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 12, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 13, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 14, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 15, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 16, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 17, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 18, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 19, "prize": "$5.00", "amount_usd": 5.00},
      {"rank": 20, "prize": "$5.00", "amount_usd": 5.00}
    ]'::jsonb,
    NOW(),
    NOW() + INTERVAL '7 days',
    'active',
    true
),
(
    'referral_monthly',
    'referrals',
    'Global Referral Championship',
    1000.00,
    '$1,000.00 USDT',
    './assets/inviteFeatureCardIcon.png',
    '[
      {"rank": 1, "prize": "$400.00", "amount_usd": 400.00},
      {"rank": 2, "prize": "$200.00", "amount_usd": 200.00},
      {"rank": 3, "prize": "$100.00", "amount_usd": 100.00},
      {"rank": 4, "prize": "$50.00", "amount_usd": 50.00},
      {"rank": 5, "prize": "$50.00", "amount_usd": 50.00},
      {"rank": 6, "prize": "$20.00", "amount_usd": 20.00},
      {"rank": 7, "prize": "$20.00", "amount_usd": 20.00},
      {"rank": 8, "prize": "$20.00", "amount_usd": 20.00},
      {"rank": 9, "prize": "$20.00", "amount_usd": 20.00},
      {"rank": 10, "prize": "$20.00", "amount_usd": 20.00},
      {"rank": 11, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 12, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 13, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 14, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 15, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 16, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 17, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 18, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 19, "prize": "$10.00", "amount_usd": 10.00},
      {"rank": 20, "prize": "$10.00", "amount_usd": 10.00}
    ]'::jsonb,
    NOW(),
    NOW() + INTERVAL '30 days',
    'active',
    true
)
ON CONFLICT (contest_id) DO NOTHING;

-- 15. Sub-Admins & RBAC
CREATE TABLE IF NOT EXISTS sub_admins (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(64),
    first_name VARCHAR(128),
    role VARCHAR(32) NOT NULL DEFAULT 'moderator',
    permissions JSONB NOT NULL DEFAULT '["support", "users_view", "tasks_manage", "contests_manage"]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_admins_telegram_id ON sub_admins(telegram_id);

-- 16. Admin Broadcast Queue & Campaign Manager
CREATE TABLE IF NOT EXISTS broadcast_jobs (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    parse_mode VARCHAR(16) NOT NULL DEFAULT 'HTML',
    media_url VARCHAR(512),
    media_type VARCHAR(16) DEFAULT '',
    buttons_json JSONB DEFAULT '[]'::jsonb,
    target_audience VARCHAR(32) NOT NULL DEFAULT 'all',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    total_users INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_by BIGINT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_status ON broadcast_jobs(status);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS fee_usd NUMERIC(16, 4) DEFAULT 0.0000;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS credited_usd NUMERIC(16, 4) DEFAULT 0.0000;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_claimed_channel_reward BOOLEAN DEFAULT FALSE;
