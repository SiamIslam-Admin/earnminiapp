package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DBWithdrawal struct {
	ID           int64
	UserID       int64
	AmountUSD    float64
	FeeUSD       float64
	NetPayoutUSD float64
	TONAddress   string
	Status       string // 'processing', 'completed', 'rejected'
	ReferenceID  string
	TxHash       string
	Notes        string
	CreatedAt    time.Time
	ProcessedAt  *time.Time
}

type WalletRepository struct {
	pool *pgxpool.Pool
}

func NewWalletRepository(pool *pgxpool.Pool) *WalletRepository {
	return &WalletRepository{pool: pool}
}

func (r *WalletRepository) CreateWithdrawal(ctx context.Context, w *DBWithdrawal) error {
	query := `
		INSERT INTO withdrawals (user_id, amount_usd, fee_usd, net_payout_usd, ton_address, status, reference_id, tx_hash, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id, created_at
	`
	return r.pool.QueryRow(ctx, query,
		w.UserID, w.AmountUSD, w.FeeUSD, w.NetPayoutUSD, w.TONAddress,
		w.Status, w.ReferenceID, w.TxHash, w.Notes,
	).Scan(&w.ID, &w.CreatedAt)
}

func (r *WalletRepository) GetUserWithdrawals(ctx context.Context, userID int64, limit int) ([]DBWithdrawal, error) {
	query := `
		SELECT id, user_id, amount_usd, fee_usd, net_payout_usd, ton_address, status, reference_id, COALESCE(tx_hash, ''), COALESCE(notes, ''), created_at, processed_at
		FROM withdrawals
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.pool.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query withdrawals: %w", err)
	}
	defer rows.Close()

	var list []DBWithdrawal
	for rows.Next() {
		var w DBWithdrawal
		if err := rows.Scan(
			&w.ID, &w.UserID, &w.AmountUSD, &w.FeeUSD, &w.NetPayoutUSD, &w.TONAddress,
			&w.Status, &w.ReferenceID, &w.TxHash, &w.Notes, &w.CreatedAt, &w.ProcessedAt,
		); err == nil {
			list = append(list, w)
		}
	}
	return list, nil
}

// HasUserWithdrawn checks whether the user has any completed or processing withdrawal history
func (r *WalletRepository) HasUserWithdrawn(ctx context.Context, userID int64) (bool, error) {
	if r.pool == nil {
		return false, nil
	}
	query := `
		SELECT EXISTS (
			SELECT 1 FROM withdrawals
			WHERE user_id = $1 AND status IN ('completed', 'processing')
		)
	`
	var hasWithdrawn bool
	err := r.pool.QueryRow(ctx, query, userID).Scan(&hasWithdrawn)
	return hasWithdrawn, err
}

func (r *WalletRepository) UpdateWithdrawalStatus(ctx context.Context, id int64, status string, txHash string, notes string) error {
	query := `
		UPDATE withdrawals
		SET status = $1,
		    tx_hash = CASE WHEN $2 != '' THEN $2 ELSE tx_hash END,
		    notes = CASE WHEN $3 != '' THEN $3 ELSE notes END,
		    processed_at = CASE WHEN $1 IN ('completed', 'failed', 'rejected') THEN NOW() ELSE processed_at END
		WHERE id = $4
	`
	_, err := r.pool.Exec(ctx, query, status, txHash, notes, id)
	return err
}

