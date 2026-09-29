package repository

import (
	"context"
	"errors"
	"fmt"

	"earnminiapp/internal/model"
	"earnminiapp/pkg/util"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UserRepository struct {
	pool *pgxpool.Pool
}

func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// ScanUser scans a pgx.Row into a model.User struct
func ScanUser(row pgx.Row) (*model.User, error) {
	var user model.User
	err := row.Scan(
		&user.ID, &user.TelegramID, &user.Username, &user.FirstName, &user.PhotoURL, &user.LanguageCode,
		&user.IsPremium, &user.Level, &user.Energy, &user.MaxEnergy, &user.Spins,
		&user.Diamonds, &user.BalanceUSD, &user.ReferrerID, &user.TONWallet, &user.IsBanned,
		&user.HasClaimedChannelReward,
		&user.LastEnergyRefill, &user.LastActiveAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) ScanUser(row pgx.Row) (*model.User, error) {
	return ScanUser(row)
}

func (r *UserRepository) CreateUser(ctx context.Context, u *model.User) (*model.User, error) {
	query := `
		INSERT INTO users (telegram_id, username, first_name, photo_url, language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, ton_wallet, is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(), NOW(), NOW())
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, query,
		u.TelegramID, u.Username, u.FirstName, u.PhotoURL, u.LanguageCode, u.IsPremium,
		u.Level, u.Energy, u.MaxEnergy, u.Spins, u.Diamonds, u.BalanceUSD,
		u.ReferrerID, u.TONWallet, u.IsBanned, u.HasClaimedChannelReward,
	)
	return ScanUser(row)
}

func (r *UserRepository) UpsertFromTelegram(ctx context.Context, tgID int64, username, firstName, photoURL string, isPremium bool, referrerTGID *int64) (*model.User, bool, error) {
	var dbReferrerID *int64
	if referrerTGID != nil && *referrerTGID != tgID && *referrerTGID > 0 {
		var refID int64
		err := r.pool.QueryRow(ctx, "SELECT id FROM users WHERE telegram_id = $1", *referrerTGID).Scan(&refID)
		if err == nil && refID > 0 {
			dbReferrerID = &refID
		}
	}

	query := `
		INSERT INTO users (telegram_id, username, first_name, photo_url, is_premium, referrer_id, last_active_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
		ON CONFLICT (telegram_id) DO UPDATE SET
			username = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			photo_url = CASE WHEN EXCLUDED.photo_url != '' THEN EXCLUDED.photo_url ELSE users.photo_url END,
			is_premium = EXCLUDED.is_premium,
			last_active_at = NOW(),
			updated_at = NOW()
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at, (xmax = 0) AS is_new
	`

	var user model.User
	var isNew bool
	err := r.pool.QueryRow(ctx, query, tgID, username, firstName, photoURL, isPremium, dbReferrerID).Scan(
		&user.ID, &user.TelegramID, &user.Username, &user.FirstName, &user.PhotoURL, &user.LanguageCode,
		&user.IsPremium, &user.Level, &user.Energy, &user.MaxEnergy, &user.Spins,
		&user.Diamonds, &user.BalanceUSD, &user.ReferrerID, &user.TONWallet, &user.IsBanned,
		&user.HasClaimedChannelReward,
		&user.LastEnergyRefill, &user.LastActiveAt, &user.CreatedAt, &user.UpdatedAt, &isNew,
	)
	if err != nil {
		return nil, false, fmt.Errorf("failed to upsert user: %w", err)
	}

	return &user, isNew, nil
}

func (r *UserRepository) GetByID(ctx context.Context, id int64) (*model.User, error) {
	query := `
		SELECT id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
		FROM users
		WHERE id = $1
	`
	row := r.pool.QueryRow(ctx, query, id)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetByTelegramID(ctx context.Context, tgID int64) (*model.User, error) {
	query := `
		SELECT id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
		FROM users
		WHERE telegram_id = $1
	`
	row := r.pool.QueryRow(ctx, query, tgID)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to get user by telegram id: %w", err)
	}
	return user, nil
}

func (r *UserRepository) MarkChannelRewardClaimed(ctx context.Context, userID int64) error {
	query := `
		UPDATE users
		SET has_claimed_channel_reward = TRUE, updated_at = NOW()
		WHERE id = $1
	`
	_, err := r.pool.Exec(ctx, query, userID)
	if err != nil {
		return fmt.Errorf("failed to mark channel reward claimed: %w", err)
	}
	return nil
}

// ClaimChannelRewardAtomic atomically claims the channel reward, marks has_claimed_channel_reward, credits spins and diamonds, and inserts a ledger transaction
func (r *UserRepository) ClaimChannelRewardAtomic(ctx context.Context, userID int64, rewardSpins int, rewardDiamonds int64, title, desc string) (*model.User, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	query := `
		UPDATE users
		SET
			spins = spins + $2,
			diamonds = diamonds + $3,
			has_claimed_channel_reward = TRUE,
			updated_at = NOW()
		WHERE id = $1 AND has_claimed_channel_reward = FALSE
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	var user model.User
	err = tx.QueryRow(ctx, query, userID, rewardSpins, rewardDiamonds).Scan(
		&user.ID, &user.TelegramID, &user.Username, &user.FirstName, &user.PhotoURL, &user.LanguageCode,
		&user.IsPremium, &user.Level, &user.Energy, &user.MaxEnergy, &user.Spins,
		&user.Diamonds, &user.BalanceUSD, &user.ReferrerID, &user.TONWallet, &user.IsBanned,
		&user.HasClaimedChannelReward,
		&user.LastEnergyRefill, &user.LastActiveAt, &user.CreatedAt, &user.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("official channel reward has already been claimed")
		}
		return nil, fmt.Errorf("failed to credit channel reward: %w", err)
	}

	txID := util.GenerateTXID("CHANNEL")
	_, err = tx.Exec(ctx, `
		INSERT INTO transactions (user_id, category, title, amount_diamonds, amount_spins, status, reference_id, description, created_at)
		VALUES ($1, 'tasks', $2, $3, $4, 'completed', $5, $6, NOW())
	`, userID, title, rewardDiamonds, rewardSpins, txID, desc)
	if err != nil {
		return nil, fmt.Errorf("failed to create ledger entry: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &user, nil
}

// MutateBalances atomically updates user resource balances
func (r *UserRepository) MutateBalances(ctx context.Context, userID int64, deltaSpins int, deltaDiamonds int64, deltaUSD float64, deltaEnergy int) (*model.User, error) {
	query := `
		UPDATE users
		SET
			spins = GREATEST(0, spins + $2),
			diamonds = GREATEST(0, diamonds + $3),
			balance_usd = GREATEST(0.0000, balance_usd + $4),
			energy = LEAST(max_energy, GREATEST(0, energy + $5)),
			updated_at = NOW()
		WHERE id = $1
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, query, userID, deltaSpins, deltaDiamonds, deltaUSD, deltaEnergy)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to mutate balances: %w", err)
	}
	return user, nil
}

// DeductSpinCost atomically decrements spins or diamonds with a strict non-negative condition.
func (r *UserRepository) DeductSpinCost(ctx context.Context, userID int64, costType string, costAmount int64) error {
	var query string
	switch costType {
	case "spins":
		query = `
			UPDATE users
			SET spins = spins - $2, updated_at = NOW()
			WHERE id = $1 AND spins >= $2
		`
	case "diamonds":
		query = `
			UPDATE users
			SET diamonds = diamonds - $2, updated_at = NOW()
			WHERE id = $1 AND diamonds >= $2
		`
	default:
		return fmt.Errorf("invalid spin cost type: %s", costType)
	}

	tag, err := r.pool.Exec(ctx, query, userID, costAmount)
	if err != nil {
		return fmt.Errorf("failed to deduct spin cost: %w", err)
	}
	if tag.RowsAffected() == 0 {
		if costType == "spins" {
			return errors.New("insufficient spins")
		}
		return errors.New("insufficient diamonds (requires 1,000 💎)")
	}
	return nil
}

// DeductUSDBalance atomically decrements balance_usd with a strict non-negative condition.
func (r *UserRepository) DeductUSDBalance(ctx context.Context, userID int64, amountUSD float64) (*model.User, error) {
	query := `
		UPDATE users
		SET balance_usd = balance_usd - $2, updated_at = NOW()
		WHERE id = $1 AND balance_usd >= $2
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, query, userID, amountUSD)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct usd balance: %w", err)
	}
	if user == nil {
		return nil, errors.New("insufficient balance")
	}
	return user, nil
}

// DeductRaffleCost atomically decrements diamonds and balance_usd with strict non-negative conditions.
func (r *UserRepository) DeductRaffleCost(ctx context.Context, userID int64, diamondCost int64, usdCost float64) (*model.User, error) {
	query := `
		UPDATE users
		SET diamonds = diamonds - $2, balance_usd = balance_usd - $3, updated_at = NOW()
		WHERE id = $1 AND diamonds >= $2 AND balance_usd >= $3
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, query, userID, diamondCost, usdCost)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to deduct raffle cost: %w", err)
	}
	if user == nil {
		if usdCost > 0 && diamondCost > 0 {
			return nil, errors.New("insufficient balance and diamonds")
		} else if usdCost > 0 {
			return nil, errors.New("insufficient balance")
		} else {
			return nil, errors.New("insufficient diamonds")
		}
	}
	return user, nil
}

func (r *UserRepository) UpdateTONWallet(ctx context.Context, userID int64, address string) (*model.User, error) {
	query := `
		UPDATE users
		SET ton_wallet = $2, updated_at = NOW()
		WHERE id = $1
		RETURNING id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
	`
	row := r.pool.QueryRow(ctx, query, userID, address)
	user, err := ScanUser(row)
	if err != nil {
		return nil, fmt.Errorf("failed to update ton wallet: %w", err)
	}
	return user, nil
}

func (r *UserRepository) GetReferrals(ctx context.Context, userID int64) ([]model.User, error) {
	query := `
		SELECT id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
		FROM users
		WHERE referrer_id = $1
		ORDER BY created_at DESC
		LIMIT 100
	`
	rows, err := r.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var referrals []model.User
	for rows.Next() {
		user, err := ScanUser(rows)
		if err != nil {
			return nil, err
		}
		if user != nil {
			referrals = append(referrals, *user)
		}
	}
	return referrals, nil
}

func (r *UserRepository) CountReferrals(ctx context.Context, userID int64) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM users WHERE referrer_id = $1", userID).Scan(&count)
	return count, err
}

func (r *UserRepository) GetAllUsers(ctx context.Context, limit, offset int) ([]model.User, error) {
	query := `
		SELECT id, telegram_id, username, first_name, COALESCE(photo_url, ''), language_code, is_premium, level, energy, max_energy, spins, diamonds, balance_usd, referrer_id, COALESCE(ton_wallet, ''), is_banned, has_claimed_channel_reward, last_energy_refill, last_active_at, created_at, updated_at
		FROM users
		ORDER BY id ASC
		LIMIT $1 OFFSET $2
	`
	rows, err := r.pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		user, err := ScanUser(rows)
		if err != nil {
			return nil, err
		}
		if user != nil {
			users = append(users, *user)
		}
	}
	return users, nil
}

