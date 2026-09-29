package repository

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DailyStreak struct {
	UserID        int64
	CurrentDay    int
	LastClaimDate *time.Time
	TotalClaims   int
	UpdatedAt     time.Time
}

type DailyRewardRepository struct {
	pool *pgxpool.Pool
}

func NewDailyRewardRepository(pool *pgxpool.Pool) *DailyRewardRepository {
	return &DailyRewardRepository{pool: pool}
}

func (r *DailyRewardRepository) GetStreak(ctx context.Context, userID int64) (*DailyStreak, error) {
	query := `
		SELECT user_id, current_day, last_claim_date, total_claims, updated_at
		FROM daily_streaks
		WHERE user_id = $1
	`
	var s DailyStreak
	err := r.pool.QueryRow(ctx, query, userID).Scan(
		&s.UserID, &s.CurrentDay, &s.LastClaimDate, &s.TotalClaims, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

func (r *DailyRewardRepository) UpsertStreak(ctx context.Context, userID int64, day int, claimDate time.Time, totalClaims int) error {
	query := `
		INSERT INTO daily_streaks (user_id, current_day, last_claim_date, total_claims, updated_at)
		VALUES ($1, $2, $3, $4, NOW())
		ON CONFLICT (user_id) DO UPDATE SET
			current_day = EXCLUDED.current_day,
			last_claim_date = EXCLUDED.last_claim_date,
			total_claims = EXCLUDED.total_claims,
			updated_at = NOW()
	`
	_, err := r.pool.Exec(ctx, query, userID, day, claimDate, totalClaims)
	return err
}

// ClaimStreakAtomic atomically records daily streak claim if not already claimed today.
// Returns true if claim succeeded, false if already claimed today (0 rows returned).
func (r *DailyRewardRepository) ClaimStreakAtomic(ctx context.Context, userID int64, currentDay int) (bool, error) {
	query := `
		INSERT INTO daily_streaks (user_id, current_day, last_claim_date, total_claims, updated_at)
		VALUES ($1, $2, CURRENT_DATE, 1, NOW())
		ON CONFLICT (user_id) DO UPDATE
		SET current_day = $2,
			last_claim_date = CURRENT_DATE,
			total_claims = daily_streaks.total_claims + 1,
			updated_at = NOW()
		WHERE daily_streaks.last_claim_date IS NULL OR daily_streaks.last_claim_date < CURRENT_DATE
		RETURNING current_day;
	`
	var claimedDay int
	err := r.pool.QueryRow(ctx, query, userID, currentDay).Scan(&claimedDay)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

