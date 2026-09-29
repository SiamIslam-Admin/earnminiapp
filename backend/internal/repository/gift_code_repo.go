package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"earnminiapp/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DBGiftCode struct {
	ID             int64
	Code           string
	BatchID        string
	BatchName      string
	RewardDiamonds int64
	RewardSpins    int
	RewardUSD      float64
	MaxClaims      int
	CurrentClaims  int
	ExpiresAt      *time.Time
	IsActive       bool
	CreatedAt      time.Time
}

type GiftCodeRepository struct {
	pool *pgxpool.Pool
}

func NewGiftCodeRepository(pool *pgxpool.Pool) *GiftCodeRepository {
	return &GiftCodeRepository{pool: pool}
}

func (r *GiftCodeRepository) GetByCode(ctx context.Context, code string) (*DBGiftCode, error) {
	query := `
		SELECT id, code, COALESCE(batch_id, ''), COALESCE(batch_name, ''), reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, expires_at, is_active, created_at
		FROM gift_codes
		WHERE UPPER(code) = UPPER($1)
	`
	var g DBGiftCode
	err := r.pool.QueryRow(ctx, query, code).Scan(
		&g.ID, &g.Code, &g.BatchID, &g.BatchName, &g.RewardDiamonds, &g.RewardSpins, &g.RewardUSD, &g.MaxClaims, &g.CurrentClaims,
		&g.ExpiresAt, &g.IsActive, &g.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &g, nil
}

func (r *GiftCodeRepository) HasUserClaimed(ctx context.Context, userID, giftCodeID int64) (bool, error) {
	var count int
	err := r.pool.QueryRow(ctx, "SELECT COUNT(*) FROM gift_code_claims WHERE user_id = $1 AND gift_code_id = $2", userID, giftCodeID).Scan(&count)
	return count > 0, err
}

func (r *GiftCodeRepository) RecordClaim(ctx context.Context, userID, giftCodeID int64) error {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, "INSERT INTO gift_code_claims (user_id, gift_code_id, claimed_at) VALUES ($1, $2, NOW())", userID, giftCodeID)
	if err != nil {
		return fmt.Errorf("you have already redeemed this gift code: %w", err)
	}

	tag, err := tx.Exec(ctx, "UPDATE gift_codes SET current_claims = current_claims + 1 WHERE id = $1 AND current_claims < max_claims", giftCodeID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("gift code maximum usage limit reached")
	}

	return tx.Commit(ctx)
}

// GenerateBulkUniqueCodes creates N cryptographically unique single-use gift codes under a batch
func (r *GiftCodeRepository) GenerateBulkUniqueCodes(
	ctx context.Context,
	batchID, batchName string,
	quantity int,
	prefix string,
	diamonds int64,
	spins int,
	usd float64,
	expiresInDays int,
) ([]string, error) {
	if quantity <= 0 || quantity > 1000 {
		return nil, errors.New("quantity must be between 1 and 1000")
	}

	var expiresAt *time.Time
	if expiresInDays > 0 {
		exp := time.Now().Add(time.Duration(expiresInDays) * 24 * time.Hour)
		expiresAt = &exp
	}

	if batchID == "" {
		batchID = fmt.Sprintf("BATCH-%d", time.Now().Unix())
	}
	if batchName == "" {
		batchName = fmt.Sprintf("Bulk Giveaway %d Codes", quantity)
	}

	generatedCodes := make([]string, 0, quantity)
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	cleanPrefix := strings.ToUpper(strings.TrimSpace(prefix))

	for i := 0; i < quantity; i++ {
		randomBytes := make([]byte, 4)
		_, _ = rand.Read(randomBytes)
		randomPart := strings.ToUpper(hex.EncodeToString(randomBytes))

		code := fmt.Sprintf("%s%s", cleanPrefix, randomPart)

		query := `
			INSERT INTO gift_codes (code, batch_id, batch_name, reward_diamonds, reward_spins, reward_usd, max_claims, current_claims, is_active, expires_at, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, 1, 0, true, $7, NOW())
			ON CONFLICT (code) DO NOTHING
		`
		_, err := tx.Exec(ctx, query, code, batchID, batchName, diamonds, spins, usd, expiresAt)
		if err != nil {
			return nil, fmt.Errorf("failed to insert unique gift code: %w", err)
		}

		generatedCodes = append(generatedCodes, code)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return generatedCodes, nil
}

// GetCodeClaimers returns the list of users who redeemed a specific gift code
func (r *GiftCodeRepository) GetCodeClaimers(ctx context.Context, giftCodeID int64) ([]model.GiftCodeClaimer, error) {
	query := `
		SELECT c.user_id, u.telegram_id, u.first_name, u.username, c.claimed_at
		FROM gift_code_claims c
		JOIN users u ON u.id = c.user_id
		WHERE c.gift_code_id = $1
		ORDER BY c.claimed_at DESC
	`
	rows, err := r.pool.Query(ctx, query, giftCodeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var claimers []model.GiftCodeClaimer
	for rows.Next() {
		var c model.GiftCodeClaimer
		if err := rows.Scan(&c.UserID, &c.TelegramID, &c.FirstName, &c.Username, &c.ClaimedAt); err == nil {
			claimers = append(claimers, c)
		}
	}
	return claimers, nil
}

// GetBatchSummaries lists all bulk batches
func (r *GiftCodeRepository) GetBatchSummaries(ctx context.Context) ([]model.GiftCodeBatchSummary, error) {
	query := `
		SELECT 
			batch_id,
			MAX(batch_name) as batch_name,
			COUNT(id) as total_codes,
			COUNT(id) FILTER (WHERE current_claims > 0) as claimed_codes,
			COUNT(id) FILTER (WHERE current_claims = 0) as unclaimed_codes,
			MAX(reward_diamonds) as reward_diamonds,
			MAX(reward_spins) as reward_spins,
			MAX(reward_usd) as reward_usd,
			MAX(expires_at) as expires_at,
			MIN(created_at) as created_at
		FROM gift_codes
		WHERE batch_id IS NOT NULL AND batch_id != ''
		GROUP BY batch_id
		ORDER BY MIN(created_at) DESC
	`
	rows, err := r.pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []model.GiftCodeBatchSummary
	for rows.Next() {
		var b model.GiftCodeBatchSummary
		if err := rows.Scan(
			&b.BatchID, &b.BatchName, &b.TotalCodes, &b.ClaimedCodes, &b.UnclaimedCodes,
			&b.RewardDiamonds, &b.RewardSpins, &b.RewardUSD, &b.ExpiresAt, &b.CreatedAt,
		); err == nil {
			list = append(list, b)
		}
	}
	return list, nil
}
