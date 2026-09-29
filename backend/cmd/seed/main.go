package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"time"

	"earnminiapp/internal/config"
	"earnminiapp/internal/db"
	"earnminiapp/pkg/jwt"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	cleanFlag := flag.Bool("clean", false, "Wipe all mock data from PostgreSQL and Redis to reset for production")
	flag.Parse()

	log.Println("══════════════════════════════════════════════════════════════════════")
	log.Println("           EARN MINI APP - COMPLETE MOCK DATA SEEDER                  ")
	log.Println("══════════════════════════════════════════════════════════════════════")

	cfg := config.LoadConfig()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("[FATAL] Invalid DATABASE_URL (%s): %v", cfg.DatabaseURL, err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Fatalf("[FATAL] Unable to connect to PostgreSQL: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("[FATAL] PostgreSQL Ping failed: %v", err)
	}
	log.Println("[INFO] Connected to PostgreSQL successfully!")

	redisService := db.NewRedisService(cfg)

	// If --clean flag is provided, wipe all tables and flush redis
	if *cleanFlag {
		log.Println("[INFO] Cleaning all database tables and Redis cache for production reset...")
		cleanQuery := `
			TRUNCATE TABLE raffle_tickets, raffles, user_tasks, tasks, gift_codes, 
			support_tickets, sub_admins, broadcast_jobs, connected_chats, contests, withdrawals, invoices, transactions, users RESTART IDENTITY CASCADE;
		`
		if _, err := pool.Exec(ctx, cleanQuery); err != nil {
			log.Fatalf("[FATAL] Clean query failed: %v", err)
		}
		_ = redisService.Del(ctx, "tournament:spins:current_week")
		_ = redisService.Del(ctx, "tournament:referrals:current_month")
		log.Println("✅ [SUCCESS] All mock data wiped! PostgreSQL & Redis are completely clean for production.")
		return
	}

	// 1. Seed Realistic Users (Main Test Player + 5 Referral Friends + Competitors)
	log.Println("[INFO] Seeding Users & Referral Team...")
	usersQuery := `
		INSERT INTO users (id, telegram_id, username, first_name, photo_url, level, energy, max_energy, spins, diamonds, balance_usd, ton_wallet, referrer_id, last_energy_refill, last_active_at, created_at, updated_at)
		VALUES
			(1, 123456789, 'test_player', 'Crypto Tester', 'https://t.me/i/userpic/320/avatar.jpg', 1, 50, 50, 8, 2500, 0.4500, '0x58c679f291079d3E01a6132712217c4618e7E1d2', NULL, NOW(), NOW(), NOW() - INTERVAL '7 days', NOW()),
			(2, 100000002, 'alice_crypto', 'Alice', 'https://t.me/i/userpic/320/alice.jpg', 2, 50, 50, 5, 4500, 0.8500, '0x1111111111111111111111111111111111111111', 1, NOW(), NOW(), NOW() - INTERVAL '5 days', NOW()),
			(3, 100000003, 'bob_hodl', 'Bob', 'https://t.me/i/userpic/320/bob.jpg', 1, 40, 50, 2, 1200, 0.2000, '0x2222222222222222222222222222222222222222', 1, NOW(), NOW(), NOW() - INTERVAL '4 days', NOW()),
			(4, 100000004, 'charlie_tg', 'Charlie', 'https://t.me/i/userpic/320/charlie.jpg', 3, 50, 50, 12, 8900, 1.4500, '0x3333333333333333333333333333333333333333', 1, NOW(), NOW(), NOW() - INTERVAL '3 days', NOW()),
			(5, 100000005, 'david_bsc', 'David', 'https://t.me/i/userpic/320/david.jpg', 1, 30, 50, 1, 600, 0.1000, '0x4444444444444444444444444444444444444444', 1, NOW(), NOW(), NOW() - INTERVAL '2 days', NOW()),
			(6, 100000006, 'elena_ton', 'Elena', 'https://t.me/i/userpic/320/elena.jpg', 2, 50, 50, 4, 3100, 0.6500, '0x5555555555555555555555555555555555555555', 1, NOW(), NOW(), NOW() - INTERVAL '1 days', NOW()),
			(7, 100000007, 'crypto_king', 'CryptoKing', 'https://t.me/i/userpic/320/king.jpg', 5, 50, 50, 20, 25000, 4.5000, '0x6666666666666666666666666666666666666666', NULL, NOW(), NOW(), NOW() - INTERVAL '10 days', NOW()),
			(8, 100000008, 'viper_x', 'ViperX', 'https://t.me/i/userpic/320/viper.jpg', 4, 50, 50, 15, 18000, 3.2000, '0x7777777777777777777777777777777777777777', NULL, NOW(), NOW(), NOW() - INTERVAL '10 days', NOW())
		ON CONFLICT (id) DO UPDATE SET
			spins = EXCLUDED.spins,
			diamonds = EXCLUDED.diamonds,
			balance_usd = EXCLUDED.balance_usd,
			ton_wallet = EXCLUDED.ton_wallet,
			updated_at = NOW();
	`
	_, _ = pool.Exec(ctx, usersQuery)
	log.Println("✅ Seeded 8 Realistic Users (Main Player + 5 Referral Team Members + Competitors)")

	// 2. Seed Rich Transaction History for User 1 (All categories: spins, daily, tasks, team, withdrawals, invoices, gift, raffles)
	log.Println("[INFO] Seeding Financial Records & Transactions...")
	txQuery := `
		INSERT INTO transactions (user_id, category, title, amount_usd, amount_diamonds, amount_spins, amount_tickets, status, reference_id, tx_hash, description, created_at)
		VALUES
			(1, 'withdrawals', 'BEP-20 USDT Withdrawal', -1.0000, 0, 0, 0, 'completed', 'WTH-REC-001', '0x7f83b1a2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abc', 'Sent $0.98 USDT to 0x58c6...7E1d2 (2% Fee: $0.02)', NOW() - INTERVAL '4 hours'),
			(1, 'spins', 'Spin Wheel: Progressive Cashpot', 0.0500, 0, 0, 0, 'completed', 'SPIN-101', '', 'Hit the dynamic Cashpot prize! 💰', NOW() - INTERVAL '5 hours'),
			(1, 'spins', 'Spin Wheel: Lucky Diamonds', 0.0000, 100, 0, 0, 'completed', 'SPIN-102', '', '+100 💎 added from Lucky Wheel', NOW() - INTERVAL '6 hours'),
			(1, 'spins', 'Spin Wheel: Free Spin Ticket', 0.0000, 0, 2, 0, 'completed', 'SPIN-103', '', '+2 Free Spin Tickets won! 🎰', NOW() - INTERVAL '7 hours'),
			(1, 'tasks', 'VIP Community Channel Joined', 0.0000, 500, 2, 0, 'completed', 'TASK-VIP-01', '', '+500 💎 and +2 Spins for joining Telegram VIP', NOW() - INTERVAL '1 day'),
			(1, 'tasks', 'Followed X / Twitter', 0.0000, 300, 1, 0, 'completed', 'TASK-X-01', '', '+300 💎 and +1 Spin for following Twitter', NOW() - INTERVAL '1 day'),
			(1, 'team', 'Referral Commission: Alice joined', 0.0000, 0, 1, 0, 'completed', 'REF-BONUS-01', '', '+1 Free Spin for inviting Alice 👥', NOW() - INTERVAL '2 days'),
			(1, 'team', 'Referral Commission: Bob joined', 0.0000, 0, 1, 0, 'completed', 'REF-BONUS-02', '', '+1 Free Spin for inviting Bob 👥', NOW() - INTERVAL '2 days'),
			(1, 'gift', 'Redeemed Promo Code WELCOME2026', 0.0000, 500, 3, 0, 'completed', 'GIFT-WELCOME', '', '+500 💎 and +3 Spins promo redemption 🎉', NOW() - INTERVAL '3 days'),
			(1, 'raffles', 'Purchased 2 Mega Raffle Tickets', 0.0000, -200, 0, 2, 'completed', 'RAF-VIP260803', '', 'Entered #VIP260803 Mega Raffle 🎟️', NOW() - INTERVAL '3 days')
		ON CONFLICT DO NOTHING;
	`
	_, _ = pool.Exec(ctx, txQuery)
	log.Println("✅ Seeded 10 Realistic Transaction Records for Records Page (Deposits, Payouts, Spins, Tasks, Gift Codes)")

	// 3. Seed Deposit Invoices (Including a Stuck one for Admin Force Sweep Testing)
	invoicesQuery := `
		INSERT INTO invoices (invoice_id, user_id, wallet_index, deposit_address, amount_usd, purpose, status, sweep_status, sweep_tx_hash, expires_at, created_at)
		VALUES
			('INV-PAID-001', 1, 101, '0x58c679f291079d3E01a6132712217c4618e7E1d2', 5.00, 'diamonds', 'paid', 'swept', '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', NOW() + INTERVAL '2 hours', NOW() - INTERVAL '1 day'),
			('INV-STUCK-002', 1, 102, '0x9999999999999999999999999999999999999999', 10.00, 'diamonds', 'paid', 'failed', '', NOW() + INTERVAL '2 hours', NOW() - INTERVAL '2 hours')
		ON CONFLICT (invoice_id) DO NOTHING;
	`
	_, _ = pool.Exec(ctx, invoicesQuery)
	log.Println("✅ Seeded Deposit Invoices (1 Swept, 1 Stuck for Admin Force Sweep testing)")

	// 4. Seed Withdrawals (1 Completed with On-chain Tx Hash, 1 Pending for Admin Cashout testing)
	withdrawalsQuery := `
		INSERT INTO withdrawals (id, user_id, amount_usd, fee_usd, net_payout_usd, ton_address, status, tx_hash, created_at, updated_at)
		VALUES
			(1, 1, 1.00, 0.02, 0.98, '0x58c679f291079d3E01a6132712217c4618e7E1d2', 'completed', '0x7f83b1a2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abc', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
			(2, 1, 2.50, 0.05, 2.45, '0x58c679f291079d3E01a6132712217c4618e7E1d2', 'pending', '', NOW() - INTERVAL '30 mins', NOW() - INTERVAL '30 mins')
		ON CONFLICT (id) DO NOTHING;
	`
	_, _ = pool.Exec(ctx, withdrawalsQuery)
	log.Println("✅ Seeded Withdrawals (1 Completed with real tx hash, 1 Pending for Admin Approval testing)")

	// 5. Seed Tasks & Quests (All 4 Categories: socials, daily, special, team)
	tasksQuery := `
		INSERT INTO tasks (id, category, title, icon, is_icon_image, reward_gems, reward_spins, target_count, task_type, action_url, is_active)
		VALUES
			('join_vip_tg', 'socials', 'Join Official Telegram Community', './assets/purple-diamond.png', true, 500, 2, 1, 'telegram_channel', 'https://t.me/SpinCraftCommunity', true),
			('join_news_tg', 'socials', 'Join Telegram Announcements', './assets/purple-diamond.png', true, 300, 1, 1, 'telegram_channel', 'https://t.me/SpinCraftNews', true),
			('follow_twitter', 'socials', 'Follow Official X / Twitter', './assets/purple-diamond.png', true, 300, 1, 1, 'social_x', 'https://x.com/earnminiapp', true),
			('join_discord', 'socials', 'Join Official Discord Server', './assets/purple-diamond.png', true, 200, 0, 1, 'url', 'https://discord.gg/earnminiapp', true),
			('daily_spins_3', 'daily', 'Spin the Lucky Wheel 3 Times', './assets/wheel-of-fortune.png', true, 150, 0, 3, 'spin_count', '', true),
			('daily_checkin', 'daily', 'Daily Streak Check-in', './assets/purple-diamond.png', true, 50, 0, 1, 'checkin', '', true),
			('watch_ad', 'daily', 'Watch Rewarded Video Ad', './assets/purple-diamond.png', true, 100, 1, 1, 'adsgram', '', true),
			('bind_wallet', 'special', 'Bind BEP-20 USDT Wallet', './assets/purple-diamond.png', true, 300, 0, 1, 'wallet_bind', '', true),
			('first_deposit', 'special', 'Make First Crypto Deposit', './assets/purple-diamond.png', true, 1000, 5, 1, 'deposit', '', true),
			('invite_1_friend', 'team', 'Invite 1 Active Friend', './assets/inviteFeatureCardIcon.png', true, 300, 1, 1, 'invite_count', '', true),
			('invite_3_friends', 'team', 'Invite 3 Friends to EarnMiniApp', './assets/inviteFeatureCardIcon.png', true, 1000, 3, 3, 'invite_count', '', true),
			('invite_10_friends', 'team', 'Invite 10 Friends (Mega VIP)', './assets/inviteFeatureCardIcon.png', true, 5000, 10, 10, 'invite_count', '', true)
		ON CONFLICT (id) DO UPDATE SET
			title = EXCLUDED.title,
			reward_gems = EXCLUDED.reward_gems,
			reward_spins = EXCLUDED.reward_spins,
			is_active = true;
	`
	_, _ = pool.Exec(ctx, tasksQuery)

	// Seed User 1 completed tasks
	userTasksQuery := `
		INSERT INTO user_tasks (user_id, task_id, progress, is_completed, is_claimed, completed_at, claimed_at)
		VALUES
			(1, 'join_vip_tg', 1, true, true, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
			(1, 'follow_twitter', 1, true, true, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
			(1, 'daily_checkin', 1, true, true, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'),
			(1, 'bind_wallet', 1, true, true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
			(1, 'invite_3_friends', 3, true, false, NOW() - INTERVAL '1 hour', NULL)
		ON CONFLICT (user_id, task_id) DO NOTHING;
	`
	_, _ = pool.Exec(ctx, userTasksQuery)
	log.Println("✅ Seeded 12 Tasks across all 4 categories & User progress")

	// 6. Seed Raffles (Ongoing VIP Mega Raffle, Daily Pool & Ended Past Raffle with Winner)
	rafflesQuery := `
		INSERT INTO raffles (id, title, cash_reward, coin_reward_str, ticket_price_gems, participants_count, total_tickets_count, status, winner_user_id, winner_ticket_number, starts_at, ends_at)
		VALUES
			('#VIP260803', '$100.00 USDT Mega Raffle', 100.00, '10M', 100, 42, 156, 'ongoing', NULL, NULL, NOW(), NOW() + INTERVAL '3 days'),
			('#MINI260804', '$25.00 USDT Daily Pool', 25.00, '2.5M', 50, 18, 45, 'ongoing', NULL, NULL, NOW(), NOW() + INTERVAL '18 hours'),
			('#PAST260801', '$50.00 USDT Grand Draw', 50.00, '5M', 100, 89, 320, 'ended', 4, 42, NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day')
		ON CONFLICT (id) DO UPDATE SET
			status = EXCLUDED.status,
			ends_at = EXCLUDED.ends_at;
	`
	_, _ = pool.Exec(ctx, rafflesQuery)

	// User 1 tickets in #VIP260803
	ticketsQuery := `
		INSERT INTO raffle_tickets (raffle_id, user_id, ticket_number, payment_type, created_at)
		VALUES
			('#VIP260803', 1, 12, 'gems', NOW() - INTERVAL '3 days'),
			('#VIP260803', 1, 13, 'gems', NOW() - INTERVAL '3 days')
		ON CONFLICT DO NOTHING;
	`
	_, _ = pool.Exec(ctx, ticketsQuery)
	log.Println("✅ Seeded Active & Past Raffles with User Tickets")

	// 7. Seed Connected Telegram Channels (For Admin Panel Task Creation Dropdown)
	chatsQuery := `
		INSERT INTO connected_chats (chat_id, type, title, username, invite_link, is_active, created_at)
		VALUES
			(-1001928374650, 'channel', 'EarnMiniApp Official VIP', 'EarnMiniAppVIP', 'https://t.me/+AbCdEfGhIj', true, NOW()),
			(-1001987654321, 'supergroup', 'EarnMiniApp Global Community', 'EarnMiniAppChat', 'https://t.me/+KlMnOpQrSt', true, NOW())
		ON CONFLICT (chat_id) DO NOTHING;
	`
	_, _ = pool.Exec(ctx, chatsQuery)
	log.Println("✅ Seeded Connected Telegram Channels & Groups")

	// 8. Seed Support Feedback Tickets
	feedbackQuery := `
		INSERT INTO feedback (user_id, category, description, status, created_at)
		VALUES
			(1, 'withdrawal', 'My withdrawal of $1.00 USDT was confirmed on-chain in 15 seconds! Super fast.', 'resolved', NOW() - INTERVAL '4 hours'),
			(2, 'task', 'Need help verifying my Telegram channel join task.', 'open', NOW() - INTERVAL '2 hours')
		ON CONFLICT DO NOTHING;
	`
	_, _ = pool.Exec(ctx, feedbackQuery)
	log.Println("✅ Seeded Support Feedback Tickets (1 Resolved, 1 Open)")

	// 9. Seed Promo Gift Codes
	giftCodesQuery := `
		INSERT INTO gift_codes (code, reward_gems, reward_spins, reward_usd, is_multi_use, max_claims, current_claims, is_active, expires_at)
		VALUES
			('WELCOME2026', 500, 3, 0.00, true, 10000, 1, true, NOW() + INTERVAL '365 days'),
			('VIPBONUS', 1000, 5, 0.10, true, 5000, 0, true, NOW() + INTERVAL '365 days'),
			('SINGLEUSE99', 2000, 10, 0.50, false, 1, 0, true, NOW() + INTERVAL '30 days'),
			('EXPIRED2025', 100, 1, 0.00, true, 100, 100, false, NOW() - INTERVAL '10 days')
		ON CONFLICT (code) DO UPDATE SET
			reward_gems = EXCLUDED.reward_gems,
			reward_spins = EXCLUDED.reward_spins,
			is_active = EXCLUDED.is_active;
	`
	_, _ = pool.Exec(ctx, giftCodesQuery)
	log.Println("✅ Seeded Promo Gift Codes (Active Multi-use, Single-use, and Expired)")

	// 10. Seed Dual Tournament Contests
	contestsQuery := `
		INSERT INTO contests (contest_id, type, title, prize_pool_usd, prize_distribution, starts_at, ends_at, status, created_at)
		VALUES
			('spin_weekly', 'spins', 'Weekly Spin Championship', 500.00, '[{"rank":1,"prize":"$250.00"},{"rank":2,"prize":"$125.00"},{"rank":3,"prize":"$75.00"}]'::jsonb, NOW() - INTERVAL '3 days', NOW() + INTERVAL '4 days', 'active', NOW()),
			('referral_monthly', 'referrals', 'Global Referral Championship', 1000.00, '[{"rank":1,"prize":"$500.00"},{"rank":2,"prize":"$250.00"},{"rank":3,"prize":"$150.00"}]'::jsonb, NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days', 'active', NOW())
		ON CONFLICT (contest_id) DO UPDATE SET
			status = 'active',
			ends_at = EXCLUDED.ends_at;
	`
	_, _ = pool.Exec(ctx, contestsQuery)
	log.Println("✅ Seeded Active Contests (Weekly Spin & Global Referral Tournaments)")

	// 11. Seed System Settings
	settingsQuery := `
		INSERT INTO system_settings (key_name, value_data, updated_at)
		VALUES
			('withdrawal_fee_percent', '2.0', NOW()),
			('min_withdrawal_usd', '1.00', NOW()),
			('min_deposit_usd', '0.50', NOW()),
			('adsgram_enabled', 'true', NOW()),
			('adsgram_block_id', '1234', NOW())
		ON CONFLICT (key_name) DO UPDATE SET
			value_data = EXCLUDED.value_data,
			updated_at = NOW();
	`
	_, _ = pool.Exec(ctx, settingsQuery)
	log.Println("✅ Seeded Dynamic System Settings")

	// 12. Seed Redis Tournament Leaderboards with Real User Scores
	log.Println("[INFO] Seeding Redis Tournament Leaderboards...")
	_ = redisService.Del(ctx, "tournament:spins:current_week")
	_ = redisService.Del(ctx, "tournament:referrals:current_month")

	// Spin Leaderboard (User 1 is Rank #4 with 178 spins)
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 284, "7") // CryptoKing
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 219, "6") // Elena
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 195, "8") // ViperX
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 178, "1") // Test Player (User 1)
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 142, "4") // Charlie
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 118, "2") // Alice
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 96, "3")  // Bob
	_ = redisService.ZAdd(ctx, "tournament:spins:current_week", 84, "5")  // David

	// Referral Leaderboard (User 1 has 5 referrals)
	_ = redisService.ZAdd(ctx, "tournament:referrals:current_month", 45, "7")
	_ = redisService.ZAdd(ctx, "tournament:referrals:current_month", 32, "8")
	_ = redisService.ZAdd(ctx, "tournament:referrals:current_month", 21, "4")
	_ = redisService.ZAdd(ctx, "tournament:referrals:current_month", 14, "6")
	_ = redisService.ZAdd(ctx, "tournament:referrals:current_month", 5, "1") // Test Player (User 1)
	log.Println("✅ Seeded Redis Tournament Leaderboards with real scores")

	// 13. Generate Development JWT Tokens
	jwtManager := jwt.NewJWTManager(cfg.JWTSecret, cfg.JWTExpirationHours)
	userToken, _ := jwtManager.GenerateToken(1, 123456789, "test_player")
	adminToken, _ := jwtManager.GenerateToken(1, 123456789, "test_player") // Admin ID

	fmt.Println("\n══════════════════════════════════════════════════════════════════════")
	fmt.Println("🚀 COMPREHENSIVE MOCK DATASET SEEDING COMPLETE!")
	fmt.Println("══════════════════════════════════════════════════════════════════════")
	fmt.Printf("🔑 Ready-to-Use User JWT Token (User ID: 1 | Test Player):\nBearer %s\n\n", userToken)
	fmt.Printf("🔑 Ready-to-Use Admin Secret Passphrase:\n%s\n\n", cfg.AdminSecretKey)
	fmt.Printf("🔑 Ready-to-Use Admin JWT Token:\nBearer %s\n", adminToken)
	fmt.Println("══════════════════════════════════════════════════════════════════════")
	fmt.Println("💡 How to Reset Database for Production Launch:")
	fmt.Println("   Run: go run ./cmd/seed/main.go --clean")
	fmt.Println("══════════════════════════════════════════════════════════════════════")
}
